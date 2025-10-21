# Captionist Backend 🎬

A powerful backend API for video captioning and transcription services. Built with Node.js, TypeScript, and FFmpeg for high-performance video processing.

## Features

- 🎥 **Video Upload & Processing** - Support for multiple video formats
- 📝 **Automatic Transcription** - Convert speech to text
- 🎨 **Dynamic Caption Generation** - Multiple caption styles and animations
- ⚡ **Real-time Processing** - Background job processing with progress tracking
- 🔒 **Secure API** - Rate limiting, validation, and error handling
- 🐳 **Docker Ready** - Easy deployment with Docker and Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- FFmpeg installed
- MongoDB (optional)
- Redis (optional)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/captionist-backend.git
cd captionist-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment**

```bash
cp env.example .env
# Edit .env with your configuration
```

4. **Run setup script**

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

5. **Start development server**

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Health Check

```bash
GET /api/health
```

### Video Management

```bash
POST /api/video/upload          # Upload video
GET  /api/video/:id/metadata    # Get video metadata
GET  /api/video/:id/stream      # Stream video
```

### Caption Generation

```bash
POST /api/captions/generate     # Generate captions
GET  /api/captions/status/:id   # Get generation status
GET  /api/captions/:id/captions # Get generated captions
GET  /api/captions/:id/download/srt # Download SRT file
```

### Transcription

```bash
POST /api/transcription/transcribe    # Transcribe video
GET  /api/transcription/status/:id   # Get transcription status
```

## Usage Examples

### Upload Video

```bash
curl -X POST -F "video=@video.mp4" http://localhost:3001/api/video/upload
```

### Generate Captions

```bash
curl -X POST http://localhost:3001/api/captions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "your-video-id",
    "transcript": "This is a test transcript",
    "style": {
      "type": "reel",
      "position": "bottom",
      "fontSize": 24,
      "color": "#ffffff"
    },
    "options": {
      "maxSegmentDuration": 5,
      "minSegmentDuration": 1,
      "wordPerMinute": 150
    }
  }'
```

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up -d
```

### Manual Docker Build

```bash
# Build image
docker build -t captionist-backend .

# Run container
docker run -p 3001:3001 captionist-backend
```

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run start        # Start production server
npm test             # Run tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Project Structure

```
src/
├── api/
│   ├── routes/          # API route handlers
│   └── middleware/      # Express middleware
├── services/           # Business logic services
├── workers/            # Background job workers
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── config/             # Configuration files
```

## Configuration

### Environment Variables

| Variable        | Description        | Default                                |
| --------------- | ------------------ | -------------------------------------- |
| `NODE_ENV`      | Environment        | `development`                          |
| `PORT`          | Server port        | `3001`                                 |
| `MONGODB_URI`   | MongoDB connection | `mongodb://localhost:27017/captionist` |
| `REDIS_URL`     | Redis connection   | `redis://localhost:6379`               |
| `UPLOAD_DIR`    | Upload directory   | `./uploads`                            |
| `MAX_FILE_SIZE` | Max file size      | `100MB`                                |
| `FFMPEG_PATH`   | FFmpeg binary path | `/usr/bin/ffmpeg`                      |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Contributing Guide](docs/CONTRIBUTING.md)

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@captionist.com or join our Discord community.

## Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced video effects
- [ ] Multi-language support
- [ ] Cloud storage integration
- [ ] Analytics dashboard
- [ ] API rate limiting improvements
- [ ] Advanced caption animations
- [ ] Batch processing
- [ ] Video thumbnails
- [ ] Audio extraction
