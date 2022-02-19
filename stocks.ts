import { getAllSymbols } from "./mongo";
import { Dividend, HistoricalData, HistoricalPrice, SpotPrice, Split } from "./types";

const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require("stock-ticker-symbol");


const priceMap = new Map<string, HistoricalPrice[]>();
const dividendMap = new Map<string, Dividend[]>();
const splitMap = new Map<string, Split[]>();
const tickersCalculating = new Set<string>();

const getHistoricalData = async (
  tickerSymbol: string
): Promise<HistoricalData> => {

  const prices: HistoricalPrice[] = [];
  const dividends: Dividend[] = [];
  const splits: Split[] = [];

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
  //dividendHistory && console.log("Dividend History for ", tickerSymbol, ": ", dividendHistory)
  const dividendHistoryRows: string[] = dividendHistory.toString().split("\n");

  for (var row = 1; row < dividendHistoryRows.length; ++row) {
    const rowString = dividendHistoryRows[row];
    const columns: string[] = rowString.split(",");
    const dividend: Dividend = {
      date: new Date(columns[0]),
      amount: Number(columns[1]),
    };
    dividends.push(dividend);
  }

  const splitHistory = await data.splitHistory
  //splitHistory && console.log ("Split History for ", tickerSymbol, ": ", splitHistory)
  const splitHistoryRows: string[] = splitHistory.toString().split("\n");

  for (var row = 1; row < splitHistoryRows.length; ++row) {
    const rowString = splitHistoryRows[row];
    const columns: string[] = rowString.split(",");
    if (!columns || columns.length < 2)
      continue
    const toFrom:string[] = columns[1].split(":")
    if (!toFrom || toFrom.length < 2)
      continue
    const split: Split = {
      date: new Date(columns[0]),
      to:Number.parseInt(toFrom[0]),
      from:Number.parseInt(toFrom[1])
    };
    splits.push(split);
  }

  return {prices,dividends,splits}
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


export const  cacheAllHistoricalData = () => {

  priceMap.clear()
  dividendMap.clear()
  splitMap.clear()
  tickersCalculating.clear()
  
   getAllSymbols().then((symbols) => {
       symbols.forEach((symbol) => {
         cacheHistoricalData(symbol)
       })
   })
}


export const cacheHistoricalData = (symbol: string) => {
  const prices = priceMap.get(symbol);
  if (prices === undefined || prices == null) {
    if (!tickersCalculating.has(symbol)) {
      tickersCalculating.add(symbol)
      console.log("Caching History for " + symbol + "...");
      getHistoricalData(symbol).then((data:HistoricalData) => {
        priceMap.set(symbol, data.prices);
        dividendMap.set(symbol, data.dividends)
        splitMap.set(symbol, data.splits)
        console.log(
          "Finished Caching History for ",
          symbol,
          " Prices: ",
          data.prices.length,
          ", Dividends: ",
          data.dividends.length,
          ", Splits: ",
          data.splits.length,
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

export const getHistoricalEvents = async (symbol:string):Promise<{dividends:Dividend[], splits: Split[]}> => {
  let dividends:Dividend[] = dividendMap.get(symbol)
  let splits:Split[] = splitMap.get(symbol)

  // if dividends
  if (!dividends || !splits || dividends === undefined || splits === undefined ) {
    console.log("(b) Getting Dividend and Spllit History for " + symbol + "...");
    const historicalData = await getHistoricalData(symbol)
    dividends = historicalData.dividends
    splits = historicalData.splits

    if (!dividends || dividends === undefined)
      dividends = []
    if (!splits || splits === undefined)
      splits = []
    dividendMap.set(symbol, dividends);
    splitMap.set(symbol, splits)

    console.log(
      "(b) Finished getting Dividend and Split History for ",
      symbol,
      ". Entries: ",
      dividends.length
    );
  }
  return {dividends, splits}
}
