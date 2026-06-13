package services

import (
	"errors"
	"time"

	"stockbroker/backend/models"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint   `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

type AuthService struct {
	secret []byte
	ttl    time.Duration
}

func NewAuthService(secret string) *AuthService {
	return &AuthService{
		secret: []byte(secret),
		ttl:    24 * time.Hour,
	}
}

func (s *AuthService) GenerateToken(user models.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *AuthService) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}

		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
