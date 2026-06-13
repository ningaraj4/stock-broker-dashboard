# Stock Broker Client Web Dashboard

Complete full-stack application using:

- Frontend: React + TypeScript + Vite
- Backend: Go + Gin + Gorilla WebSocket
- Database: SQLite + GORM
- Authentication: JWT after email login

## Features

- Email-only login that creates a user automatically if the email does not exist
- JWT-based protected REST APIs
- SQLite persistence for users and stock subscriptions
- Exactly five supported stocks: `GOOG`, `TSLA`, `AMZN`, `META`, `NVDA`
- Random in-memory stock price simulator that updates every second
- WebSocket-based live updates filtered per user subscription
- Multiple concurrent users supported with isolated stock streams

## UX Enhancements
- **Optimistic UI:** Instant visual feedback when subscribing/unsubscribing to stocks without waiting for server roundtrips.
- **Skeleton Loaders:** Animated loading states to prevent layout shift during initial data fetch.
- **Glassmorphism Design:** Premium UI with a functional Light/Dark mode toggle that persists in `localStorage`.

## Project Structure

```text
project/
├── backend/
│   ├── main.go
│   ├── schema.sql
│   ├── database/
│   ├── handlers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── websocket/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── types/
│       └── App.tsx
└── README.md
```

## Backend Overview

- [backend/main.go](./backend/main.go): boots the SQLite connection, JWT service, stock simulator, WebSocket hub, and Gin server.
- [backend/database/database.go](./backend/database/database.go): opens SQLite, enables foreign keys, and auto-migrates the schema.
- [backend/models/user.go](./backend/models/user.go): defines the `users` table model.
- [backend/models/subscription.go](./backend/models/subscription.go): defines the `subscriptions` table with duplicate-prevention unique index.
- [backend/services/auth_service.go](./backend/services/auth_service.go): generates and validates JWT tokens.
- [backend/services/stock_service.go](./backend/services/stock_service.go): owns the supported stock list, current prices, and one-second random price simulation.
- [backend/websocket/hub.go](./backend/websocket/hub.go): tracks active connections and broadcasts only subscribed stock updates to each user.
- [backend/handlers/auth_handler.go](./backend/handlers/auth_handler.go): handles `/api/login`.
- [backend/handlers/stock_handler.go](./backend/handlers/stock_handler.go): returns supported stocks with current prices.
- [backend/handlers/subscription_handler.go](./backend/handlers/subscription_handler.go): handles subscription CRUD and WebSocket subscription refresh.
- [backend/handlers/websocket_handler.go](./backend/handlers/websocket_handler.go): authenticates `/ws` connections and manages socket lifecycle.
- [backend/middleware/auth_middleware.go](./backend/middleware/auth_middleware.go): protects authenticated API routes.
- [backend/routes/routes.go](./backend/routes/routes.go): wires routes, middleware, and handlers together.

## Frontend Overview

- [frontend/src/App.tsx](./frontend/src/App.tsx): top-level auth-aware app shell.
- [frontend/src/pages/LoginPage.tsx](./frontend/src/pages/LoginPage.tsx): email login form and session creation UX.
- [frontend/src/pages/DashboardPage.tsx](./frontend/src/pages/DashboardPage.tsx): loads data, handles subscribe/unsubscribe actions, and renders live dashboard state.
- [frontend/src/components/StockTable.tsx](./frontend/src/components/StockTable.tsx): supported stocks table and subscribe action.
- [frontend/src/components/SubscriptionList.tsx](./frontend/src/components/SubscriptionList.tsx): subscribed stocks sidebar and unsubscribe action.
- [frontend/src/hooks/useStockUpdates.ts](./frontend/src/hooks/useStockUpdates.ts): opens the WebSocket, handles reconnects, and pushes `stock_update` events into React state.
- [frontend/src/services/api.ts](./frontend/src/services/api.ts): typed REST client for login, stock listing, and subscription APIs.
- [frontend/src/services/websocket.ts](./frontend/src/services/websocket.ts): constructs the authenticated WebSocket connection URL.
- [frontend/src/services/storage.ts](./frontend/src/services/storage.ts): persists the JWT session in `localStorage`.
- [frontend/src/types/index.ts](./frontend/src/types/index.ts): shared frontend API and event types.

## SQLite Schema

The backend auto-creates the database on startup. The schema is also provided in [backend/schema.sql](./backend/schema.sql).

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_user_stock ON subscriptions(user_id, stock_code);
```

## API Summary

- `POST /api/login`
- `GET /api/stocks`
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `DELETE /api/subscriptions/:stockCode`
- `GET /ws`

WebSocket messages from server use:

```json
{
  "event": "stock_update",
  "payload": {
    "stockCode": "GOOG",
    "price": 143.25,
    "timestamp": "2026-06-13T10:30:00Z"
  }
}
```

## Local Setup

### 1. Run the backend

```bash
cd backend
go mod tidy
go run .
```

Backend runs on `http://localhost:8080`.

Optional environment variables:

```bash
PORT=8080
JWT_SECRET=development-secret-key
DATABASE_PATH=stockbroker.db
GIN_MODE=release
TRUSTED_PROXIES=
```

### 2. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

The Vite dev server proxies `/api` and `/ws` to the Go backend, so no frontend environment variables are required for local development.

## How It Works

1. User logs in with an email address.
2. Backend validates the email, creates the user if needed, and returns a JWT.
3. Frontend stores the token in `localStorage`.
4. Dashboard fetches supported stocks and the user's subscriptions.
5. Dashboard opens `/ws?token=...`.
6. Backend simulator updates all stock prices every second.
7. WebSocket hub forwards each update only to clients subscribed to that stock.

## Notes

- No external stock APIs are used.
- Stock prices are always kept above zero.
- Duplicate subscriptions are blocked with both application checks and a database unique index.
- Multiple users can stay connected simultaneously and receive different live stock streams.
