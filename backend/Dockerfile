# Use an official Go runtime as a parent image
FROM golang:1.25 AS builder

# Set the working directory inside the container
WORKDIR /go/src/chaatra/backend

# Copy go.mod and go.sum first for better caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the backend source
COPY . .

# Build your application statically
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o samskritam .

# Use minimal base image for runtime
FROM debian:bookworm-slim

# Set the working directory
WORKDIR /root/

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Import the compiled executable from the first stage
COPY --from=builder /go/src/chaatra/backend/samskritam /root/samskritam

# Import the dictionary.xml file
COPY --from=builder /go/src/chaatra/backend/core/parser/dictionary.xml /root/dictionary.xml

RUN mkdir -p /root/chroma_db
COPY data/valmiki_ramayan_shlokas_filtered.json /root/chroma_db/valmiki_ramayan_shlokas_filtered.json

# Copy ramayana rarity data if needed
COPY data/shlokas_with_rarity.json /root/shlokas_with_rarity.json

# Ensure executable permissions for Go binary
RUN chmod +x /root/samskritam

# Expose port
EXPOSE 8081

# Use Railway PORT if set, otherwise default to 8081
ENV PORT=8081

# Command to run the Go server
CMD ["/root/samskritam"]
