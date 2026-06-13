import type {
  AuthResponse,
  StocksResponse,
  SubscriptionsResponse,
} from "../types";

type RequestOptions = Omit<RequestInit, "headers"> & {
  token?: string;
  headers?: HeadersInit;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

export function login(email: string) {
  return requestJson<AuthResponse>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getStocks(token: string) {
  return requestJson<StocksResponse>("/api/stocks", {
    method: "GET",
    token,
  });
}

export function getSubscriptions(token: string) {
  return requestJson<SubscriptionsResponse>("/api/subscriptions", {
    method: "GET",
    token,
  });
}

export function subscribeToStock(token: string, stockCode: string) {
  return requestJson<{ id: number; stockCode: string }>("/api/subscriptions", {
    method: "POST",
    token,
    body: JSON.stringify({ stockCode }),
  });
}

export function unsubscribeFromStock(token: string, stockCode: string) {
  return requestJson<{ message: string }>(`/api/subscriptions/${stockCode}`, {
    method: "DELETE",
    token,
  });
}

