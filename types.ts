

export type Asset = { symbol: string; name: string, lots:Lot[]};
export type StockPrices = { bid: number; ask: number; previousClose: number };
export type UserInfo = { name: string; email: string, cash:number };
export type Lot= {shares: number; basis: number}
export type Transaction = {date:Date, type: TransactionType, amount:number, symbol:string, shares:number}

export enum TransactionType {
    "gift",
    "buy",
    "sell",
    "dividend"
}

export const COMMISSION:number = 15.00