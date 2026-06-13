import type { PriceDirection, Subscription } from "../types";

type SubscriptionListProps = {
  subscriptions: Subscription[];
  stockPrices: Record<string, number>;
  busyStockCode: string | null;
  priceDirectionByStock: Record<string, PriceDirection>;
  lastUpdatedAtByStock: Record<string, string>;
  onUnsubscribe: (stockCode: string) => void;
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

function SubscriptionList({
  subscriptions,
  stockPrices,
  busyStockCode,
  priceDirectionByStock,
  lastUpdatedAtByStock,
  onUnsubscribe,
}: SubscriptionListProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="subscription-empty">
        No subscriptions yet. Pick one or more stocks from the list to start
        receiving live updates.
      </div>
    );
  }

  return (
    <div className="subscription-list">
      {subscriptions.map((subscription) => {
        const isBusy = busyStockCode === subscription.stockCode;
        const currentPrice = stockPrices[subscription.stockCode];
        const direction = priceDirectionByStock[subscription.stockCode] ?? "flat";
        const lastTick = lastUpdatedAtByStock[subscription.stockCode];
        const directionLabel =
          direction === "up"
            ? "Up move"
            : direction === "down"
              ? "Down move"
              : "Flat move";

        return (
          <div key={subscription.id} className="subscription-item">
            <div className="subscription-meta">
              <div className="subscription-topline">
                <strong className="watch-stock-code">{subscription.stockCode}</strong>
                <span className={`movement-pill movement-pill-${direction}`}>
                  {directionLabel}
                </span>
              </div>
              <span className="subscription-price">
                {typeof currentPrice === "number"
                  ? currencyFormatter.format(currentPrice)
                  : "Waiting for price..."}
              </span>
              <span className="muted-text">
                {lastTick
                  ? `Last update ${timeFormatter.format(new Date(lastTick))}`
                  : "Waiting for first live update"}
              </span>
            </div>
            <button
              className="button button-danger"
              type="button"
              disabled={isBusy}
              onClick={() => onUnsubscribe(subscription.stockCode)}
            >
              {isBusy ? "Removing..." : "Unsubscribe"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default SubscriptionList;
