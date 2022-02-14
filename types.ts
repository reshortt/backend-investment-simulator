export type Asset = {
  stock: Stock;
  lots: Lot[];
}

export type Stock = {
  name: string;
  symbol: string;
  price: SpotPrice;
}

export type SpotPrice = {
  bid: number;
  ask: number;
  previousClose: number;
};
export type HistoricalPrice = { date: Date; price: number };

export type HistoricalData = {prices:HistoricalPrice[], dividends:Dividend[], splits:Split[]}

export type Dividend = {
    date: Date; amount: number
}

export type Split = {
  date:Date, from:number, to:number
}

export type UserInfo = {
  name: string;
  email: string;
  cash: number;
  created: Date;
}
export type Account = {
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
  from:number,
  to:number
};

export enum TransactionType {
  GIFT = "GIFT",
  BUY="BUY",
  SELL="SELL",
  DIVIDEND="DIVIDEND",
  SPLIT="SPLIT"
}

export const COMMISSION: number = 15.0;
export const INITIAL_GIFT: number = 1000000;
