# ==========================================
# Stage 1: Build the ReactJS Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static files
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build the Go Backend
# ==========================================
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app/backend

# Download modules
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source and compile binary
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o collector-service ./cmd/collector

# ==========================================
# Stage 3: Run-time Alpine Container
# ==========================================
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy Go binary and assets
COPY --from=backend-builder /app/backend/collector-service ./collector-service
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=backend-builder /app/backend/.env ./.env

# Default port
EXPOSE 8080

# Run in daemon mode (syncing every hour)
ENTRYPOINT ["./collector-service", "-daemon"]
