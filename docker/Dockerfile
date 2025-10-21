FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create upload and temp directories
RUN mkdir -p uploads temp

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
