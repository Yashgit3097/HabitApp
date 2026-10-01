#!/usr/bin/env bash
# Build script for Render.com native Node.js environments

echo "🚀 [Render Build] Installing dependencies..."
npm install

echo "📦 [Render Build] Installing Chromium browser for Puppeteer..."
npx puppeteer browsers install chrome || true

echo "✅ [Render Build] Build completed successfully!"
