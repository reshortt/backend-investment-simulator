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
};
export type HistoricalPrice = { date: Date; price: number };

export type UserInfo = {
  name: string;
  email: string;
  cash: number;
  created: Date;
}
export type User = {
  info:UserInfo;
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
  cash:number;
  commission:number;
};

export enum TransactionType {
  GIFT = "GIFT",
  BUY="BUY",
  SELL="SELL",
  DIVIDEND="DIVIDEND"
}

export const COMMISSION: number = 15.0;
export const INITIAL_GIFT: number = 1000000;
