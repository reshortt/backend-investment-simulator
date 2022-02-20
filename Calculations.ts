import {
  getLots,
  insertDividend,
  insertSplit,
} from "./mongo";
import { Document } from "mongodb";
import { getHistoricalEvents } from "./stocks";
import { Dividend, Asset, Split, Lot } from "./types";

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

const adjustForSplits = (startDate:Date, endDate:Date, shares:number, splits:Split[]):number => {
    for (let split of splits) {
        if (split.date > startDate && split.date < endDate)
            shares = Math.floor(shares * (split.to/split.from))
    }
    return shares
}

const DIVIDEND = "dividend";
const SPLIT = "split";

export const insertEvents = async (
  user: Document,
  assets: Asset[],
  startDate: Date
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

  for (let asset of assets) {
    const events: { dividends: Dividend[]; splits: Split[] } =
      await getHistoricalEvents(asset.stock.symbol);

    for (let dividend of events.dividends) {
      if (dividend.date > startDate) {
        console.log("Found dividend for ", asset.stock.symbol, ": ", dividend);
        const shares: number = await getQuantity(user, asset.stock.symbol);
        const adjustedShares = adjustForSplits(startDate, dividend.date, shares, events.splits)
        
        const amount: number = dividend.amount;
        const data: DividendData = {
          type: DIVIDEND,
          symbol: asset.stock.symbol,
          date: dividend.date,
          amount,
          shares:adjustedShares,
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
