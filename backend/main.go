package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"stockbroker/backend/database"
	"stockbroker/backend/routes"
	"stockbroker/backend/services"
	ws "stockbroker/backend/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(getEnv("GIN_MODE", gin.ReleaseMode))

	port := getEnv("PORT", "8080")
	jwtSecret := getEnv("JWT_SECRET", "development-secret-key")
	databasePath := getEnv("DATABASE_PATH", "stockbroker.db")

	db, err := database.Connect(databasePath)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	authService := services.NewAuthService(jwtSecret)
	stockService := services.NewStockService()
	hub := ws.NewHub()

	go hub.Run()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go stockService.Start(ctx, time.Second, hub.QueuePriceUpdate)

	router := routes.SetupRouter(db, authService, stockService, hub)
	if err := router.SetTrustedProxies(getTrustedProxies()); err != nil {
		log.Fatalf("failed to configure trusted proxies: %v", err)
	}

	log.Printf("backend server listening on http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func getTrustedProxies() []string {
	rawValue := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if rawValue == "" {
		// Default to no trusted proxies to avoid trusting all forwarding headers.
		return nil
	}

	parts := strings.Split(rawValue, ",")
	proxies := make([]string, 0, len(parts))
	for _, part := range parts {
		if proxy := strings.TrimSpace(part); proxy != "" {
			proxies = append(proxies, proxy)
		}
	}

	return proxies
}

// end of file

// end

// EOF

// EOF
