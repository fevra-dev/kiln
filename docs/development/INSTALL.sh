#!/bin/bash

# KILN.1 Teleburn - Installation Script
# This script sets up the development environment

set -e

echo "🔥 KILN.1 Teleburn - Installation"
echo "===================================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current: $(node --version)"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check pnpm
echo ""
echo "📦 Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install
echo "✅ Dependencies installed"

# Set up environment
echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local (please edit with your RPC endpoints)"
else
    echo "⚠️  .env.local already exists (skipped)"
fi

# Run type check
echo ""
echo "🔍 Type checking..."
pnpm type-check
echo "✅ Type check passed"

# Run linter
echo ""
echo "🔍 Linting..."
pnpm lint
echo "✅ Lint check passed"

# Run tests
echo ""
echo "🧪 Running tests..."
pnpm test
echo "✅ All tests passed"

# Success message
echo ""
echo "======================================"
echo "✅ Installation Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Solana RPC endpoint"
echo "2. Run 'pnpm dev' to start development server"
echo "3. Visit http://localhost:3000"
echo ""
echo "Documentation:"
echo "- Quick Start: QUICKSTART.md"
echo "- Phase 1 Summary: PHASE1_COMPLETE.md"
echo "- Full README: README.md"
echo ""
echo "🚀 Ready to build!"

