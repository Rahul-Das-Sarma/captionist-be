#!/bin/bash

echo "🚀 Deploying Captionist Backend..."

# Build application
echo "🔨 Building application..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t captionist-backend .

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start services
echo "▶️ Starting services..."
docker-compose up -d

echo "✅ Deployment complete!"
echo "Backend is running on http://localhost:3001"
