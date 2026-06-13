import { useEffect, useRef, useState } from "react";
import StockTable from "../components/StockTable";
import SubscriptionList from "../components/SubscriptionList";
import { useStockUpdates } from "../hooks/useStockUpdates";
import {
  getStocks,
  getSubscriptions,
  subscribeToStock,
  unsubscribeFromStock,
} from "../services/api";
import type {
  AuthSession,
  ConnectionStatus,
  PriceDirection,
  Stock,
  StockUpdate,
  Subscription,
} from "../types";

type DashboardPageProps = {
  session: AuthSession;
  onLogout: () => void;
};

type NoticeTone = "info" | "success" | "error";

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

function DashboardPage({ session, onLogout }: DashboardPageProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busyStockCode, setBusyStockCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [priceDirectionByStock, setPriceDirectionByStock] = useState<
    Record<string, PriceDirection>
  >({});
  const [lastUpdatedAtByStock, setLastUpdatedAtByStock] = useState<Record<string, string>>(
    {},
  );
  const [lastFeedTimestamp, setLastFeedTimestamp] = useState("");
  const [lastFeedSummary, setLastFeedSummary] = useState(
    "Waiting for the first live price update.",
  );
  const stockPriceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      setNotice(null);

      try {
        const [stocksResponse, subscriptionsResponse] = await Promise.all([
          getStocks(session.token),
          getSubscriptions(session.token),
        ]);

        if (!isMounted) {
          return;
        }

        setStocks(stocksResponse.stocks);
        setSubscriptions(subscriptionsResponse.subscriptions);
        setPriceDirectionByStock(
          stocksResponse.stocks.reduce<Record<string, PriceDirection>>((accumulator, stock) => {
            accumulator[stock.stockCode] = "flat";
            return accumulator;
          }, {}),
        );
        stockPriceRef.current = stocksResponse.stocks.reduce<Record<string, number>>(
          (accumulator, stock) => {
            accumulator[stock.stockCode] = stock.price;
            return accumulator;
          },
          {},
        );
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load dashboard.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [session.token]);

  const handleStockUpdate = (update: StockUpdate) => {
    const previousPrice = stockPriceRef.current[update.stockCode];
    const direction: PriceDirection =
      typeof previousPrice !== "number"
        ? "flat"
        : update.price > previousPrice
          ? "up"
          : update.price < previousPrice
            ? "down"
            : "flat";

    stockPriceRef.current = {
      ...stockPriceRef.current,
      [update.stockCode]: update.price,
    };

    setStocks((currentStocks) =>
      currentStocks.map((stock) =>
        stock.stockCode === update.stockCode
          ? { ...stock, price: update.price }
          : stock,
        ),
    );
    setPriceDirectionByStock((currentDirections) => ({
      ...currentDirections,
      [update.stockCode]: direction,
    }));
    setLastUpdatedAtByStock((currentTimestamps) => ({
      ...currentTimestamps,
      [update.stockCode]: update.timestamp,
    }));
    setLastFeedTimestamp(update.timestamp);
    setLastFeedSummary(
      `${update.stockCode} ${
        direction === "up" ? "moved up" : direction === "down" ? "moved down" : "held steady"
      } to ${currencyFormatter.format(update.price)}.`,
    );
  };

  useStockUpdates({
    token: session.token,
    onUpdate: handleStockUpdate,
    onStatusChange: setConnectionStatus,
    onError: (message) => setNotice({ tone: "info", text: message }),
  });

  const stockPrices = stocks.reduce<Record<string, number>>((priceMap, stock) => {
    priceMap[stock.stockCode] = stock.price;
    return priceMap;
  }, {});

  const subscribedStocks = new Set(
    subscriptions.map((subscription) => subscription.stockCode),
  );

  const refreshSubscriptions = async () => {
    const response = await getSubscriptions(session.token);
    setSubscriptions(response.subscriptions);
  };

  const handleSubscribe = async (stockCode: string) => {
    setBusyStockCode(stockCode);
    setNotice(null);
    
    // Optimistic UI update
    const previousSubscriptions = [...subscriptions];
    setSubscriptions((prev) => [...prev, { id: Date.now(), stockCode }]);

    try {
      await subscribeToStock(session.token, stockCode);
      await refreshSubscriptions();
      setNotice({
        tone: "success",
        text: `${stockCode} was added to your live watchlist.`,
      });
    } catch (requestError) {
      // Revert on failure
      setSubscriptions(previousSubscriptions);
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to subscribe to stock.";
      setNotice({ tone: "error", text: message });
    } finally {
      setBusyStockCode(null);
    }
  };

  const handleUnsubscribe = async (stockCode: string) => {
    setBusyStockCode(stockCode);
    setNotice(null);
    
    // Optimistic UI update
    const previousSubscriptions = [...subscriptions];
    setSubscriptions((prev) => prev.filter((s) => s.stockCode !== stockCode));

    try {
      await unsubscribeFromStock(session.token, stockCode);
      await refreshSubscriptions();
      setNotice({
        tone: "success",
        text: `${stockCode} was removed from your watchlist.`,
      });
    } catch (requestError) {
      // Revert on failure
      setSubscriptions(previousSubscriptions);
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to unsubscribe from stock.";
      setNotice({ tone: "error", text: message });
    } finally {
      setBusyStockCode(null);
    }
  };

  const connectionStatusClass = `status-pill status-${connectionStatus}`;
  const availableStockCount = Math.max(stocks.length - subscriptions.length, 0);
  const watchedStockCodes = subscriptions.map((subscription) => subscription.stockCode);
  const latestTickLabel = lastFeedTimestamp
    ? timeFormatter.format(new Date(lastFeedTimestamp))
    : "Awaiting first tick";

  return (
    <main className="page page-dashboard">
      <section className="dashboard-hero panel">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">Authenticated live workspace</span>
          <h1 className="dashboard-title">Welcome back, {session.user.email}</h1>
          <p className="muted-text">
            This dashboard uses a streamlined model: login is email-only,
            users are auto-created on first access, and live price updates are
            streamed only for the stocks you subscribe to.
          </p>

          <div className="watch-chip-row">
            {watchedStockCodes.length > 0 ? (
              watchedStockCodes.map((stockCode) => (
                <span key={stockCode} className="watch-chip">
                  {stockCode}
                </span>
              ))
            ) : (
              <span className="watch-chip watch-chip-muted">No active subscriptions yet</span>
            )}
          </div>
        </div>

        <div className="hero-sidecard">
          <span className={connectionStatusClass}>
            Live feed: {connectionStatus}
          </span>

          <div className="hero-sidecard-block">
            <p className="section-kicker">Latest market event</p>
            <h3>{latestTickLabel}</h3>
            <p className="muted-text">{lastFeedSummary}</p>
          </div>

          <button className="button button-secondary button-block" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <p className="metric-label">Supported stocks</p>
          <p className="metric-value">{stocks.length}</p>
        </article>
        <article className="overview-card">
          <p className="metric-label">Subscribed stocks</p>
          <p className="metric-value">{subscriptions.length}</p>
        </article>
        <article className="overview-card">
          <p className="metric-label">Available to add</p>
          <p className="metric-value">{availableStockCount}</p>
        </article>
        <article className="overview-card">
          <p className="metric-label">Connection</p>
          <p className="metric-value metric-value-small">
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </p>
        </article>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className={`alert alert-${notice.tone}`}>{notice.text}</div> : null}

      <section className="panel live-ribbon">
        <div>
          <p className="section-kicker">Live watchlist summary</p>
          <h2 className="section-title">Real-time subscriptions</h2>
        </div>
        <p className="muted-text">
          {watchedStockCodes.length > 0
            ? `Streaming ${watchedStockCodes.join(", ")} while prices change every second.`
            : "Subscribe to one or more stocks to start receiving live updates here."}
        </p>
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-market">
          <p className="section-kicker">Market board</p>
          <h2 className="section-title">Supported Stocks</h2>
          <p className="muted-text">
            The backend simulates exactly five supported stocks and updates them
            in memory every second.
          </p>

          {loading ? (
            <div className="table-wrap">
              <table className="stock-table skeleton-table">
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td><div className="skeleton-line" style={{ width: '60px' }}></div></td>
                      <td><div className="skeleton-line" style={{ width: '100px' }}></div></td>
                      <td><div className="skeleton-line" style={{ width: '80px' }}></div></td>
                      <td><div className="skeleton-line" style={{ width: '90px' }}></div></td>
                      <td><div className="skeleton-line" style={{ width: '100px', height: '36px', borderRadius: '12px' }}></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StockTable
              stocks={stocks}
              subscribedStocks={subscribedStocks}
              busyStockCode={busyStockCode}
              priceDirectionByStock={priceDirectionByStock}
              lastUpdatedAtByStock={lastUpdatedAtByStock}
              onSubscribe={handleSubscribe}
            />
          )}
        </section>

        <aside className="panel panel-watchlist">
          <p className="section-kicker">Client watchlist</p>
          <h2 className="section-title">Your Subscriptions</h2>
          <p className="muted-text">
            Only these stocks are pushed to your dashboard over WebSockets.
          </p>

          {loading ? (
            <div className="subscription-list">
              {[1, 2].map((i) => (
                <div key={i} className="subscription-item skeleton-item">
                  <div className="subscription-meta">
                    <div className="skeleton-line" style={{ width: '120px', height: '24px' }}></div>
                    <div className="skeleton-line" style={{ width: '90px', height: '32px' }}></div>
                    <div className="skeleton-line" style={{ width: '150px' }}></div>
                  </div>
                  <div className="skeleton-line" style={{ width: '100px', height: '36px', borderRadius: '12px' }}></div>
                </div>
              ))}
            </div>
          ) : (
            <SubscriptionList
              subscriptions={subscriptions}
              stockPrices={stockPrices}
              busyStockCode={busyStockCode}
              priceDirectionByStock={priceDirectionByStock}
              lastUpdatedAtByStock={lastUpdatedAtByStock}
              onUnsubscribe={handleUnsubscribe}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

export default DashboardPage;
