import { insertDividend } from "./mongo";
import { Document } from "mongodb";
import { getHistoricalDividends } from "./stocks";
import { Dividend, Asset } from "./types";

export const getQuantity = (asset: Asset): number => {
  var quantity: number = 0;
  for (var lot of asset.lots) {
    quantity += lot.shares;
  }
  return quantity;
};

export const insertDividends = async (
  user: Document,
  assets: Asset[],
  startDate: Date
) => {
  type DividendData = {
    symbol: string;
    date: Date;
    amount: number;
    shares: number;
  };
  const newDividends: DividendData[] = [];

  for (let asset of assets) {
    const dividends: Dividend[] = await getHistoricalDividends(
      asset.stock.symbol
    );
    dividends.reverse();
    for (let dividend of dividends) {
      if (dividend.date <= startDate) break;
      console.log("Found dividend for ", asset.stock.symbol, ": ", dividend);
      const shares: number = getQuantity(asset);
      const amount: number = dividend.price;
      const data: DividendData = {
        symbol: asset.stock.symbol,
        date: dividend.date,
        amount,
        shares,
      };
      newDividends.push(data);
    }
  }

  if (newDividends.length == 0) return;

  newDividends.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (let dividendData of newDividends) {
    await insertDividend(
      user,
      dividendData.symbol,
      dividendData.date,
      dividendData.amount,
      dividendData.shares
    );
  }
};
