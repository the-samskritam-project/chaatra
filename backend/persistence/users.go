package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// User represents a user in the system
type User struct {
	ID        interface{} `json:"id,omitempty" bson:"_id,omitempty"`
	Email     string      `json:"email" bson:"email"`
	Name      string      `json:"name" bson:"name"`
	CreatedAt time.Time   `json:"created_at" bson:"created_at"`
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

// CreateUser creates a new user in the database
func CreateUser(email string, name string) (*User, error) {
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
		Email:     email,
		Name:      name,
		CreatedAt: time.Now(),
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
