#!/bin/bash

echo "💾 Creating backup of Captionist Backend..."

# Create backup directory
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup uploads
echo "📁 Backing up uploads..."
if [ -d "uploads" ]; then
  cp -r uploads "$BACKUP_DIR/"
fi

# Backup database (if using MongoDB)
echo "🗄️ Backing up database..."
if command -v mongodump &> /dev/null; then
  mongodump --out "$BACKUP_DIR/mongodb"
fi

# Create archive
echo "📦 Creating archive..."
tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$BACKUP_DIR" .

echo "✅ Backup complete!"
echo "Backup saved to: backup_$(date +%Y%m%d_%H%M%S).tar.gz"
