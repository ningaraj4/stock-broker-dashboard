export type User = {
  id: number;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type AuthSession = AuthResponse;

export type Stock = {
  stockCode: string;
  price: number;
};

export type StocksResponse = {
  stocks: Stock[];
};

export type Subscription = {
  id: number;
  stockCode: string;
};

export type SubscriptionsResponse = {
  subscriptions: Subscription[];
};

export type StockUpdate = {
  stockCode: string;
  price: number;
  timestamp: string;
};

export type StockUpdateMessage = {
  event: "stock_update";
  payload: StockUpdate;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type PriceDirection = "up" | "down" | "flat";
