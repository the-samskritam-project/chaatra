package service

import (
	"chaatra/persistence"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims represents the JWT token claims
type JWTClaims struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	jwt.RegisteredClaims
}

// getJWTSecret returns the JWT secret from environment variable
func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// For development, use a default secret (should be set in production)
		secret = "dev-secret-key-change-in-production"
	}
	return []byte(secret)
}

// GenerateToken generates a JWT token for a user
func GenerateToken(user *persistence.User) (string, error) {
	if user == nil {
		return "", fmt.Errorf("user cannot be nil")
	}

	// Set expiration time (24 hours from now)
	expirationTime := time.Now().Add(24 * time.Hour)

	// Create claims
	claims := &JWTClaims{
		Email: user.Email,
		Name:  user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token with secret
	tokenString, err := token.SignedString(getJWTSecret())
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*JWTClaims, error) {
	// Parse token
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return getJWTSecret(), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Validate token and extract claims
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	// Check expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("token has expired")
	}

	return claims, nil
}
