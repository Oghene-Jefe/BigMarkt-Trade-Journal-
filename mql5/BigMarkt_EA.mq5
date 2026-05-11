//+------------------------------------------------------------------+
//|  BigMarkt_EA.mq5                                                  |
//|  READ ONLY trade journal bridge for BigMarkt                      |
//|  Sends trade data to journal.bigmarkt.co via HTTP POST            |
//|  NO OrderSend / OrderModify / OrderClose — EVER                   |
//+------------------------------------------------------------------+
#property copyright "BigMarkt Protocol"
#property link      "https://journal.bigmarkt.co"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- inputs
input string ApiToken    = "";                              // EA Token (from /ea-setup)
input string ApiEndpoint = "https://journal.bigmarkt.co/api/ea/ingest"; // API Endpoint
input bool   DebugMode   = false;                          // Print debug logs
input int    FilterMagic = -1; // Magic filter: -1 = all trades, 0 = manual only, any positive number = that EA's magic only

//--- constants
#define BIGMARKT_VERSION "1.0.0"

//+------------------------------------------------------------------+
//| Utility: convert ENUM_ORDER_TYPE to string                        |
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
//| Send a single deal to the BigMarkt ingest endpoint                |
//+------------------------------------------------------------------+
void SendDeal(ulong dealTicket)
{
   if(!HistoryDealSelect(dealTicket))
   {
      if(DebugMode) Print("BigMarkt: HistoryDealSelect failed for ticket ", dealTicket);
      return;
   }

   ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);

   // Only send DEAL_ENTRY_IN (open) and DEAL_ENTRY_OUT (close)
   if(dealEntry != DEAL_ENTRY_IN && dealEntry != DEAL_ENTRY_OUT)
      return;

   string  symbol     = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double  price      = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double  lots       = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double  profit     = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double  swap       = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double  commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   long    magic      = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   string  comment    = HistoryDealGetString(dealTicket, DEAL_COMMENT);
   datetime openTime  = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   long    positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

   // Build JSON payload
   string json = "{";
   json += "\"ticket\":"     + IntegerToString(dealTicket)    + ",";
   json += "\"symbol\":\""   + JsonEscape(symbol)             + "\",";
   json += "\"type\":\""     + OrderTypeToString(dealType)    + "\",";
   json += "\"lots\":"       + DoubleToString(lots, 2)        + ",";
   json += "\"open_price\":" + DoubleToString(price, 5)       + ",";
   json += "\"open_time\":\"" + ToISO8601(openTime)           + "\",";
   json += "\"profit\":"     + DoubleToString(profit, 2)      + ",";
   json += "\"swap\":"       + DoubleToString(swap, 2)        + ",";
   json += "\"commission\":" + DoubleToString(commission, 2)  + ",";
   json += "\"magic\":"      + IntegerToString(magic)         + ",";
   json += "\"comment\":\""  + JsonEscape(comment)            + "\"";
   json += "}";

   // Build headers
   string headers = "Content-Type: application/json\r\n";
   headers += "Authorization: Bearer " + ApiToken + "\r\n";

   // Send HTTP POST
   char post[];
   char result[];
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
         Print("BigMarkt: trade sent OK — ticket ", dealTicket, " symbol ", symbol);
      else
         Print("BigMarkt: HTTP error ", res, " for ticket ", dealTicket, " — ", CharArrayToString(result));
   }
}

//+------------------------------------------------------------------+
//| OnInit — validate token is set                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiToken) == 0)
   {
      Alert("BigMarkt EA: No API token set. Go to journal.bigmarkt.co/ea-setup to generate one.");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(DebugMode)
      Print("BigMarkt EA v", BIGMARKT_VERSION, " initialised. Endpoint: ", ApiEndpoint);

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
   // We only care about deal additions to history
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong dealTicket = trans.deal;
   if(dealTicket == 0)
      return;

   // Pull full history for this deal
   datetime from = (datetime)(TimeCurrent() - 86400); // last 24h window
   datetime to   = TimeCurrent() + 60;
   HistorySelect(from, to);

   // Magic number filter
   if(!HistoryDealSelect(dealTicket))
   {
      if(DebugMode) Print("BigMarkt: HistoryDealSelect failed in filter for ticket ", dealTicket);
      return;
   }
   long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   if(FilterMagic >= 0 && dealMagic != (long)FilterMagic)
   {
      if(DebugMode) Print("BigMarkt: skipping ticket ", dealTicket, " — magic ", dealMagic, " != FilterMagic ", FilterMagic);
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
