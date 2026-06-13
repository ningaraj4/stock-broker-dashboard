package websocket

import (
	"encoding/json"

	"stockbroker/backend/services"

	gws "github.com/gorilla/websocket"
)

type Client struct {
	Conn          *gws.Conn
	UserID        uint
	Send          chan []byte
	subscriptions map[string]struct{}
}

type subscriptionUpdate struct {
	UserID uint
	Stocks map[string]struct{}
}

type outboundEvent struct {
	Event   string               `json:"event"`
	Payload services.StockUpdate `json:"payload"`
}

type Hub struct {
	clients             map[*Client]struct{}
	register            chan *Client
	unregister          chan *Client
	stockUpdates        chan services.StockUpdate
	subscriptionUpdates chan subscriptionUpdate
}

func NewHub() *Hub {
	return &Hub{
		clients:             make(map[*Client]struct{}),
		register:            make(chan *Client),
		unregister:          make(chan *Client),
		stockUpdates:        make(chan services.StockUpdate, len(services.SupportedStocks)*4),
		subscriptionUpdates: make(chan subscriptionUpdate, 32),
	}
}

func NewClient(conn *gws.Conn, userID uint, stocks []string) *Client {
	return &Client{
		Conn:          conn,
		UserID:        userID,
		Send:          make(chan []byte, 32),
		subscriptions: stockSet(stocks),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}
		case client := <-h.unregister:
			h.removeClient(client)
		case update := <-h.stockUpdates:
			h.broadcastStockUpdate(update)
		case update := <-h.subscriptionUpdates:
			for client := range h.clients {
				if client.UserID == update.UserID {
					client.subscriptions = cloneStockSet(update.Stocks)
				}
			}
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) QueuePriceUpdate(update services.StockUpdate) {
	h.stockUpdates <- update
}

func (h *Hub) UpdateUserSubscriptions(userID uint, stocks []string) {
	h.subscriptionUpdates <- subscriptionUpdate{
		UserID: userID,
		Stocks: stockSet(stocks),
	}
}

func (h *Hub) removeClient(client *Client) {
	if _, ok := h.clients[client]; !ok {
		return
	}

	delete(h.clients, client)
	close(client.Send)
	_ = client.Conn.Close()
}

func (h *Hub) broadcastStockUpdate(update services.StockUpdate) {
	message, err := json.Marshal(outboundEvent{
		Event:   "stock_update",
		Payload: update,
	})
	if err != nil {
		return
	}

	for client := range h.clients {
		if _, subscribed := client.subscriptions[update.StockCode]; !subscribed {
			continue
		}

		select {
		case client.Send <- message:
		default:
			h.removeClient(client)
		}
	}
}

func stockSet(stocks []string) map[string]struct{} {
	result := make(map[string]struct{}, len(stocks))
	for _, stockCode := range stocks {
		result[stockCode] = struct{}{}
	}

	return result
}

func cloneStockSet(source map[string]struct{}) map[string]struct{} {
	result := make(map[string]struct{}, len(source))
	for stockCode := range source {
		result[stockCode] = struct{}{}
	}

	return result
}
