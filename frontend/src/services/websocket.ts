export function createStockUpdatesSocket(token: string): WebSocket {
  const url = new URL("/ws", window.location.origin);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);

  return new WebSocket(url);
}

