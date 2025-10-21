#!/bin/bash

echo "🚀 Setting up Captionist Backend..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create directories
echo "📁 Creating directories..."
mkdir -p uploads temp logs

# Set permissions
echo "🔐 Setting permissions..."
chmod 755 uploads temp logs

# Copy environment file
echo "⚙️ Setting up environment..."
if [ ! -f .env ]; then
  cp env.example .env
  echo "📝 Please edit .env file with your configuration"
fi

# Install FFmpeg (Ubuntu/Debian)
if command -v apt-get &> /dev/null; then
  echo "🎬 Installing FFmpeg..."
  sudo apt-get update
  sudo apt-get install -y ffmpeg
fi

echo "✅ Setup complete!"
echo "Run 'npm run dev' to start development server"
