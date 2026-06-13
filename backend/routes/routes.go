package routes

import (
	"net/http"

	"stockbroker/backend/handlers"
	"stockbroker/backend/middleware"
	"stockbroker/backend/services"
	ws "stockbroker/backend/websocket"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, authService *services.AuthService, stockService *services.StockService, hub *ws.Hub) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware())

	authHandler := handlers.NewAuthHandler(db, authService)
	stockHandler := handlers.NewStockHandler(stockService)
	subscriptionHandler := handlers.NewSubscriptionHandler(db, stockService, hub)
	websocketHandler := handlers.NewWebSocketHandler(db, authService, hub)
	authMiddleware := middleware.NewAuthMiddleware(authService)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api")
	api.POST("/login", authHandler.Login)

	protected := api.Group("/")
	protected.Use(authMiddleware.Handle)
	protected.GET("/stocks", stockHandler.ListStocks)
	protected.GET("/subscriptions", subscriptionHandler.ListSubscriptions)
	protected.POST("/subscriptions", subscriptionHandler.Subscribe)
	protected.DELETE("/subscriptions/:stockCode", subscriptionHandler.Unsubscribe)

	router.GET("/ws", websocketHandler.Connect)

	return router
}
