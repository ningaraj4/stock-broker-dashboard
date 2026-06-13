package handlers

import (
	"net/http"
	"strings"
	"time"

	"stockbroker/backend/models"
	"stockbroker/backend/services"
	ws "stockbroker/backend/websocket"

	"github.com/gin-gonic/gin"
	gws "github.com/gorilla/websocket"
	"gorm.io/gorm"
)

const (
	maxMessageSize = 512
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
)

type WebSocketHandler struct {
	DB          *gorm.DB
	AuthService *services.AuthService
	Hub         *ws.Hub
	Upgrader    gws.Upgrader
}

func NewWebSocketHandler(db *gorm.DB, authService *services.AuthService, hub *ws.Hub) *WebSocketHandler {
	return &WebSocketHandler{
		DB:          db,
		AuthService: authService,
		Hub:         hub,
		Upgrader: gws.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
	}
}

func (h *WebSocketHandler) Connect(c *gin.Context) {
	tokenString := strings.TrimSpace(c.Query("token"))
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing websocket token"})
		return
	}

	claims, err := h.AuthService.ParseToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid websocket token"})
		return
	}

	subscriptions, err := h.loadSubscriptionCodes(claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load subscriptions"})
		return
	}

	conn, err := h.Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := ws.NewClient(conn, claims.UserID, subscriptions)
	h.Hub.Register(client)

	go h.writePump(client)
	h.readPump(client)
}

func (h *WebSocketHandler) loadSubscriptionCodes(userID uint) ([]string, error) {
	var subscriptions []models.Subscription
	if err := h.DB.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		return nil, err
	}

	stockCodes := make([]string, 0, len(subscriptions))
	for _, subscription := range subscriptions {
		stockCodes = append(stockCodes, subscription.StockCode)
	}

	return stockCodes, nil
}

func (h *WebSocketHandler) readPump(client *ws.Client) {
	defer h.Hub.Unregister(client)

	client.Conn.SetReadLimit(maxMessageSize)
	_ = client.Conn.SetReadDeadline(time.Now().Add(pongWait))
	client.Conn.SetPongHandler(func(string) error {
		return client.Conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		if _, _, err := client.Conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (h *WebSocketHandler) writePump(client *ws.Client) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	defer client.Conn.Close()

	for {
		select {
		case message, ok := <-client.Send:
			_ = client.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = client.Conn.WriteMessage(gws.CloseMessage, []byte{})
				return
			}

			if err := client.Conn.WriteMessage(gws.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = client.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := client.Conn.WriteMessage(gws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
