export type Asset = { symbol: string; name: string, price:StockPrices, lots:Lot[]};
export type StockPrices = { bid: number; ask: number; previousClose: number };
export type User = { name: string; email: string, cash:number, transactions:Transaction[], assets:Asset[] };
export type Lot= {shares: number; basis: number}
export type Transaction = {date:Date, type: TransactionType, amount:number, symbol:string, shares:number}

export enum TransactionType {
    "gift",
    "buy",
    "sell",
    "dividend"
}

export const COMMISSION:number = 15.00
export const INITIAL_GIFT:number = 1000000