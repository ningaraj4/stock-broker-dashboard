import { useEffect, useRef } from "react";
import { createStockUpdatesSocket } from "../services/websocket";
import type {
  ConnectionStatus,
  StockUpdate,
  StockUpdateMessage,
} from "../types";

type UseStockUpdatesOptions = {
  token: string | null;
  onUpdate: (update: StockUpdate) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
};

export function useStockUpdates({
  token,
  onUpdate,
  onStatusChange,
  onError,
}: UseStockUpdatesOptions) {
  const handlersRef = useRef({
    onUpdate,
    onStatusChange,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onUpdate,
      onStatusChange,
      onError,
    };
  }, [onUpdate, onStatusChange, onError]);

  useEffect(() => {
    if (!token) {
      handlersRef.current.onStatusChange("disconnected");
      return;
    }

    let reconnectTimeout: number | undefined;
    let shouldReconnect = true;
    let socket: WebSocket | null = null;

    const connect = () => {
      handlersRef.current.onStatusChange("connecting");
      socket = createStockUpdatesSocket(token);

      socket.onopen = () => {
        handlersRef.current.onStatusChange("connected");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as StockUpdateMessage;
          if (message.event === "stock_update") {
            handlersRef.current.onUpdate(message.payload);
          }
        } catch {
          handlersRef.current.onError("Received an invalid stock update payload.");
        }
      };

      socket.onerror = () => {
        handlersRef.current.onError("WebSocket connection error.");
      };

      socket.onclose = () => {
        handlersRef.current.onStatusChange("disconnected");
        if (shouldReconnect) {
          reconnectTimeout = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
      socket?.close();
    };
  }, [token]);
}

