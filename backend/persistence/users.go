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
	Email     string    `json:"email" bson:"email"`
	Name      string    `json:"name" bson:"name"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

// getUsersCollection returns the users collection from the MongoDB database
func getUsersCollection() *mongo.Collection {
	if mongoClient == nil {
		return nil
	}
	// Use the same database as configured in InitMongoDB
	// If mongoDB is initialized, use it; otherwise create a new database reference
	if mongoDB != nil {
		return mongoDB.Collection("users")
	}
	// Fallback: use default database name
	databaseName := os.Getenv("MONGODB_DATABASE")
	if databaseName == "" {
		databaseName = "hitopadesa"
	}
	return mongoClient.Database(databaseName).Collection("users")
}

// GetUserByEmail retrieves a user by email address
func GetUserByEmail(email string) (*User, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := getUsersCollection()
	if collection == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	var user User
	err := collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // User not found, return nil without error
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
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

	collection := getUsersCollection()
	if collection == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
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

	log.Printf("Created user with ID: %v", result.InsertedID)

	return &user, nil
}
