package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// User represents a user in the system
type User struct {
	ID           interface{} `json:"id,omitempty" bson:"_id,omitempty"`
	Email        string      `json:"email" bson:"email"`
	Name         string      `json:"name" bson:"name"`
	Role         string      `json:"role" bson:"role"` // "admin" or "user" (default: "user")
	PasswordHash string      `json:"-" bson:"password_hash"` // Password hash (not returned in JSON)
	CreatedAt    time.Time   `json:"created_at" bson:"created_at"`
}

// getUsersDatabase returns the users database
func getUsersDatabase() *mongo.Database {
	if mongoClient == nil {
		return nil
	}
	// Use a dedicated database for users (configurable via env var)
	dbName := os.Getenv("MONGODB_USERS_DATABASE")
	if dbName == "" {
		dbName = "users_db" // Default
	}
	return mongoClient.Database(dbName)
}

// getUsersCollection returns the users collection from a dedicated users database
func getUsersCollection() (*mongo.Collection, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	usersDB := getUsersDatabase()
	if usersDB == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	return usersDB.Collection("users"), nil
}

// GetUserByEmail retrieves a user by email address
func GetUserByEmail(email string) (*User, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection, err := getUsersCollection()
	if err != nil {
		return nil, err
	}

	var user User
	err = collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // User not found, return nil without error
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	// The ID should be automatically decoded from _id field
	// If it's still nil, we need to fetch it separately
	if user.ID == nil {
		var result bson.M
		if err := collection.FindOne(ctx, bson.M{"email": email}).Decode(&result); err == nil {
			if id, ok := result["_id"]; ok {
				user.ID = id
			}
		}
	}

	return &user, nil
}

// CreateUserWithPassword creates a new user in the database with a password hash
func CreateUserWithPassword(email string, name string, passwordHash string) (*User, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection, err := getUsersCollection()
	if err != nil {
		return nil, err
	}

	// Check if user already exists
	existingUser, err := GetUserByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}
	if existingUser != nil {
		return nil, fmt.Errorf("user with email %s already exists", email)
	}

	// Create new user
	user := User{
		Email:        email,
		Name:         name,
		Role:         "user", // Default role
		PasswordHash: passwordHash,
		CreatedAt:    time.Now(),
	}

	// Create unique index on email if it doesn't exist
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Index might already exist, log but don't fail
		log.Printf("Note: Could not create unique index on email (may already exist): %v", err)
	}

	// Insert user
	result, err := collection.InsertOne(ctx, user)
	if err != nil {
		// Check if it's a duplicate key error
		if mongo.IsDuplicateKeyError(err) {
			return nil, fmt.Errorf("user with email %s already exists", email)
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Set the ID from the inserted result
	user.ID = result.InsertedID
	log.Printf("Created user with ID: %v", result.InsertedID)

	return &user, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(userID interface{}) (*User, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection, err := getUsersCollection()
	if err != nil {
		return nil, err
	}

	// Convert userID to ObjectID if it's a string
	var filter bson.M
	if str, ok := userID.(string); ok {
		// Try to convert string to ObjectID
		if objID, err := primitive.ObjectIDFromHex(str); err == nil {
			filter = bson.M{"_id": objID}
		} else {
			// If conversion fails, try as string
			filter = bson.M{"_id": str}
		}
	} else if objID, ok := userID.(primitive.ObjectID); ok {
		// Already an ObjectID
		filter = bson.M{"_id": objID}
	} else {
		// Use as-is
		filter = bson.M{"_id": userID}
	}

	var user User
	err = collection.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // User not found, return nil without error
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	return &user, nil
}

// IsAdmin checks if a user has admin role
func IsAdmin(user *User) bool {
	if user == nil {
		return false
	}
	return user.Role == "admin"
}

// UpdateUserRole updates a user's role
func UpdateUserRole(email string, role string) (*User, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	// Validate role
	if role != "admin" && role != "user" {
		return nil, fmt.Errorf("invalid role: %s (must be 'admin' or 'user')", role)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection, err := getUsersCollection()
	if err != nil {
		return nil, err
	}

	// Check if user exists
	existingUser, err := GetUserByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}
	if existingUser == nil {
		return nil, fmt.Errorf("user with email %s not found", email)
	}

	// Update user role
	update := bson.M{
		"$set": bson.M{
			"role": role,
		},
	}

	result := collection.FindOneAndUpdate(
		ctx,
		bson.M{"email": email},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	)

	if result.Err() != nil {
		if result.Err() == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("user with email %s not found", email)
		}
		return nil, fmt.Errorf("failed to update user role: %w", result.Err())
	}

	var updatedUser User
	if err := result.Decode(&updatedUser); err != nil {
		return nil, fmt.Errorf("failed to decode updated user: %w", err)
	}

	return &updatedUser, nil
}
