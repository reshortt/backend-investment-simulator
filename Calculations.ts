import {
  getAssets,
  getLots,
  getTransactions,
  insertDividend,
  insertSplit,
  sellAsset,
} from "./mongo";
import { Document } from "mongodb";
import { getHistoricalEvents, getLastKnownPrice, isValidSymbol } from "./stocks";
import { Dividend, Asset, Split, Lot, Transaction, HistoricalPrice } from "./types";

// TODO: make this a dedicated query in mongo.ts instead of getting all assets
export const getQuantity = async (
  user: Document,
  symbol: string
): Promise<number> => {
  let count = 0;
  const lots: Lot[] = await getLots(user, symbol);
  for (let lot of lots) {
    count += lot.shares;
  }
  return count;
};

const adjustForSplits = (startDate:Date,  shares:number, splits:Split[]):number => {
    for (let split of splits) {
        if (split.date > startDate)
            shares = Math.floor(shares * (split.to/split.from))
    }
    return shares
}

const DIVIDEND = "dividend";
const SPLIT = "split";

export const insertDividendsAndSplits = async (
  user: Document
) => {
  type DividendData = {
    type: string;
    symbol: string;
    date: Date;
    amount: number;
    shares: number;
  };
  type SplitData = {
    type: string;
    symbol: string;
    date: Date;
    from: number;
    to: number;
  };

  const eventData: (DividendData | SplitData)[] = [];

  const transactions:Transaction[] = await getTransactions(user);
  if (transactions.length == 0)
    return
  const startDate: Date = transactions[transactions.length - 1].date;
  const assets =await(getAssets(user))

  for (let asset of assets) {
    const events: { dividends: Dividend[]; splits: Split[] } =
      await getHistoricalEvents(asset.stock.symbol);

    for (let dividend of events.dividends) {
      if (dividend.date > startDate) {
        console.log("Found dividend for ", asset.stock.symbol, ": ", dividend);
        const shares: number = await getQuantity(user, asset.stock.symbol);
        const adjustedShares = adjustForSplits(startDate,  shares, events.splits)
        
        const amount: number = dividend.amount;
        const data: DividendData = {
          type: DIVIDEND,
          symbol: asset.stock.symbol,
          date: dividend.date,
          amount: amount * (adjustedShares/shares),
          shares:shares,
        };
        eventData.push(data);
      }
    }

    for (let split of events.splits) {
      if (split.date > startDate) {
        console.log("Found split for ", asset.stock.symbol, ": ", split);
        const data: SplitData = {
          type: SPLIT,
          symbol: asset.stock.symbol,
          date: split.date,
          from: split.from,
          to: split.to,
        };
        eventData.push(data);
      }
    }
  }

  if (eventData.length == 0) return;

  eventData.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Now Insert Dividend and Split transactions in order
  for (let data of eventData) {
    if (data.type === DIVIDEND) {
      let dividendData = data as DividendData;
      await insertDividend(
        user,
        dividendData.symbol,
        dividendData.date,
        dividendData.amount,
        dividendData.shares
      );
    } else {
      let splitData = data as SplitData;
      await insertSplit(
        user,
        splitData.symbol,
        splitData.date,
        splitData.from,
        splitData.to
      );
    }
  }
};

export const sellDeadAssets = async (user:Document) => {
  const assets = await getAssets(user)
  for (let asset of assets) {
    const symbol = asset.stock.symbol
    if (!await isValidSymbol(symbol)) {

      var quantity: number = 0;
      for (var lot of asset.lots) {
        quantity += lot.shares;
      }

      const price:HistoricalPrice = await getLastKnownPrice(symbol)
      console.log("Selling Dead Asset ", symbol)
      sellAsset(user, symbol, price.price, quantity, price.date)
    }
  }
}