package handlers

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"stockbroker/backend/models"
	"stockbroker/backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB          *gorm.DB
	AuthService *services.AuthService
}

type loginRequest struct {
	Email string `json:"email"`
}

type loginResponse struct {
	Token string          `json:"token"`
	User  loginUserFields `json:"user"`
}

type loginUserFields struct {
	ID    uint   `json:"id"`
	Email string `json:"email"`
}

func NewAuthHandler(db *gorm.DB, authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		DB:          db,
		AuthService: authService,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(request.Email))
	if !isValidEmail(email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email address"})
		return
	}

	user, err := h.findOrCreateUser(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to login user"})
		return
	}

	token, err := h.AuthService.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, loginResponse{
		Token: token,
		User: loginUserFields{
			ID:    user.ID,
			Email: user.Email,
		},
	})
}

func (h *AuthHandler) findOrCreateUser(email string) (models.User, error) {
	var user models.User
	err := h.DB.Where("email = ?", email).First(&user).Error
	switch {
	case err == nil:
		return user, nil
	case errors.Is(err, gorm.ErrRecordNotFound):
		user = models.User{Email: email}
		if createErr := h.DB.Create(&user).Error; createErr != nil {
			if isUniqueConstraintError(createErr) {
				if retryErr := h.DB.Where("email = ?", email).First(&user).Error; retryErr == nil {
					return user, nil
				}
			}

			return models.User{}, createErr
		}

		return user, nil
	default:
		return models.User{}, err
	}
}

func isValidEmail(email string) bool {
	parsedAddress, err := mail.ParseAddress(email)
	return err == nil && parsedAddress.Address == email
}

func isUniqueConstraintError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "constraint")
}
