#!/usr/bin/env bash
# Exit on error
set -o errexit

if [ -d "server" ]; then
  echo "📂 Entering server directory..."
  cd server
fi

echo "📦 Installing npm dependencies..."
npm install

echo "🌐 Installing Chrome binary for Puppeteer on Render..."
npx puppeteer browsers install chrome

echo "✅ Build completed successfully!"
