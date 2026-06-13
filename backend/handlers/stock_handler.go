package handlers

import (
	"net/http"

	"stockbroker/backend/services"

	"github.com/gin-gonic/gin"
)

type StockHandler struct {
	StockService *services.StockService
}

func NewStockHandler(stockService *services.StockService) *StockHandler {
	return &StockHandler{StockService: stockService}
}

func (h *StockHandler) ListStocks(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"stocks": h.StockService.GetAllStocks(),
	})
}
