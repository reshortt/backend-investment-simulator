export type Asset = { symbol: string; name: string, lots:Lot[]};
export type StockPrices = { bid: number; ask: number; previousClose: number };
export type UserInfo = { name: string; email: string };
export type Lot= {shares: number; basis: number}
