import { HistoricalPrice, StockPrices } from "./types";

const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require("stock-ticker-symbol");

export const getHistoricalPrices = async (
  tickerSymbol: string
): Promise<HistoricalPrice[]> => {
  console.log("Getting Price History of ", tickerSymbol)
  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  const priceHistory = await data.priceHistory;
  const priceHistoryRows: string[] = priceHistory.toString().split("\n");

  console.log ("Price History for ", tickerSymbol, " ---->> \n", (priceHistoryRows && priceHistoryRows.length > 2) ?   (priceHistoryRows[0], priceHistoryRows[1]): "...nothing yet...")
  const prices: HistoricalPrice[] = [];

  console.log("Number of rows in price history: ", priceHistoryRows.length);
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

export const getPrice = async (tickerSymbol: string): Promise<StockPrices|undefined> => {
  if (!tickerSymbol)
    return undefined
  const companyName = await yahooStockAPI.getSymbol(tickerSymbol);
  //console.log("stock info for ", tickerSymbol, " is ", companyName);
  if (!companyName) {
    console.log("Company name is bad for ", tickerSymbol, " : ", companyName)
    return undefined
  }

  const historicalPrices: HistoricalPrice[] = await getHistoricalPrices(
    tickerSymbol
  );

  if (!historicalPrices) {
    console.log("No historical prices for ", tickerSymbol, ":", historicalPrices)
    return undefined
  }

  const previousClose: number = companyName.response.previousClosea;

  // bid
  const bidString: string = companyName.response.bid
    .split(" x ")[0]
    .replace(",", "");
  const bid: number =
    Number(bidString) > 0 && Number(bidString) != NaN
      ? Number(bidString)
      : previousClose;

  // ask
  const askString: string = companyName.response.ask
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
