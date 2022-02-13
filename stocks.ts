import { Dividend, HistoricalData, HistoricalPrice, SpotPrice } from "./types";

const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require("stock-ticker-symbol");

export const getHistoricalData = async (
  tickerSymbol: string
): Promise<HistoricalData> => {
  const prices: HistoricalPrice[] = [];
  const dividends: Dividend[] = [];

  const data = await yahooHistory.getPriceHistory(tickerSymbol);

  const priceHistory = await data.priceHistory;
  const priceHistoryRows: string[] = priceHistory.toString().split("\n");

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

  const dividendHistory = await data.dividendHistory;
  const dividendHistoryRows: string[] = dividendHistory.toString().split("\n");

  for (var row = 1; row < dividendHistoryRows.length; ++row) {
    const rowString = dividendHistoryRows[row];
    const columns: string[] = rowString.split(",");
    const dividend: Dividend = {
      date: new Date(columns[0]),
      price: Number(columns[1]),
    };
    dividends.push(dividend);
  }

  const splitHistory = await data.splitHistory
  splitHistory && console.log ("Split History for ", tickerSymbol, ": ", splitHistory)

  const historicalData:HistoricalData = {prices:prices, dividends: dividends}

  return historicalData;
};

export const getPrice = async (
  tickerSymbol: string
): Promise<SpotPrice | undefined> => {
  if (!tickerSymbol) return undefined;
  const stockInfo = await yahooStockAPI.getSymbol(tickerSymbol);
  //console.log("stock info for ", tickerSymbol, " is ", companyName);
  if (!stockInfo) {
    console.log("No stock info for ", tickerSymbol, " : ", stockInfo);
    return undefined;
  }

  const previousClose: number = stockInfo.response.previousClose;

  // bid
  const bidString: string = stockInfo.response.bid
    .split(" x ")[0]
    .replace(",", "");
  const bid: number =
    Number(bidString) > 0 && Number(bidString) != NaN
      ? Number(bidString)
      : previousClose;

  // ask
  const askString: string = stockInfo.response.ask
    .split(" x ")[0]
    .replace(",", "");
  const ask: number =
    Number(askString) > 0 && Number(askString) != NaN
      ? Number(askString)
      : previousClose;

  const prices: SpotPrice = {
    bid: bid,
    ask: ask,
    previousClose: previousClose,
  };

  //console.log("Returning new StockPrices Object: ", JSON.stringify(prices))
  return prices;
};

export const isValidSymbol = async (tickerSymbol: string): Promise<boolean> => {
  const name: string = await ticker.lookup(tickerSymbol);
  if (!name) {
    return false;
  }

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);

  const isError: boolean = Boolean(symbol.error);
  if (isError) return false;
  if (symbol.response.previousClose == null) return false;
  return true;
};

export const lookupTicker = async (tickerSymbol: string): Promise<string> => {
  if (!tickerSymbol) return "";
  const tickerName: string = await ticker.lookup(tickerSymbol);
  //console.log("TICKER LOOOKUP: ", tickerSymbol, "->", tickerName);
  return tickerName;
};

const priceMap = new Map<string, HistoricalPrice[]>();
const dividendMap = new Map<string, Dividend[]>();
const tickersCalculating = new Set<string>();

export const cacheHistoricalData = (symbol: string) => {
  const prices = priceMap.get(symbol);
  if (prices === undefined || prices == null) {
    if (!tickersCalculating.has(symbol)) {
      tickersCalculating.add(symbol)
      console.log("Cacheing History for " + symbol + "...");
      getHistoricalData(symbol).then((data:HistoricalData) => {
        priceMap.set(symbol, data.prices);
        dividendMap.set(symbol, data.dividends)
        console.log(
          "Finished Caching History for ",
          symbol,
          " Prices: ",
          data.prices.length,
          ", Dividends: ",
          data.dividends.length
        );
      });
    }
  }
};

export const getStockPriceOnDate = async (
  symbol: string,
  date: Date
): Promise<number> => {
  let priceHistory = priceMap.get(symbol);
  if (!priceHistory || priceHistory === undefined) {
    console.log("(b) Getting Price History for " + symbol + "...");
    priceHistory = (await getHistoricalData(symbol)).prices;
    priceMap.set(symbol, priceHistory);
    console.log(
      "(b) Finished getting Price History for ",
      symbol,
      ". Entries: ",
      priceHistory.length
    );
  }

  let lastPrice: number = undefined;
  let targetDate: Date = new Date(date);

  // brute force march from end to beginning
  for (let i = priceHistory.length-1; i >=0; --i) {
    const historicalPrice:HistoricalPrice = priceHistory[i]
    let priceDate: Date = new Date(historicalPrice.date);

    if (lastPrice && priceDate < targetDate) {
      break;
    }
    lastPrice = historicalPrice.price;
  }

  return lastPrice;
};

export const getHistoricalDividends = async (symbol:string):Promise<Dividend[]> => {
  let dividends:Dividend[] = dividendMap.get(symbol)
  if (!dividends || dividends === undefined) {
    console.log("(b) Getting Dividend History for " + symbol + "...");
    dividends = (await getHistoricalData(symbol)).dividends
    if (!dividends || dividends === undefined)
      dividends = []
    dividendMap.set(symbol, dividends);
    console.log(
      "(b) Finished getting Dividend History for ",
      symbol,
      ". Entries: ",
      dividends.length
    );
  }
  return dividends
}
