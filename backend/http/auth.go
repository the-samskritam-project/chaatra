package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
)

// SignInRequest represents the sign-in request body
type SignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// SignUpRequest represents the sign-up request body
type SignUpRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// SignUpResponse represents the sign-up response
type SignUpResponse struct {
	Token string    `json:"token"`
	User  *UserInfo `json:"user"`
}

// SignInResponse represents the sign-in response
type SignInResponse struct {
	Token string    `json:"token"`
	User  *UserInfo `json:"user"`
}

// UserInfo represents user information in responses
type UserInfo struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}


// SignInHandler handles user sign-in requests
func SignInHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}

	if req.Password == "" {
		http.Error(w, "password is required", http.StatusBadRequest)
		return
	}

	// Look up user by email
	user, err := persistence.GetUserByEmail(req.Email)
	if err != nil {
		log.Printf("Error looking up user: %v", err)
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	if user == nil {
		// Return generic error to prevent user enumeration
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Verify password
	if user.PasswordHash == "" {
		// User exists but has no password hash (legacy user)
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	err = service.VerifyPassword(user.PasswordHash, req.Password)
	if err != nil {
		// Password doesn't match
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Generate JWT token
	token, err := service.GenerateToken(user)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token and user info
	response := SignInResponse{
		Token: token,
		User: &UserInfo{
			Email: user.Email,
			Name:  user.Name,
			Role:  user.Role,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// isValidEmail performs basic email format validation
func isValidEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// SignUpHandler handles user sign-up requests
func SignUpHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SignUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if req.Password == "" {
		http.Error(w, "password is required", http.StatusBadRequest)
		return
	}

	// Validate email format
	if !isValidEmail(req.Email) {
		http.Error(w, "invalid email format", http.StatusBadRequest)
		return
	}

	// Validate password length (minimum 8 characters)
	if len(req.Password) < 8 {
		http.Error(w, "password must be at least 8 characters long", http.StatusBadRequest)
		return
	}

	// Check if user already exists
	existingUser, err := persistence.GetUserByEmail(req.Email)
	if err != nil {
		log.Printf("Error checking existing user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if existingUser != nil {
		http.Error(w, "user with this email already exists", http.StatusConflict)
		return
	}

	// Hash password
	passwordHash, err := service.HashPassword(req.Password)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		http.Error(w, "Failed to process password", http.StatusInternalServerError)
		return
	}

	// Create user with hashed password
	user, err := persistence.CreateUserWithPassword(req.Email, req.Name, passwordHash)
	if err != nil {
		// Check if it's a duplicate email error
		if strings.Contains(err.Error(), "already exists") {
			http.Error(w, "user with this email already exists", http.StatusConflict)
			return
		}

		log.Printf("Error creating user: %v", err)
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Generate JWT token
	token, err := service.GenerateToken(user)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token and user info
	response := SignUpResponse{
		Token: token,
		User: &UserInfo{
			Email: user.Email,
			Name:  user.Name,
			Role:  user.Role,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

