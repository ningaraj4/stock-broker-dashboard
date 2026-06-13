package middleware

import (
	"net/http"
	"strings"

	"stockbroker/backend/services"

	"github.com/gin-gonic/gin"
)

type AuthMiddleware struct {
	AuthService *services.AuthService
}

func NewAuthMiddleware(authService *services.AuthService) *AuthMiddleware {
	return &AuthMiddleware{AuthService: authService}
}

func (m *AuthMiddleware) Handle(c *gin.Context) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return
	}

	claims, err := m.AuthService.ParseToken(strings.TrimSpace(parts[1]))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	c.Set("userID", claims.UserID)
	c.Set("userEmail", claims.Email)
	c.Next()
}
