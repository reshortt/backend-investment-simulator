import { HistoricalPrice, StockPrices } from "./types";

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

export const getHistoricalPrices = async (
  tickerSymbol: string
): Promise<HistoricalPrice[]> => {
  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  const priceHistory = await data.priceHistory;
  const priceHistoryRows: string[] = priceHistory.toString().split("\n");

  const prices: HistoricalPrice[] = [];

  //console.log("Number rows: ", priceHistoryRows.length);
  for (var row = 1; row < priceHistoryRows.length; ++row) {
    const rowString = priceHistoryRows[row];
    //console.log(rowString);
    const columns: string[] = rowString.split(",");
    const price: HistoricalPrice = {
      date: new Date(columns[0]),
      price: Number(columns[3]),
    };
    prices.push(price);
  }
  return prices;
};

export const getPrice = async (tickerSymbol: string): Promise<StockPrices> => {
  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  //console.log("stock info for ", tickerSymbol, " is ", symbol);

  const historicalPrices: HistoricalPrice[] = await getHistoricalPrices(
    tickerSymbol
  );

  const previousClose: number = symbol.response.previousClosea;

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
    previousClose: previousClose,
    historicalPrices: historicalPrices,
  };

  //console.log("Setting historical prices to: ", historicalPrices)
  return prices
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

export const lookupTicker = async (tickerSymbol: string): Promise<string> => {
  if (!tickerSymbol)
    return "";
  const tickerName: string = await ticker.lookup(tickerSymbol);
  //console.log("TICKER LOOOKUP: ", tickerSymbol, "->", tickerName);
  return tickerName;
};
