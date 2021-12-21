export type Asset = {
  stock: Stock;
  lots: Lot[];
}

export type Stock = {
  name: string;
  symbol: string;
  price: StockPrices;
}

export type StockPrices = {
  bid: number;
  ask: number;
  previousClose: number;
  historicalPrices: HistoricalPrice[];
};
export type HistoricalPrice = { date: Date; price: number };
export type User = {
  name: string;
  email: string;
  cash: number;
  created: Date;
  transactions: Transaction[];
  assets: Asset[];
};
export type Lot = { shares: number; basis: number };
export type Transaction = {
  date: Date;
  type: TransactionType;
  amount: number;
  symbol: string;
  shares: number;
  name:string;
  cash:number
};

export enum TransactionType {
  GIFT = "GIFT",
  BUY="BUY",
  SELL="SELL",
  DIVIDEND="DIVIDEND"
}

export const COMMISSION: number = 15.0;
export const INITIAL_GIFT: number = 1000000;
