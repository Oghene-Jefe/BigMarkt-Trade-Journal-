export interface TradePayload {
  ticket: number;
  symbol: string;
  type: string;
  lots: number;
  open_price: number;
  open_time: string;
  close_price?: number;
  close_time?: string;
  swap?: number;
  commission?: number;
  magic?: number;
  comment?: string;
  profit?: number;
}
