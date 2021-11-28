import { StockPrices } from "./types";

const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require("stock-ticker-symbol");

export async function checkFavoriteStock(tickerSymbol: string) {
  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  console.log(await data.dividendHistory);

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  console.log(symbol);
  if (!symbol.error) {
    //console.log(tickerSymbol + ": valid");
    return true;
  } else {
    //console.log(tickerSymbol + ": invalid");
    return false;
  }
}

export const getPrice = async (tickerSymbol: string): Promise<StockPrices> => {
  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  console.log("stock info for ", tickerSymbol, " is ", symbol);

  const previousClose: number = symbol.response.previousClose

  // bid
  const bidString: string = symbol.response.bid
    .split(" x ")[0]
    .replace(",", "");
  const bid: number =
    Number(bidString) > 0 && Number(bidString) != NaN
      ? Number(bidString)
      : previousClose;

  // ask
  const askString: string = symbol.response.ask
    .split(" x ")[0]
    .replace(",", "");
  const ask: number =
    Number(askString) > 0 && Number(askString) != NaN
      ? Number(askString)
      : previousClose;

  const prices: StockPrices = {
    bid: bid,
    ask: ask,
    previousClose: previousClose
  };

  return prices;
};

export const isValidSymbol = async (tickerSymbol: string): Promise<boolean> => {
  const name: string = await ticker.lookup(tickerSymbol);
  if (!name) {
    return false;
  }

  //console.log(`${tickerSymbol} is ${name}`)

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);

  const isError: boolean = Boolean(symbol.error);
  if (isError) return false;
  if (symbol.response.previousClose == null) return false;
  return true;
};

export const getTickerName = async (tickerSymbol: string): Promise<string> =>
  await ticker.lookup(tickerSymbol);
