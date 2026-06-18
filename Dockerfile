# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go Backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN go build -o stockbroker .

# Stage 3: Final Production Image
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

# Copy the Go binary
COPY --from=backend-builder /app/stockbroker .

# Copy the compiled frontend files into ./frontend/dist
COPY --from=frontend-builder /app/dist ./frontend/dist

# Expose the standard Render port
EXPOSE 8080

# Run the backend server
CMD ["./stockbroker"]
