package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// SignInRequest represents the sign-in request body
type SignInRequest struct {
	Email string `json:"email"`
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
}

// CreateUserRequest represents the create user request body
type CreateUserRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

// CreateUserResponse represents the create user response
type CreateUserResponse struct {
	User *UserInfo `json:"user"`
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

	// Look up user by email
	user, err := persistence.GetUserByEmail(req.Email)
	if err != nil {
		log.Printf("Error looking up user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if user == nil {
		http.Error(w, "Invalid email or user not found", http.StatusUnauthorized)
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
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateUserHandler handles user creation requests (protected by API key)
func CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateUserRequest
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

	// Create user
	user, err := persistence.CreateUser(req.Email, req.Name)
	if err != nil {
		// Check if it's a duplicate email error
		if err.Error() == fmt.Sprintf("user with email %s already exists", req.Email) {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}

		log.Printf("Error creating user: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create user: %v", err), http.StatusInternalServerError)
		return
	}

	// Return created user info
	response := CreateUserResponse{
		User: &UserInfo{
			Email: user.Email,
			Name:  user.Name,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
