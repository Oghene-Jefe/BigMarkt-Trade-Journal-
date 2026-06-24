//+------------------------------------------------------------------+
//|  BigMarkt_EA.mq5                                                  |
//|  READ ONLY trade journal bridge for BigMarkt                      |
//|  Sends trade data to journal.bigmarkt.co via HTTP POST            |
//|  NO OrderSend / OrderModify / OrderClose — EVER                   |
//|  v2.7.1 — full open-state mirror snapshot (open/close/repair/pend)|
//+------------------------------------------------------------------+
#property copyright "BigMarkt Protocol"
#property link      "https://journal.bigmarkt.co"
#property version   "2.71"
#property strict

#include <Trade\Trade.mqh>

//--- inputs
input string TokenId        = "";   // Token UUID (from /ea-setup)
input string ApiToken       = "";   // Bearer Token (from /ea-setup)
input string SigningSecret  = "";   // Signing Secret (from /ea-setup)
input string ApiEndpoint    = "https://journal.bigmarkt.co/api/ea/ingest"; // API Endpoint
input bool   DebugMode      = false; // Print debug logs
input int    FilterMagic    = -1;    // Magic filter: -1=all, 0=manual, N=that magic only
//--- v2.6.0 backfill inputs
input bool   BackfillOnStart = true; // Replay missed closed trades on startup
input int    BackfillDays    = 90;   // How far back to scan for missed trades (one-shot deep replay)
input bool   BackfillForce   = false; // Ignore watermark; resend the whole window (use after a data wipe)
//--- v2.7.0 reconcile inputs (no restart ever needed after first setup)
input int    ReconcileMinutes = 10;  // Re-sync open/closed state every N minutes
input int    ReconcileDays    = 14;  // Rolling window to re-send recent closes each cycle

//--- constants
#define BIGMARKT_VERSION "2.7.1"

//--- backfill / reconcile state
bool g_backfilling = false;  // true while replaying history → adds "backfill":true
int  g_phase       = 0;      // 0 = first timer tick (deep backfill + reconcile), 1 = repeating reconcile

//+------------------------------------------------------------------+
//| v2.7.1 — open position record for the snapshot mirror             |
//+------------------------------------------------------------------+
struct BmOpenPos
{
   long     id;
   string   sym;       // raw broker symbol
   string   symUp;     // uppercased (used in the hash)
   string   dir;       // "buy" | "sell"
   double   lots;
   double   open;
   double   sl;
   double   tp;
   datetime otime;
};

//+------------------------------------------------------------------+
//| Utility: convert deal type to string                              |
//+------------------------------------------------------------------+
string DealTypeToString(ENUM_DEAL_TYPE dealType)
{
   switch(dealType)
   {
      case DEAL_TYPE_BUY:  return "buy";
      case DEAL_TYPE_SELL: return "sell";
      default:             return "unknown";
   }
}

//+------------------------------------------------------------------+
//| Utility: convert order type to string                             |
//+------------------------------------------------------------------+
string PendingOrderTypeToString(ENUM_ORDER_TYPE orderType)
{
   switch(orderType)
   {
      case ORDER_TYPE_BUY:             return "buy";
      case ORDER_TYPE_SELL:            return "sell";
      case ORDER_TYPE_BUY_LIMIT:       return "buy_limit";
      case ORDER_TYPE_SELL_LIMIT:      return "sell_limit";
      case ORDER_TYPE_BUY_STOP:        return "buy_stop";
      case ORDER_TYPE_SELL_STOP:       return "sell_stop";
      case ORDER_TYPE_BUY_STOP_LIMIT:  return "buy_stop_limit";
      case ORDER_TYPE_SELL_STOP_LIMIT: return "sell_stop_limit";
      default:                         return "unknown";
   }
}

//+------------------------------------------------------------------+
//| Utility: escape JSON string values                                |
//+------------------------------------------------------------------+
string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "\\r");
   StringReplace(s, "\t", "\\t");
   return s;
}

//+------------------------------------------------------------------+
//| Utility: format datetime as ISO 8601                              |
//+------------------------------------------------------------------+
string ToISO8601(datetime dt)
{
   MqlDateTime mdt;
   TimeToStruct(dt, mdt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      mdt.year, mdt.mon, mdt.day,
      mdt.hour, mdt.min, mdt.sec);
}

//+------------------------------------------------------------------+
//| Utility: double to canonical JS-compatible string                 |
//+------------------------------------------------------------------+
string DoubleToCanonical(double v)
{
   if(v == MathFloor(v) && v == MathCeil(v) && MathAbs(v) < 9007199254740992.0)
      return IntegerToString((long)v);

   string s = DoubleToString(v, 10);
   int dot = StringFind(s, ".");
   if(dot >= 0)
   {
      int len = StringLen(s);
      while(len > dot + 2 && StringGetCharacter(s, len - 1) == '0')
         len--;
      s = StringSubstr(s, 0, len);
   }
   return s;
}

//+------------------------------------------------------------------+
//| Utility: string to UTF-8 bytes, no null terminator               |
//+------------------------------------------------------------------+
void StringToUTF8(const string s, uchar &bytes[])
{
   int n = StringToCharArray(s, bytes, 0, WHOLE_ARRAY, 65001);
   if(n > 0 && ArraySize(bytes) > 0)
      ArrayResize(bytes, ArraySize(bytes) - 1);
}

//+------------------------------------------------------------------+
//| Utility: SHA-256 hash of a byte array                            |
//+------------------------------------------------------------------+
bool Sha256(const uchar &data[], uchar &hash[])
{
   uchar emptyKey[];
   return (CryptEncode(CRYPT_HASH_SHA256, data, emptyKey, hash) > 0);
}

//+------------------------------------------------------------------+
//| Utility: parse one hex character to its value, -1 if invalid     |
//+------------------------------------------------------------------+
int HexNibble(ushort c)
{
   if(c >= '0' && c <= '9') return (int)(c - '0');
   if(c >= 'a' && c <= 'f') return (int)(c - 'a' + 10);
   if(c >= 'A' && c <= 'F') return (int)(c - 'A' + 10);
   return -1;
}

//+------------------------------------------------------------------+
//| Utility: decode hex string to byte array (case-insensitive)      |
//+------------------------------------------------------------------+
bool HexDecode(const string hexStr, uchar &bytes[])
{
   int len = StringLen(hexStr);
   if(len == 0 || len % 2 != 0) return false;
   int n = len / 2;
   ArrayResize(bytes, n);
   for(int i = 0; i < n; i++)
   {
      int hi = HexNibble(StringGetCharacter(hexStr, i * 2));
      int lo = HexNibble(StringGetCharacter(hexStr, i * 2 + 1));
      if(hi < 0 || lo < 0) return false;
      bytes[i] = (uchar)((hi << 4) | lo);
   }
   return true;
}

//+------------------------------------------------------------------+
//| Utility: encode byte array to lowercase hex string               |
//+------------------------------------------------------------------+
string HexEncode(const uchar &bytes[])
{
   string hexChars = "0123456789abcdef";
   string result = "";
   int n = ArraySize(bytes);
   for(int i = 0; i < n; i++)
   {
      result += StringSubstr(hexChars, (bytes[i] >> 4) & 0xF, 1);
      result += StringSubstr(hexChars, bytes[i] & 0xF, 1);
   }
   return result;
}

//+------------------------------------------------------------------+
//| Utility: HMAC-SHA256                                              |
//+------------------------------------------------------------------+
bool HmacSha256(const uchar &keyIn[], const uchar &msg[], uchar &mac[])
{
   int blockSize = 64;

   uchar k[];
   if(ArraySize(keyIn) > blockSize)
   {
      if(!Sha256(keyIn, k)) return false;
   }
   else
   {
      ArrayCopy(k, keyIn);
   }

   int keyLen = ArraySize(k);
   ArrayResize(k, blockSize);
   for(int i = keyLen; i < blockSize; i++)
      k[i] = 0;

   uchar ipadKey[], opadKey[];
   ArrayResize(ipadKey, blockSize);
   ArrayResize(opadKey, blockSize);
   for(int i = 0; i < blockSize; i++)
   {
      ipadKey[i] = (uchar)(k[i] ^ 0x36);
      opadKey[i] = (uchar)(k[i] ^ 0x5C);
   }

   int msgLen = ArraySize(msg);
   uchar innerInput[];
   ArrayResize(innerInput, blockSize + msgLen);
   ArrayCopy(innerInput, ipadKey, 0, 0, blockSize);
   if(msgLen > 0)
      ArrayCopy(innerInput, msg, blockSize, 0, msgLen);

   uchar innerHash[];
   if(!Sha256(innerInput, innerHash)) return false;

   int innerLen = ArraySize(innerHash);
   uchar outerInput[];
   ArrayResize(outerInput, blockSize + innerLen);
   ArrayCopy(outerInput, opadKey, 0, 0, blockSize);
   ArrayCopy(outerInput, innerHash, blockSize, 0, innerLen);

   return Sha256(outerInput, mac);
}

//+------------------------------------------------------------------+
//| Generate nonce — SHA-256 of entropy sources, truncated to 32 hex |
//+------------------------------------------------------------------+
string GenerateNonce()
{
   static uint s_counter = 0;
   s_counter++;

   string entropy =
      IntegerToString(GetTickCount())           + "|" +
      IntegerToString(GetMicrosecondCount())    + "|" +
      DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_ASK), 10) + "|" +
      DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), 10) + "|" +
      IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "|" +
      IntegerToString(s_counter);

   uchar msgBytes[], hashBytes[];
   StringToUTF8(entropy, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return IntegerToString(GetTickCount());
   return StringSubstr(HexEncode(hashBytes), 0, 32);
}

//+------------------------------------------------------------------+
//| Compute SHA-256 of the canonical trade-fields bundle              |
//+------------------------------------------------------------------+
string ComputeTradeFieldsHash(
   ulong   ticket,
   string  symbol,
   string  tradeType,
   double  lots,
   double  openPrice,
   double  closePrice,
   string  openTime,
   string  closeTime,
   double  profit,
   double  swap,
   double  commission,
   long    magic,
   string  comment,
   double  sl,
   double  tp,
   double  rMultiple)
{
   string lines =
      "ticket="      + IntegerToString(ticket)           + "\n" +
      "symbol="      + symbol                            + "\n" +
      "type="        + tradeType                         + "\n" +
      "lots="        + DoubleToCanonical(lots)            + "\n" +
      "open_price="  + DoubleToCanonical(openPrice)       + "\n" +
      "close_price=" + DoubleToCanonical(closePrice)      + "\n" +
      "open_time="   + openTime                          + "\n" +
      "close_time="  + closeTime                         + "\n" +
      "profit="      + DoubleToCanonical(profit)          + "\n" +
      "swap="        + DoubleToCanonical(swap)            + "\n" +
      "commission="  + DoubleToCanonical(commission)      + "\n" +
      "magic="       + IntegerToString(magic)             + "\n" +
      "comment="     + comment;

   uchar msgBytes[], hashBytes[];
   StringToUTF8(lines, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return "";
   return HexEncode(hashBytes);
}

//+------------------------------------------------------------------+
//| Compute canonical hash for pending order events                   |
//+------------------------------------------------------------------+
string ComputeOrderFieldsHash(
   ulong   orderTicket,
   string  symbol,
   string  orderType,
   double  lots,
   double  orderPrice,
   double  sl,
   double  tp,
   string  orderTime,
   long    magic,
   string  comment,
   string  eventType)
{
   string lines =
      "order_ticket=" + IntegerToString(orderTicket)    + "\n" +
      "symbol="       + symbol                          + "\n" +
      "type="         + orderType                       + "\n" +
      "lots="         + DoubleToCanonical(lots)          + "\n" +
      "order_price="  + DoubleToCanonical(orderPrice)    + "\n" +
      "sl="           + DoubleToCanonical(sl)            + "\n" +
      "tp="           + DoubleToCanonical(tp)            + "\n" +
      "order_time="   + orderTime                       + "\n" +
      "magic="        + IntegerToString(magic)           + "\n" +
      "comment="      + comment                         + "\n" +
      "event_type="   + eventType;

   uchar msgBytes[], hashBytes[];
   StringToUTF8(lines, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return "";
   return HexEncode(hashBytes);
}

//+------------------------------------------------------------------+
//| v2.5.0 — Compute canonical hash for position_modify events        |
//+------------------------------------------------------------------+
string ComputePositionFieldsHash(
   ulong   positionId,
   string  symbol,
   double  sl,
   double  tp,
   string  eventType)
{
   string lines =
      "event_type="  + eventType                       + "\n" +
      "position_id=" + IntegerToString(positionId)      + "\n" +
      "symbol="      + symbol                           + "\n" +
      "sl="          + DoubleToCanonical(sl)             + "\n" +
      "tp="          + DoubleToCanonical(tp);

   uchar msgBytes[], hashBytes[];
   StringToUTF8(lines, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return "";
   return HexEncode(hashBytes);
}

//+------------------------------------------------------------------+
//| v2.7.1 — canonical hash for open_snapshot (full mirror)           |
//| Lines (LF-joined, NO trailing newline):                           |
//|   event_type=open_snapshot                                        |
//|   position=<id>|<SYM>|<dir>|<lots>|<open>|<sl>|<tp>|<openTimeISO>  |
//|     (one line per open position, ASCENDING by position_id)        |
//|   pending=<ticket csv, ASCENDING>                                 |
//+------------------------------------------------------------------+
string ComputeSnapshotFieldsHash(const BmOpenPos &pos[], const int nPos,
                                 const long &pend[], const int nPend)
{
   string lines = "event_type=open_snapshot";

   for(int i = 0; i < nPos; i++)
   {
      lines += "\nposition=" +
         IntegerToString(pos[i].id)      + "|" +
         pos[i].symUp                    + "|" +
         pos[i].dir                      + "|" +
         DoubleToCanonical(pos[i].lots)  + "|" +
         DoubleToCanonical(pos[i].open)  + "|" +
         DoubleToCanonical(pos[i].sl)    + "|" +
         DoubleToCanonical(pos[i].tp)    + "|" +
         ToISO8601(pos[i].otime);
   }

   string pendCsv = "";
   for(int i = 0; i < nPend; i++)
   {
      if(i > 0) pendCsv += ",";
      pendCsv += IntegerToString(pend[i]);
   }
   lines += "\npending=" + pendCsv;

   uchar msgBytes[], hashBytes[];
   StringToUTF8(lines, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return "";
   return HexEncode(hashBytes);
}

//+------------------------------------------------------------------+
//| Compute v2 HMAC-SHA256 envelope signature                        |
//+------------------------------------------------------------------+
string ComputeSignature(
   const string tokenId,
   const string sentAt,
   const string nonce,
   const string fieldHash,
   const string signingSecretHex)
{
   string message = "v2\n" + tokenId + "\n" + sentAt + "\n" + nonce + "\n" + fieldHash;

   uchar keyBytes[], msgBytes[], mac[];
   if(!HexDecode(signingSecretHex, keyBytes)) return "";
   StringToUTF8(message, msgBytes);
   if(!HmacSha256(keyBytes, msgBytes, mac)) return "";
   return HexEncode(mac);
}

//+------------------------------------------------------------------+
//| v2.4.0 — Startup crypto self-test                                 |
//+------------------------------------------------------------------+
bool RunCryptoSelfTest()
{
   uchar msg1[], h1[];
   StringToUTF8("abc", msg1);
   if(!Sha256(msg1, h1) ||
      HexEncode(h1) != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
   {
      Print("BigMarkt self-test FAIL 1/4: SHA-256");
      return false;
   }

   uchar rb[];
   if(!HexDecode("00ff10ab5cC4", rb) || HexEncode(rb) != "00ff10ab5cc4")
   {
      Print("BigMarkt self-test FAIL 2/4: HexDecode");
      return false;
   }

   uchar key3[], msg3[], mac3[];
   StringToUTF8("Jefe", key3);
   StringToUTF8("what do ya want for nothing?", msg3);
   if(!HmacSha256(key3, msg3, mac3) ||
      HexEncode(mac3) != "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843")
   {
      Print("BigMarkt self-test FAIL 3/4: HMAC-SHA256 (RFC 4231)");
      return false;
   }

   string sig = ComputeSignature(
      "selftest-token",
      "2026-01-01T00:00:00Z",
      "0123456789abcdef0123456789abcdef",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
   if(sig != "bb41ab6ca2edaf173562791f79b3a6903d82c569061d2bf13827f5bb4de52a20")
   {
      Print("BigMarkt self-test FAIL 4/4: signature pipeline. Got: ", sig);
      return false;
   }

   return true;
}

//+------------------------------------------------------------------+
//| Shared HTTP POST helper                                           |
//| v2.5.0 — appends account snapshot (unsigned passthrough).         |
//| v2.6.0 — appends "backfill":true while replaying history.         |
//+------------------------------------------------------------------+
void HttpPost(string json, string fieldHash)
{
   // --- account snapshot — unsigned passthrough (not hashed) ---
   json += ",\"account_balance\":"  + DoubleToCanonical(AccountInfoDouble(ACCOUNT_BALANCE));
   json += ",\"account_equity\":"   + DoubleToCanonical(AccountInfoDouble(ACCOUNT_EQUITY));
   json += ",\"account_currency\":\"" + JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)) + "\"";

   // --- v2.6.0: mark backfilled / swept events — unsigned passthrough (not hashed) ---
   if(g_backfilling)
      json += ",\"backfill\":true";

   string headers = "Content-Type: application/json\r\n";
   headers += "Authorization: Bearer " + ApiToken + "\r\n";

   bool useV2 = StringLen(SigningSecret) > 0 && StringLen(TokenId) > 0;

   if(useV2)
   {
      string sentAt = ToISO8601(TimeGMT());
      string nonce  = GenerateNonce();
      string sig    = ComputeSignature(TokenId, sentAt, nonce, fieldHash, SigningSecret);

      if(StringLen(sig) == 0)
      {
         if(DebugMode) Print("BigMarkt: signature failed — aborting");
         return;
      }

      json += ",\"sent_at\":\""    + sentAt    + "\"";
      json += ",\"nonce\":\""      + nonce     + "\"";
      json += ",\"sig\":\""        + sig       + "\"";
      json += ",\"field_hash\":\"" + fieldHash + "\"";

      headers += "X-Ingest-Protocol: v2\r\n";
      headers += "X-BigMarkt-Token-Id: "   + TokenId                          + "\r\n";
      headers += "X-BigMarkt-Signature: "  + sig                              + "\r\n";
      headers += "X-BigMarkt-Timestamp: "  + IntegerToString((long)TimeGMT()) + "\r\n";
      headers += "X-BigMarkt-Nonce: "      + nonce                            + "\r\n";
   }
   else
   {
      if(DebugMode)
         Print("BigMarkt: [DEPRECATED] v1 mode — set TokenId and SigningSecret.");
   }

   json += "}";

   char   post[];
   char   result[];
   string resultHeaders;
   StringToCharArray(json, post, 0, StringLen(json));

   int res = WebRequest("POST", ApiEndpoint, headers, 10000, post, result, resultHeaders);

   if(DebugMode)
   {
      if(res == 200)
         Print("BigMarkt: sent OK — ", CharArrayToString(result));
      else
         Print("BigMarkt: HTTP ", res, " — ", CharArrayToString(result));
   }
}

//+------------------------------------------------------------------+
//| Send a single deal (market open/close)                            |
//+------------------------------------------------------------------+
void SendDeal(ulong dealTicket)
{
   if(!HistoryDealSelect(dealTicket))
   {
      if(DebugMode) Print("BigMarkt: HistoryDealSelect failed for ticket ", dealTicket);
      return;
   }

   ENUM_DEAL_TYPE  dealType  = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);

   if(dealEntry != DEAL_ENTRY_IN && dealEntry != DEAL_ENTRY_OUT)
      return;

   // v2.6.0 — skip non-trade deals (balance/credit/correction/charge → empty symbol)
   if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL)
      return;

   string   symbol     = HistoryDealGetString(dealTicket,  DEAL_SYMBOL);
   double   price      = HistoryDealGetDouble(dealTicket,  DEAL_PRICE);
   double   lots       = HistoryDealGetDouble(dealTicket,  DEAL_VOLUME);
   double   profit     = HistoryDealGetDouble(dealTicket,  DEAL_PROFIT);
   double   swap       = HistoryDealGetDouble(dealTicket,  DEAL_SWAP);
   double   commission = HistoryDealGetDouble(dealTicket,  DEAL_COMMISSION);
   long     magic      = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   string   comment    = HistoryDealGetString(dealTicket,  DEAL_COMMENT);
   double   sl         = HistoryDealGetDouble(dealTicket,  DEAL_SL);
   double   tp         = HistoryDealGetDouble(dealTicket,  DEAL_TP);
   ulong    positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

   datetime dealTime   = (datetime)(HistoryDealGetInteger(dealTicket, DEAL_TIME_MSC) / 1000);
   string   typeStr    = DealTypeToString(dealType);
   string   dealTimeStr = ToISO8601(dealTime);
   string   symbolUp   = symbol;
   StringToUpper(symbolUp);

   double openPrice    = 0;
   double closePrice   = 0;
   string openTimeStr  = "";
   string closeTimeStr = "";
   double rMultiple    = 0;

   if(dealEntry == DEAL_ENTRY_IN)
   {
      openPrice   = price;
      openTimeStr = dealTimeStr;
   }
   else
   {
      closePrice   = price;
      closeTimeStr = dealTimeStr;

      int totalDeals = HistoryDealsTotal();
      for(int i = totalDeals - 1; i >= 0; i--)
      {
         ulong hTicket = HistoryDealGetTicket(i);
         if(hTicket == 0) continue;
         if((ulong)HistoryDealGetInteger(hTicket, DEAL_POSITION_ID) != positionId) continue;
         if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(hTicket, DEAL_ENTRY) != DEAL_ENTRY_IN) continue;

         openPrice = HistoryDealGetDouble(hTicket, DEAL_PRICE);
         datetime openTimeDt = (datetime)(HistoryDealGetInteger(hTicket, DEAL_TIME_MSC) / 1000);
         openTimeStr = ToISO8601(openTimeDt);

         double slFromOpen = HistoryDealGetDouble(hTicket, DEAL_SL);
         if(slFromOpen == 0) slFromOpen = sl;
         if(slFromOpen != 0 && openPrice != 0)
         {
            double riskPips = 0;
            double gainPips = 0;
            if(dealType == DEAL_TYPE_BUY)
            {
               riskPips = slFromOpen - openPrice;
               gainPips = openPrice - closePrice;
            }
            else
            {
               riskPips = openPrice - slFromOpen;
               gainPips = closePrice - openPrice;
            }
            if(riskPips != 0)
               rMultiple = gainPips / riskPips;
         }
         break;
      }
   }

   string json = "{";
   json += "\"ticket\":"        + IntegerToString(dealTicket)                 + ",";
   json += "\"position_id\":"   + IntegerToString(positionId)                 + ",";
   json += "\"deal_entry\":\""  + (dealEntry == DEAL_ENTRY_IN ? "in" : "out") + "\",";
   json += "\"symbol\":\""      + JsonEscape(symbol)                          + "\",";
   json += "\"type\":\""        + typeStr                                     + "\",";
   json += "\"lots\":"          + DoubleToCanonical(lots)                     + ",";
   json += "\"open_price\":"    + DoubleToCanonical(openPrice)                + ",";
   json += "\"close_price\":"   + DoubleToCanonical(closePrice)               + ",";
   json += "\"open_time\":\""   + openTimeStr                                 + "\",";
   json += "\"close_time\":\""  + closeTimeStr                                + "\",";
   json += "\"profit\":"        + DoubleToCanonical(profit)                   + ",";
   json += "\"swap\":"          + DoubleToCanonical(swap)                     + ",";
   json += "\"commission\":"    + DoubleToCanonical(commission)               + ",";
   json += "\"sl\":"            + DoubleToCanonical(sl)                       + ",";
   json += "\"tp\":"            + DoubleToCanonical(tp)                       + ",";
   json += "\"r_multiple\":"    + DoubleToCanonical(rMultiple)                + ",";
   json += "\"magic\":"         + IntegerToString(magic)                      + ",";
   json += "\"comment\":\""     + JsonEscape(comment)                         + "\"";

   string fieldHash = ComputeTradeFieldsHash(
      dealTicket, symbolUp, typeStr,
      lots, openPrice, closePrice,
      openTimeStr, closeTimeStr,
      profit, swap, commission,
      magic, comment,
      sl, tp, rMultiple);

   if(StringLen(fieldHash) == 0)
   {
      if(DebugMode) Print("BigMarkt: hash failed for ticket ", dealTicket, " — aborting");
      return;
   }

   if(DebugMode)
      Print("BigMarkt: sending deal ticket ", dealTicket, " symbol ", symbol,
            " entry ", (dealEntry == DEAL_ENTRY_IN ? "OPEN" : "CLOSE"),
            (g_backfilling ? " [backfill]" : ""));

   HttpPost(json, fieldHash);
}

//+------------------------------------------------------------------+
//| Send a pending order event (add/update/delete)                    |
//+------------------------------------------------------------------+
void SendOrderEvent(ulong orderTicket, string eventType)
{
   bool selected = OrderSelect(orderTicket);

   if(!selected)
   {
      datetime from = (datetime)(TimeCurrent() - 86400);
      datetime to   = TimeCurrent() + 60;
      HistorySelect(from, to);
      selected = HistoryOrderSelect(orderTicket);
      if(!selected)
      {
         if(DebugMode) Print("BigMarkt: OrderSelect failed for order ticket ", orderTicket);
         return;
      }
   }

   string symbol    = "";
   string typeStr   = "";
   double lots      = 0;
   double orderPrice = 0;
   double sl        = 0;
   double tp        = 0;
   long   magic     = 0;
   string comment   = "";
   datetime orderTime;

   if(selected && OrderSelect(orderTicket))
   {
      symbol     = OrderGetString(ORDER_SYMBOL);
      typeStr    = PendingOrderTypeToString((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE));
      lots       = OrderGetDouble(ORDER_VOLUME_CURRENT);
      orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
      sl         = OrderGetDouble(ORDER_SL);
      tp         = OrderGetDouble(ORDER_TP);
      magic      = OrderGetInteger(ORDER_MAGIC);
      comment    = OrderGetString(ORDER_COMMENT);
      orderTime  = (datetime)(OrderGetInteger(ORDER_TIME_SETUP_MSC) / 1000);
   }
   else
   {
      symbol     = HistoryOrderGetString(orderTicket, ORDER_SYMBOL);
      typeStr    = PendingOrderTypeToString((ENUM_ORDER_TYPE)HistoryOrderGetInteger(orderTicket, ORDER_TYPE));
      lots       = HistoryOrderGetDouble(orderTicket, ORDER_VOLUME_CURRENT);
      orderPrice = HistoryOrderGetDouble(orderTicket, ORDER_PRICE_OPEN);
      sl         = HistoryOrderGetDouble(orderTicket, ORDER_SL);
      tp         = HistoryOrderGetDouble(orderTicket, ORDER_TP);
      magic      = HistoryOrderGetInteger(orderTicket, ORDER_MAGIC);
      comment    = HistoryOrderGetString(orderTicket, ORDER_COMMENT);
      orderTime  = (datetime)(HistoryOrderGetInteger(orderTicket, ORDER_TIME_SETUP_MSC) / 1000);
   }

   if(FilterMagic >= 0 && magic != (long)FilterMagic)
   {
      if(DebugMode) Print("BigMarkt: skipping order ", orderTicket, " — magic filter");
      return;
   }

   string symbolUp = symbol;
   StringToUpper(symbolUp);
   string orderTimeStr = ToISO8601(orderTime);

   string json = "{";
   json += "\"event_type\":\""  + eventType                       + "\",";
   json += "\"order_ticket\":"  + IntegerToString(orderTicket)    + ",";
   json += "\"symbol\":\""      + JsonEscape(symbol)              + "\",";
   json += "\"type\":\""        + typeStr                         + "\",";
   json += "\"lots\":"          + DoubleToCanonical(lots)         + ",";
   json += "\"open_price\":"    + DoubleToCanonical(orderPrice)   + ",";
   json += "\"sl\":"            + DoubleToCanonical(sl)           + ",";
   json += "\"tp\":"            + DoubleToCanonical(tp)           + ",";
   json += "\"order_time\":\""  + orderTimeStr                    + "\",";
   json += "\"magic\":"         + IntegerToString(magic)          + ",";
   json += "\"comment\":\""     + JsonEscape(comment)             + "\"";

   string fieldHash = ComputeOrderFieldsHash(
      orderTicket, symbolUp, typeStr,
      lots, orderPrice, sl, tp,
      orderTimeStr, magic, comment, eventType);

   if(StringLen(fieldHash) == 0)
   {
      if(DebugMode) Print("BigMarkt: order hash failed for ticket ", orderTicket, " — aborting");
      return;
   }

   if(DebugMode)
      Print("BigMarkt: sending order event ", eventType, " ticket ", orderTicket, " symbol ", symbol);

   HttpPost(json, fieldHash);
}

//+------------------------------------------------------------------+
//| v2.5.0 — Send a position modification (SL/TP changed while open)  |
//+------------------------------------------------------------------+
void SendPositionModify(ulong positionTicket)
{
   if(!PositionSelectByTicket(positionTicket))
   {
      if(DebugMode) Print("BigMarkt: PositionSelectByTicket failed for ticket ", positionTicket);
      return;
   }

   long magic = PositionGetInteger(POSITION_MAGIC);
   if(FilterMagic >= 0 && magic != (long)FilterMagic)
   {
      if(DebugMode) Print("BigMarkt: skipping position ", positionTicket, " — magic filter");
      return;
   }

   ulong  positionId = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
   string symbol     = PositionGetString(POSITION_SYMBOL);
   double sl         = PositionGetDouble(POSITION_SL);
   double tp         = PositionGetDouble(POSITION_TP);

   string symbolUp = symbol;
   StringToUpper(symbolUp);

   string eventTimeStr = ToISO8601(TimeCurrent());

   string json = "{";
   json += "\"event_type\":\"position_modify\",";
   json += "\"position_id\":"  + IntegerToString(positionId)  + ",";
   json += "\"symbol\":\""     + JsonEscape(symbol)           + "\",";
   json += "\"sl\":"           + DoubleToCanonical(sl)        + ",";
   json += "\"tp\":"           + DoubleToCanonical(tp)        + ",";
   json += "\"magic\":"        + IntegerToString(magic)       + ",";
   json += "\"event_time\":\"" + eventTimeStr                 + "\"";

   string fieldHash = ComputePositionFieldsHash(positionId, symbolUp, sl, tp, "position_modify");

   if(StringLen(fieldHash) == 0)
   {
      if(DebugMode) Print("BigMarkt: position hash failed for ticket ", positionTicket, " — aborting");
      return;
   }

   if(DebugMode)
      Print("BigMarkt: sending position_modify position_id ", positionId,
            " sl ", sl, " tp ", tp);

   HttpPost(json, fieldHash);
}

//+------------------------------------------------------------------+
//| v2.6.0 — backfill watermark GlobalVariable name (per account)     |
//+------------------------------------------------------------------+
string BackfillGVName()
{
   return "BigMarkt_LastBackfill_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
}

//+------------------------------------------------------------------+
//| v2.6.0 — Replay missed closed trades on startup (deep, one-shot)  |
//| READ ONLY. Reuses SendDeal → real DEAL_TIME timestamps, real P&L. |
//| Server dedupes by deal ticket, so re-sends never duplicate.       |
//+------------------------------------------------------------------+
void RunBackfill()
{
   datetime now      = TimeCurrent();
   datetime fromDays = (datetime)(now - (long)BackfillDays * 86400);

   datetime watermark = 0;
   string gv = BackfillGVName();
   if(!BackfillForce && GlobalVariableCheck(gv))
      watermark = (datetime)GlobalVariableGet(gv);

   // Select the FULL window so every OUT deal can find its matching IN deal.
   if(!HistorySelect(fromDays, now + 60))
   {
      if(DebugMode) Print("BigMarkt backfill: HistorySelect failed");
      return;
   }

   int total = HistoryDealsTotal();
   datetime newest = watermark;
   int sent = 0;

   g_backfilling = true;
   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(t == 0) continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(t, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_IN && entry != DEAL_ENTRY_OUT) continue;  // skip balance/credit ops

      ENUM_DEAL_TYPE dtype = (ENUM_DEAL_TYPE)HistoryDealGetInteger(t, DEAL_TYPE);
      if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL) continue;  // skip non-trade deals

      long mg = HistoryDealGetInteger(t, DEAL_MAGIC);
      if(FilterMagic >= 0 && mg != (long)FilterMagic) continue;

      datetime dt = (datetime)(HistoryDealGetInteger(t, DEAL_TIME_MSC) / 1000);
      if(!BackfillForce && watermark > 0 && dt <= watermark) continue;  // already sent

      SendDeal(t);           // reuses the live signed path
      sent++;
      if(dt > newest) newest = dt;

      Sleep(150);            // gentle throttle — don't hammer the endpoint
   }
   g_backfilling = false;

   if(newest > 0)
      GlobalVariableSet(gv, (double)newest);

   if(DebugMode)
      Print("BigMarkt backfill: scanned ", total, " deals, sent ", sent,
            " new. Watermark now ", ToISO8601(newest));
}

//+------------------------------------------------------------------+
//| v2.7.1 — Send authoritative open-STATE snapshot (full mirror).    |
//| Server uses this to: OPEN positions it's missing, CLOSE orphans   |
//| it still shows open, REPAIR lots/SL/TP that drifted offline, and  |
//| CANCEL stuck pending rows whose order ticket is no longer live.   |
//| Carries full position detail + live pending order tickets.        |
//| GUARD: only sent when terminal connected (never empty-by-error).  |
//+------------------------------------------------------------------+
void SendOpenSnapshot()
{
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      if(DebugMode) Print("BigMarkt reconcile: terminal not connected — skipping snapshot");
      return;
   }

   // --- collect open positions ---
   BmOpenPos pos[];
   int nPos = 0;
   int totalPos = PositionsTotal();
   for(int i = 0; i < totalPos; i++)
   {
      ulong posTicket = PositionGetTicket(i);
      if(posTicket == 0) continue;
      if(!PositionSelectByTicket(posTicket)) continue;
      long mg = PositionGetInteger(POSITION_MAGIC);
      if(FilterMagic >= 0 && mg != (long)FilterMagic) continue;

      ArrayResize(pos, nPos + 1);
      pos[nPos].id    = (long)PositionGetInteger(POSITION_IDENTIFIER);
      pos[nPos].sym   = PositionGetString(POSITION_SYMBOL);
      pos[nPos].symUp = pos[nPos].sym; StringToUpper(pos[nPos].symUp);
      pos[nPos].dir   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "buy" : "sell");
      pos[nPos].lots  = PositionGetDouble(POSITION_VOLUME);
      pos[nPos].open  = PositionGetDouble(POSITION_PRICE_OPEN);
      pos[nPos].sl    = PositionGetDouble(POSITION_SL);
      pos[nPos].tp    = PositionGetDouble(POSITION_TP);
      pos[nPos].otime = (datetime)PositionGetInteger(POSITION_TIME);
      nPos++;
   }

   // insertion sort ascending by position id (canonical order for the hash)
   for(int i = 1; i < nPos; i++)
   {
      BmOpenPos key = pos[i];
      int j = i - 1;
      while(j >= 0 && pos[j].id > key.id) { pos[j + 1] = pos[j]; j--; }
      pos[j + 1] = key;
   }

   // --- collect live pending order tickets ---
   long pend[];
   int nPend = 0;
   int totalOrd = OrdersTotal();
   for(int i = 0; i < totalOrd; i++)
   {
      ulong ordTicket = OrderGetTicket(i);
      if(ordTicket == 0) continue;
      if(!OrderSelect(ordTicket)) continue;
      long mg = OrderGetInteger(ORDER_MAGIC);
      if(FilterMagic >= 0 && mg != (long)FilterMagic) continue;
      ArrayResize(pend, nPend + 1);
      pend[nPend] = (long)ordTicket;
      nPend++;
   }
   if(nPend > 1) ArraySort(pend);

   // --- build positions JSON ---
   string posJson = "[";
   for(int i = 0; i < nPos; i++)
   {
      if(i > 0) posJson += ",";
      posJson += "{";
      posJson += "\"position_id\":" + IntegerToString(pos[i].id)     + ",";
      posJson += "\"symbol\":\""    + JsonEscape(pos[i].sym)         + "\",";
      posJson += "\"type\":\""      + pos[i].dir                     + "\",";
      posJson += "\"lots\":"        + DoubleToCanonical(pos[i].lots)  + ",";
      posJson += "\"open_price\":"  + DoubleToCanonical(pos[i].open)  + ",";
      posJson += "\"sl\":"          + DoubleToCanonical(pos[i].sl)    + ",";
      posJson += "\"tp\":"          + DoubleToCanonical(pos[i].tp)    + ",";
      posJson += "\"open_time\":\"" + ToISO8601(pos[i].otime)        + "\"";
      posJson += "}";
   }
   posJson += "]";

   // --- build pending tickets JSON ---
   string pendJson = "[";
   for(int i = 0; i < nPend; i++)
   {
      if(i > 0) pendJson += ",";
      pendJson += IntegerToString(pend[i]);
   }
   pendJson += "]";

   string json = "{";
   json += "\"event_type\":\"open_snapshot\",";
   json += "\"positions\":"       + posJson  + ",";
   json += "\"pending_tickets\":" + pendJson;

   string fieldHash = ComputeSnapshotFieldsHash(pos, nPos, pend, nPend);
   if(StringLen(fieldHash) == 0)
   {
      if(DebugMode) Print("BigMarkt: snapshot hash failed — aborting");
      return;
   }

   if(DebugMode)
      Print("BigMarkt: sending open_snapshot — ", nPos, " open, ", nPend, " pending");

   HttpPost(json, fieldHash);
}

//+------------------------------------------------------------------+
//| v2.7.0 — Reconcile cycle: close-sweep, then open-state snapshot.  |
//| Runs on a repeating timer — no restart or property change needed. |
//+------------------------------------------------------------------+
void RunReconcile()
{
   // 1) CLOSE-SWEEP — re-send every recent CLOSE deal (ignore watermark).
   //    Server idempotency (0067) makes re-sends free; this delivers any
   //    close that happened while the EA was offline so the open row closes.
   datetime now  = TimeCurrent();
   datetime from = (datetime)(now - (long)ReconcileDays * 86400);

   if(HistorySelect(from, now + 60))
   {
      int total = HistoryDealsTotal();
      int swept = 0;
      g_backfilling = true;   // recent closes are historical → guard balance stamping
      for(int i = 0; i < total; i++)
      {
         ulong t = HistoryDealGetTicket(i);
         if(t == 0) continue;
         if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(t, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue; // closes only
         ENUM_DEAL_TYPE dtype = (ENUM_DEAL_TYPE)HistoryDealGetInteger(t, DEAL_TYPE);
         if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL) continue;
         long mg = HistoryDealGetInteger(t, DEAL_MAGIC);
         if(FilterMagic >= 0 && mg != (long)FilterMagic) continue;
         SendDeal(t);
         swept++;
         Sleep(150);
      }
      g_backfilling = false;
      if(DebugMode) Print("BigMarkt reconcile: close-sweep re-sent ", swept,
                          " close deal(s) over ", ReconcileDays, "d");
   }
   else if(DebugMode) Print("BigMarkt reconcile: close-sweep HistorySelect failed");

   // 2) OPEN-STATE SNAPSHOT — server opens missing, closes orphans,
   //    repairs lots/SL/TP, and cancels stuck pending rows.
   SendOpenSnapshot();
}

//+------------------------------------------------------------------+
//| OnInit                                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiToken) == 0)
   {
      Alert("BigMarkt EA: Bearer Token not set. Go to journal.bigmarkt.co/ea-setup to copy all 3 values.");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringLen(SigningSecret) == 0)
   {
      Print("BigMarkt EA: WARNING — SigningSecret not set. Running in v1 mode (deprecated).");
   }
   else if(StringLen(TokenId) == 0)
   {
      Alert("BigMarkt EA: SigningSecret is set but TokenId is empty. Copy all 3 values from /ea-setup.");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(!RunCryptoSelfTest())
   {
      Alert("BigMarkt EA: crypto self-test FAILED. EA disabled. Check Experts log and report to support.");
      return INIT_FAILED;
   }

   if(DebugMode)
      Print("BigMarkt EA v", BIGMARKT_VERSION, " initialised. Crypto self-test: PASSED. Endpoint: ",
            ApiEndpoint, " Protocol: ", (StringLen(SigningSecret) > 0 ? "v2" : "v1 (deprecated)"));

   // v2.7.0 — phased timer: first tick does the deep backfill + a reconcile,
   // then the timer repeats RunReconcile() every ReconcileMinutes. No restart
   // and no property change is ever required after the first setup.
   g_phase = 0;
   EventSetTimer(5);   // first tick shortly after attach

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| OnTimer — phase 0: deep backfill + reconcile; then repeat reconcile|
//+------------------------------------------------------------------+
void OnTimer()
{
   if(g_phase == 0)
   {
      g_phase = 1;
      EventKillTimer();

      if(BackfillOnStart)
         RunBackfill();          // one-shot deep historical replay (watermarked)

      RunReconcile();            // close-sweep + open-state snapshot

      int iv = ReconcileMinutes;
      if(iv < 1) iv = 1;
      EventSetTimer(iv * 60);    // then repeat reconcile on the interval
      return;
   }

   RunReconcile();
}

//+------------------------------------------------------------------+
//| OnDeinit                                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(DebugMode)
      Print("BigMarkt EA v", BIGMARKT_VERSION, " detached. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| OnTradeTransaction — fires on every trade event                   |
//| READ ONLY — no order management calls ever                        |
//+------------------------------------------------------------------+
void OnTradeTransaction(
   const MqlTradeTransaction& trans,
   const MqlTradeRequest&     request,
   const MqlTradeResult&      result)
{
   if(trans.type == TRADE_TRANSACTION_ORDER_ADD)
   {
      SendOrderEvent(trans.order, "order_add");
      return;
   }

   if(trans.type == TRADE_TRANSACTION_ORDER_UPDATE)
   {
      SendOrderEvent(trans.order, "order_update");
      return;
   }

   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE)
   {
      SendOrderEvent(trans.order, "order_delete");
      return;
   }

   if(trans.type == TRADE_TRANSACTION_POSITION)
   {
      SendPositionModify(trans.position);
      return;
   }

   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong dealTicket = trans.deal;
   if(dealTicket == 0)
      return;

   datetime from = (datetime)(TimeCurrent() - 86400);
   datetime to   = TimeCurrent() + 60;
   HistorySelect(from, to);

   if(!HistoryDealSelect(dealTicket))
   {
      if(DebugMode) Print("BigMarkt: HistoryDealSelect failed for ticket ", dealTicket);
      return;
   }

   long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   if(FilterMagic >= 0 && dealMagic != (long)FilterMagic)
   {
      if(DebugMode) Print("BigMarkt: skipping ticket ", dealTicket, " — magic filter");
      return;
   }

   SendDeal(dealTicket);
}

//+------------------------------------------------------------------+
//| OnTick — required by MT5, intentionally empty                     |
//+------------------------------------------------------------------+
void OnTick() {}

//+------------------------------------------------------------------+
// END OF FILE — NO OrderSend / OrderModify / OrderClose
// v2.7.1 changes (all additive — signing path untouched):
//   - open_snapshot is now a FULL open-state mirror: carries each open
//     position's full detail (position_id, symbol, type, lots, open_price,
//     sl, tp, open_time) plus the set of live pending order tickets.
//   - Canonical hash ComputeSnapshotFieldsHash now hashes one "position=" line
//     per open position (ascending by id) + a "pending=" CSV line.
//   - Enables the server to OPEN missing positions, CLOSE orphans, REPAIR
//     drifted lots/SL/TP, and CANCEL stuck pending rows — in one reconcile.
//   - REQUIRES the matching server open_snapshot handler upgrade; until that
//     deploys these POSTs return 400 harmlessly.
//   - UNCHANGED: all signing/hashing/self-test, live OnTradeTransaction, deal/
//     order/position payloads, deep backfill, close-sweep, repeating timer.
//+------------------------------------------------------------------+