//+------------------------------------------------------------------+
//|  BigMarkt_EA.mq5                                                  |
//|  READ ONLY trade journal bridge for BigMarkt                      |
//|  Sends trade data to journal.bigmarkt.co via HTTP POST            |
//|  NO OrderSend / OrderModify / OrderClose — EVER                   |
//+------------------------------------------------------------------+
#property copyright "BigMarkt Protocol"
#property link      "https://journal.bigmarkt.co"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>

//--- inputs
input string TokenId      = "";    // Token UUID (from /ea-setup)
input string ApiToken     = "";    // Bearer Token (from /ea-setup)
input string SigningSecret = "";   // Signing Secret (from /ea-setup)
input string ApiEndpoint  = "https://journal.bigmarkt.co/api/ea/ingest"; // API Endpoint
input bool   DebugMode    = false; // Print debug logs
input int    FilterMagic  = -1;    // Magic filter: -1=all, 0=manual, N=that magic only

//--- constants
#define BIGMARKT_VERSION "2.0.0"

//--- nonce counter — incremented each call to guarantee uniqueness per session
static uint g_nonceCounter = 0;

//+------------------------------------------------------------------+
//| Utility: convert deal type to string                              |
//+------------------------------------------------------------------+
string OrderTypeToString(ENUM_DEAL_TYPE dealType)
{
   switch(dealType)
   {
      case DEAL_TYPE_BUY:  return "buy";
      case DEAL_TYPE_SELL: return "sell";
      default:             return "unknown";
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
//| Utility: double → canonical JS-compatible string                  |
//| Matches JavaScript's String(number): no trailing zeros, no        |
//| decimal point for integer values. Used for the trade-fields hash. |
//+------------------------------------------------------------------+
string DoubleToCanonical(double v)
{
   // Integer values need no decimal point (String(1.0) → "1" in JS)
   if(v == MathFloor(v) && v == MathCeil(v) && MathAbs(v) < 9007199254740992.0)
      return IntegerToString((long)v);

   // Use 10 decimal places then strip trailing zeros
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
//| Utility: string → UTF-8 bytes, no null terminator                |
//+------------------------------------------------------------------+
void StringToUTF8(const string s, uchar &bytes[])
{
   int n = StringToCharArray(s, bytes, 0, WHOLE_ARRAY, 65001); // 65001 = CP_UTF8
   // StringToCharArray appends a null terminator; remove it
   if(n > 0 && ArraySize(bytes) > 0)
      ArrayResize(bytes, ArraySize(bytes) - 1);
}

//+------------------------------------------------------------------+
//| Utility: SHA-256 hash of a byte array                            |
//+------------------------------------------------------------------+
bool Sha256(const uchar &data[], uchar &hash[])
{
   uchar emptyKey[];
   return CryptEncode(CRYPT_HASH_SHA256, data, emptyKey, hash);
}

//+------------------------------------------------------------------+
//| Utility: decode lowercase hex string to byte array               |
//+------------------------------------------------------------------+
bool HexDecode(const string hexStr, uchar &bytes[])
{
   int len = StringLen(hexStr);
   if(len % 2 != 0) return false;
   int n = len / 2;
   ArrayResize(bytes, n);
   for(int i = 0; i < n; i++)
   {
      string b = StringSubstr(hexStr, i * 2, 2);
      bytes[i] = (uchar)StringToInteger("0x" + b);
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
//| keyIn: raw key bytes (decoded from hex before calling)            |
//| msg:   message bytes                                              |
//| mac:   output — 32 bytes                                         |
//+------------------------------------------------------------------+
bool HmacSha256(const uchar &keyIn[], const uchar &msg[], uchar &mac[])
{
   int blockSize = 64; // SHA-256 block size in bytes

   // Normalise key: hash it if longer than block size, zero-pad if shorter
   uchar k[];
   if(ArraySize(keyIn) > blockSize)
   {
      if(!Sha256(keyIn, k)) return false;
   }
   else
   {
      ArrayCopy(k, keyIn);
   }
   ArrayResize(k, blockSize); // zero-fills any new elements

   // Build ipad and opad key variants
   uchar ipadKey[], opadKey[];
   ArrayResize(ipadKey, blockSize);
   ArrayResize(opadKey, blockSize);
   for(int i = 0; i < blockSize; i++)
   {
      ipadKey[i] = k[i] ^ 0x36;
      opadKey[i] = k[i] ^ 0x5C;
   }

   // inner = SHA256(ipadKey || msg)
   int msgLen = ArraySize(msg);
   uchar innerInput[];
   ArrayResize(innerInput, blockSize + msgLen);
   ArrayCopy(innerInput, ipadKey, 0, 0, blockSize);
   ArrayCopy(innerInput, msg, blockSize, 0, msgLen);

   uchar innerHash[];
   if(!Sha256(innerInput, innerHash)) return false;

   // mac = SHA256(opadKey || innerHash)
   int innerLen = ArraySize(innerHash);
   uchar outerInput[];
   ArrayResize(outerInput, blockSize + innerLen);
   ArrayCopy(outerInput, opadKey, 0, 0, blockSize);
   ArrayCopy(outerInput, innerHash, blockSize, 0, innerLen);

   return Sha256(outerInput, mac);
}

//+------------------------------------------------------------------+
//| Generate a 32-char lowercase hex nonce (UUID4 without hyphens)   |
//+------------------------------------------------------------------+
string GenerateNonce()
{
   g_nonceCounter++;
   // Mix current tick count and counter so consecutive calls differ
   MathSrand(GetTickCount() ^ g_nonceCounter);
   string hexChars = "0123456789abcdef";
   string nonce = "";
   for(int i = 0; i < 32; i++)
      nonce += StringSubstr(hexChars, MathRand() % 16, 1);
   return nonce;
}

//+------------------------------------------------------------------+
//| Compute SHA-256 of the canonical trade-fields bundle              |
//| Field order MUST match TRADE_FIELD_ORDER in web/lib/ea/sig.ts     |
//+------------------------------------------------------------------+
string ComputeTradeFieldsHash(
   ulong   ticket,
   string  symbol,    // already uppercased (matches Zod transform)
   string  tradeType,
   double  lots,
   double  openPrice,
   string  openTime,
   double  profit,
   double  swap,
   double  commission,
   long    magic,
   string  comment)
{
   // close_price and close_time are not sent by this EA — always absent → ""
   string lines =
      "ticket="     + IntegerToString(ticket)          + "\n" +
      "symbol="     + symbol                           + "\n" +
      "type="       + tradeType                        + "\n" +
      "lots="       + DoubleToCanonical(lots)           + "\n" +
      "open_price=" + DoubleToCanonical(openPrice)      + "\n" +
      "close_price="                                    + "\n" +
      "open_time="  + openTime                         + "\n" +
      "close_time="                                     + "\n" +
      "profit="     + DoubleToCanonical(profit)         + "\n" +
      "swap="       + DoubleToCanonical(swap)           + "\n" +
      "commission=" + DoubleToCanonical(commission)     + "\n" +
      "magic="      + IntegerToString(magic)            + "\n" +
      "comment="    + comment;

   uchar msgBytes[], hashBytes[];
   StringToUTF8(lines, msgBytes);
   if(!Sha256(msgBytes, hashBytes)) return "";
   return HexEncode(hashBytes);
}

//+------------------------------------------------------------------+
//| Compute v2 HMAC-SHA256 envelope signature                        |
//| Canonical message format (sig.ts canonicalMessage):              |
//|   "v2\n<tokenId>\n<sentAt>\n<nonce>\n<tradeHash>"               |
//+------------------------------------------------------------------+
string ComputeSignature(
   const string tokenId,
   const string sentAt,
   const string nonce,
   const string tradeHash,
   const string signingSecretHex)
{
   string message = "v2\n" + tokenId + "\n" + sentAt + "\n" + nonce + "\n" + tradeHash;

   uchar keyBytes[], msgBytes[], mac[];
   if(!HexDecode(signingSecretHex, keyBytes)) return "";
   StringToUTF8(message, msgBytes);
   if(!HmacSha256(keyBytes, msgBytes, mac)) return "";
   return HexEncode(mac);
}

//+------------------------------------------------------------------+
//| Send a single deal to the BigMarkt ingest endpoint               |
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

   string   symbol     = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double   price      = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double   lots       = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double   profit     = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double   swap       = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double   commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   long     magic      = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   string   comment    = HistoryDealGetString(dealTicket, DEAL_COMMENT);
   datetime openTime   = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);

   string typeStr    = OrderTypeToString(dealType);
   string openTimeStr = ToISO8601(openTime);

   // Symbol uppercased — must match Zod transform on the server before hashing
   string symbolUp = symbol;
   StringToUpper(symbolUp);

   // Build JSON trade fields
   string json = "{";
   json += "\"ticket\":"      + IntegerToString(dealTicket)   + ",";
   json += "\"symbol\":\""    + JsonEscape(symbol)            + "\",";
   json += "\"type\":\""      + typeStr                       + "\",";
   json += "\"lots\":"        + DoubleToString(lots, 2)       + ",";
   json += "\"open_price\":"  + DoubleToString(price, 5)      + ",";
   json += "\"open_time\":\"" + openTimeStr                   + "\",";
   json += "\"profit\":"      + DoubleToString(profit, 2)     + ",";
   json += "\"swap\":"        + DoubleToString(swap, 2)       + ",";
   json += "\"commission\":"  + DoubleToString(commission, 2) + ",";
   json += "\"magic\":"       + IntegerToString(magic)        + ",";
   json += "\"comment\":\""   + JsonEscape(comment)           + "\"";

   // Build request headers
   string headers = "Content-Type: application/json\r\n";
   headers += "Authorization: Bearer " + ApiToken + "\r\n";

   bool useV2 = StringLen(SigningSecret) > 0 && StringLen(TokenId) > 0;

   if(useV2)
   {
      string sentAt    = ToISO8601(TimeCurrent());
      string nonce     = GenerateNonce();
      string tradeHash = ComputeTradeFieldsHash(
         dealTicket, symbolUp, typeStr,
         lots, price, openTimeStr,
         profit, swap, commission,
         magic, comment);

      if(StringLen(tradeHash) == 0)
      {
         if(DebugMode) Print("BigMarkt: v2 hash failed for ticket ", dealTicket, " — aborting");
         return;
      }

      string sig = ComputeSignature(TokenId, sentAt, nonce, tradeHash, SigningSecret);
      if(StringLen(sig) == 0)
      {
         if(DebugMode) Print("BigMarkt: v2 signature failed for ticket ", dealTicket, " — aborting");
         return;
      }

      // Append v2 envelope fields to JSON body
      json += ",\"sent_at\":\"" + sentAt + "\"";
      json += ",\"nonce\":\""   + nonce  + "\"";
      json += ",\"sig\":\""     + sig    + "\"";

      // v2 protocol headers
      headers += "X-Ingest-Protocol: v2\r\n";
      headers += "X-BigMarkt-Token-Id: "    + TokenId                              + "\r\n";
      headers += "X-BigMarkt-Signature: "   + sig                                  + "\r\n";
      headers += "X-BigMarkt-Timestamp: "   + IntegerToString((long)TimeCurrent()) + "\r\n";
      headers += "X-BigMarkt-Nonce: "       + nonce                                + "\r\n";
   }
   else
   {
      // v1 fallback — warn once per trade so logs are visible
      if(DebugMode || true)
         Print("BigMarkt: [DEPRECATED] Sending v1 request for ticket ", dealTicket,
               " — set TokenId and SigningSecret to use v2 protocol.");
   }

   json += "}";

   // Send HTTP POST
   char   post[];
   char   result[];
   string resultHeaders;

   StringToCharArray(json, post, 0, StringLen(json));

   int timeout = 10000; // 10 seconds
   int res = WebRequest(
      "POST",
      ApiEndpoint,
      headers,
      timeout,
      post,
      result,
      resultHeaders
   );

   if(DebugMode)
   {
      if(res == 200)
         Print("BigMarkt: sent OK (", (useV2 ? "v2" : "v1"), ") — ticket ", dealTicket, " symbol ", symbol);
      else
         Print("BigMarkt: HTTP ", res, " for ticket ", dealTicket, " — ", CharArrayToString(result));
   }
}

//+------------------------------------------------------------------+
//| OnInit — validate inputs                                          |
//+------------------------------------------------------------------+
int OnInit()
{
   MathSrand(GetTickCount());

   if(StringLen(ApiToken) == 0)
   {
      Alert("BigMarkt EA: Bearer Token not set. Go to journal.bigmarkt.co/ea-setup to copy all 3 values.");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringLen(SigningSecret) == 0)
   {
      Print("BigMarkt EA: WARNING — SigningSecret not set. Running in v1 mode (deprecated). ",
            "Set TokenId and SigningSecret from /ea-setup to enable v2 signed requests.");
   }
   else if(StringLen(TokenId) == 0)
   {
      Alert("BigMarkt EA: SigningSecret is set but TokenId is empty. Copy all 3 values from /ea-setup.");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(DebugMode)
      Print("BigMarkt EA v", BIGMARKT_VERSION, " initialised. Endpoint: ", ApiEndpoint,
            " Protocol: ", (StringLen(SigningSecret) > 0 ? "v2" : "v1 (deprecated)"));

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| OnDeinit                                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(DebugMode)
      Print("BigMarkt EA detached. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| OnTradeTransaction — fires on every trade event                   |
//|  READ ONLY — no order management calls ever                       |
//+------------------------------------------------------------------+
void OnTradeTransaction(
   const MqlTradeTransaction& trans,
   const MqlTradeRequest&     request,
   const MqlTradeResult&      result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong dealTicket = trans.deal;
   if(dealTicket == 0)
      return;

   datetime from = (datetime)(TimeCurrent() - 86400); // last 24h window
   datetime to   = TimeCurrent() + 60;
   HistorySelect(from, to);

   if(!HistoryDealSelect(dealTicket))
   {
      if(DebugMode) Print("BigMarkt: HistoryDealSelect failed in filter for ticket ", dealTicket);
      return;
   }

   long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   if(FilterMagic >= 0 && dealMagic != (long)FilterMagic)
   {
      if(DebugMode) Print("BigMarkt: skipping ticket ", dealTicket,
                          " — magic ", dealMagic, " != FilterMagic ", FilterMagic);
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
//+------------------------------------------------------------------+
