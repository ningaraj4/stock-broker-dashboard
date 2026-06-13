import type { PriceDirection, Stock } from "../types";

type StockTableProps = {
  stocks: Stock[];
  subscribedStocks: Set<string>;
  busyStockCode: string | null;
  priceDirectionByStock: Record<string, PriceDirection>;
  lastUpdatedAtByStock: Record<string, string>;
  onSubscribe: (stockCode: string) => void;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function StockTable({
  stocks,
  subscribedStocks,
  busyStockCode,
  priceDirectionByStock,
  lastUpdatedAtByStock,
  onSubscribe,
}: StockTableProps) {
  return (
    <div className="table-wrap">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Stock</th>
            <th>Current Price</th>
            <th>Status</th>
            <th>Last Tick</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => {
            const isSubscribed = subscribedStocks.has(stock.stockCode);
            const isBusy = busyStockCode === stock.stockCode;
            const direction = priceDirectionByStock[stock.stockCode] ?? "flat";
            const lastTick = lastUpdatedAtByStock[stock.stockCode];
            const statusClassName = isSubscribed
              ? "table-status table-status-live"
              : "table-status table-status-idle";
            const priceChipClassName = `price-chip price-chip-${direction}`;
            const trendCopy =
              direction === "up"
                ? "Rising"
                : direction === "down"
                  ? "Falling"
                  : "Stable";

            return (
              <tr
                key={stock.stockCode}
                className={isSubscribed ? "stock-row stock-row-subscribed" : "stock-row"}
              >
                <td className="stock-code">{stock.stockCode}</td>
                <td>
                  <div className="price-stack">
                    <span className={priceChipClassName}>
                      {currencyFormatter.format(stock.price)}
                    </span>
                    <span className={`trend-copy trend-copy-${direction}`}>{trendCopy}</span>
                  </div>
                </td>
                <td>
                  <span className={statusClassName}>
                    {isSubscribed ? "Streaming to you" : "Available"}
                  </span>
                </td>
                <td className="tick-time">
                  {lastTick ? timeFormatter.format(new Date(lastTick)) : "Awaiting tick"}
                </td>
                <td>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={isSubscribed || isBusy}
                    onClick={() => onSubscribe(stock.stockCode)}
                  >
                    {isBusy ? "Adding..." : isSubscribed ? "Watching" : "Subscribe"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default StockTable;
