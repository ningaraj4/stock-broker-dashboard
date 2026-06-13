package handlers

import (
	"errors"
	"net/http"
	"strings"

	"stockbroker/backend/models"
	"stockbroker/backend/services"
	ws "stockbroker/backend/websocket"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SubscriptionHandler struct {
	DB           *gorm.DB
	StockService *services.StockService
	Hub          *ws.Hub
}

type subscriptionRequest struct {
	StockCode string `json:"stockCode"`
}

type subscriptionResponse struct {
	ID        uint   `json:"id"`
	StockCode string `json:"stockCode"`
}

func NewSubscriptionHandler(db *gorm.DB, stockService *services.StockService, hub *ws.Hub) *SubscriptionHandler {
	return &SubscriptionHandler{
		DB:           db,
		StockService: stockService,
		Hub:          hub,
	}
}

func (h *SubscriptionHandler) ListSubscriptions(c *gin.Context) {
	userID := c.GetUint("userID")

	var subscriptions []models.Subscription
	if err := h.DB.Where("user_id = ?", userID).Order("stock_code ASC").Find(&subscriptions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load subscriptions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"subscriptions": mapSubscriptions(subscriptions),
	})
}

func (h *SubscriptionHandler) Subscribe(c *gin.Context) {
	userID := c.GetUint("userID")

	var request subscriptionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	stockCode := strings.ToUpper(strings.TrimSpace(request.StockCode))
	if !h.StockService.IsSupportedStock(stockCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stock code"})
		return
	}

	var existing models.Subscription
	err := h.DB.Where("user_id = ? AND stock_code = ?", userID, stockCode).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "stock already subscribed"})
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate subscription"})
		return
	}

	subscription := models.Subscription{
		UserID:    userID,
		StockCode: stockCode,
	}
	if err := h.DB.Create(&subscription).Error; err != nil {
		if isUniqueConstraintError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "stock already subscribed"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create subscription"})
		return
	}

	if err := h.refreshUserSubscriptions(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "subscription created but websocket sync failed"})
		return
	}

	c.JSON(http.StatusCreated, subscriptionResponse{
		ID:        subscription.ID,
		StockCode: subscription.StockCode,
	})
}

func (h *SubscriptionHandler) Unsubscribe(c *gin.Context) {
	userID := c.GetUint("userID")
	stockCode := strings.ToUpper(strings.TrimSpace(c.Param("stockCode")))

	if !h.StockService.IsSupportedStock(stockCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stock code"})
		return
	}

	result := h.DB.Where("user_id = ? AND stock_code = ?", userID, stockCode).Delete(&models.Subscription{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete subscription"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	if err := h.refreshUserSubscriptions(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "subscription removed but websocket sync failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "subscription removed"})
}

func (h *SubscriptionHandler) refreshUserSubscriptions(userID uint) error {
	var subscriptions []models.Subscription
	if err := h.DB.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		return err
	}

	stockCodes := make([]string, 0, len(subscriptions))
	for _, subscription := range subscriptions {
		stockCodes = append(stockCodes, subscription.StockCode)
	}

	h.Hub.UpdateUserSubscriptions(userID, stockCodes)
	return nil
}

func mapSubscriptions(subscriptions []models.Subscription) []subscriptionResponse {
	response := make([]subscriptionResponse, 0, len(subscriptions))
	for _, subscription := range subscriptions {
		response = append(response, subscriptionResponse{
			ID:        subscription.ID,
			StockCode: subscription.StockCode,
		})
	}

	return response
}
