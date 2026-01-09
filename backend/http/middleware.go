package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

// ContextKey is a type for context keys
type ContextKey string

const (
	// UserEmailKey is the context key for user email
	UserEmailKey ContextKey = "user_email"
	// UserNameKey is the context key for user name
	UserNameKey ContextKey = "user_name"
	// UserIDKey is the context key for user ID
	UserIDKey ContextKey = "user_id"
)

// APIKeyMiddleware validates the API key from request headers
func APIKeyMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		apiKey := os.Getenv("API_KEY")
		if apiKey == "" {
			http.Error(w, "API_KEY not configured", http.StatusInternalServerError)
			return
		}

		// Try to get API key from X-API-Key header first
		providedKey := r.Header.Get("X-API-Key")

		// If not found, try Authorization header with Bearer format
		if providedKey == "" {
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				// Check if it's in Bearer format
				if strings.HasPrefix(authHeader, "Bearer ") {
					providedKey = strings.TrimPrefix(authHeader, "Bearer ")
				} else {
					// If not Bearer format, use the whole header value
					providedKey = authHeader
				}
			}
		}

		if providedKey == "" {
			http.Error(w, "API key is required (use X-API-Key header or Authorization: Bearer <key>)", http.StatusUnauthorized)
			return
		}

		if providedKey != apiKey {
			http.Error(w, "Invalid API key", http.StatusUnauthorized)
			return
		}

		// API key is valid, proceed to next handler
		next(w, r)
	}
}

// JWTAuthMiddleware validates JWT token and attaches user info to context
func JWTAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Handle OPTIONS preflight requests (CORS)
		if r.Method == http.MethodOptions {
			next(w, r)
			return
		}

		// Get token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header is required", http.StatusUnauthorized)
			return
		}

		// Extract token from "Bearer <token>" format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Authorization header must be in format: Bearer <token>", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := service.ValidateToken(tokenString)
		if err != nil {
			log.Printf("JWT validation failed for %s: %v", r.URL.Path, err)
			http.Error(w, fmt.Sprintf("Invalid token: %v", err), http.StatusUnauthorized)
			return
		}

		// Attach user info to context
		ctx := context.WithValue(r.Context(), UserEmailKey, claims.Email)
		ctx = context.WithValue(ctx, UserNameKey, claims.Name)
		ctx = context.WithValue(ctx, UserIDKey, claims.UserID)

		// Create new request with updated context
		r = r.WithContext(ctx)

		// Proceed to next handler
		next(w, r)
	}
}

// GetUserFromContext extracts user email from request context
func GetUserFromContext(r *http.Request) (email string, name string, ok bool) {
	emailVal := r.Context().Value(UserEmailKey)
	nameVal := r.Context().Value(UserNameKey)

	if emailVal == nil {
		return "", "", false
	}

	email, ok = emailVal.(string)
	if !ok {
		return "", "", false
	}

	name, _ = nameVal.(string)
	return email, name, true
}

// GetUserIDFromContext extracts user ID from request context
func GetUserIDFromContext(r *http.Request) (interface{}, bool) {
	userIDVal := r.Context().Value(UserIDKey)
	if userIDVal == nil {
		return nil, false
	}
	return userIDVal, true
}

// AdminMiddleware checks if the authenticated user has admin role
// Must be used after JWTAuthMiddleware
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get user ID from context (set by JWTAuthMiddleware)
		userID, ok := GetUserIDFromContext(r)
		if !ok {
			http.Error(w, "User not authenticated", http.StatusUnauthorized)
			return
		}

		// Get user from database
		user, err := persistence.GetUserByID(userID)
		if err != nil {
			log.Printf("Error getting user from database: %v", err)
			http.Error(w, fmt.Sprintf("Failed to get user: %v", err), http.StatusInternalServerError)
			return
		}

		if user == nil {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		}

		// Check if user is admin
		if !persistence.IsAdmin(user) {
			http.Error(w, "Admin access required", http.StatusForbidden)
			return
		}

		// User is admin, proceed
		next(w, r)
	}
}
