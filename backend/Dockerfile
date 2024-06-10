# Use an official Go runtime as a parent image
FROM golang:1.22 as builder

# Set the working directory inside the container
WORKDIR /go/src/chaatra/backend

# Copy the local package files to the container's workspace
COPY . .

# Download any necessary dependencies
# Ensure to copy go.mod and go.sum files before running go mod download
RUN go mod download

# Build your application statically
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o samskritam .

# Use a minimal alpine image to run the server
FROM alpine:latest  

# Set the working directory
WORKDIR /root/

# Import the compiled executable from the first stage
COPY --from=builder /go/src/chaatra/backend/samskritam /root/samskritam

# Import the dictionary.xml file from the build context into the same directory as the binary
COPY --from=builder /go/src/chaatra/backend/core/parser/dictionary.xml /root/dictionary.xml

# Ensure executable permissions
RUN chmod +x /root/samskritam

# Install CA certificates if your app uses HTTPS
RUN apk --no-cache add ca-certificates

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the executable
CMD ["/root/samskritam"]
