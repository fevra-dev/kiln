#!/bin/bash

# KILN.1 - Extract Safe Components from Previous Session
# This script safely copies components that don't conflict with Phase 1

set -e

SOURCE_DIR="sbt01-web-spec-teleburn-full-compressor-expert"
TARGET_DIR="."

echo "🔍 KILN.1 Component Extraction"
echo "================================="
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory not found: $SOURCE_DIR"
    exit 1
fi

echo "📦 Creating directories..."
mkdir -p src/workers
mkdir -p src/components/wizard
mkdir -p src/components/ui

echo ""
echo "📋 Extracting safe components..."
echo ""

# 1. Copy Compressor (excellent component)
if [ -f "$SOURCE_DIR/src/components/Compressor.tsx" ]; then
    echo "✅ Extracting Compressor.tsx..."
    cp "$SOURCE_DIR/src/components/Compressor.tsx" src/components/wizard/Compressor.tsx
else
    echo "⚠️  Compressor.tsx not found"
fi

# 2. Copy Worker
if [ -f "$SOURCE_DIR/src/workers/encode.worker.ts" ]; then
    echo "✅ Extracting encode.worker.ts..."
    cp "$SOURCE_DIR/src/workers/encode.worker.ts" src/workers/encode.worker.ts
else
    echo "⚠️  encode.worker.ts not found"
fi

# 3. Copy WalletProviders
if [ -f "$SOURCE_DIR/src/components/WalletProviders.tsx" ]; then
    echo "✅ Extracting WalletProviders.tsx..."
    cp "$SOURCE_DIR/src/components/WalletProviders.tsx" src/components/WalletProviders.tsx
else
    echo "⚠️  WalletProviders.tsx not found"
fi

# 4. Copy download helper
if [ -f "$SOURCE_DIR/src/lib/download.ts" ]; then
    echo "✅ Extracting download.ts..."
    cp "$SOURCE_DIR/src/lib/download.ts" src/lib/download.ts
else
    echo "⚠️  download.ts not found"
fi

# 5. Copy Pointer/Manifest builders as reference (rename with .ref extension)
if [ -f "$SOURCE_DIR/src/components/PointerBuilder.tsx" ]; then
    echo "📝 Copying PointerBuilder.tsx as reference..."
    cp "$SOURCE_DIR/src/components/PointerBuilder.tsx" src/components/wizard/PointerBuilder.tsx.ref
fi

if [ -f "$SOURCE_DIR/src/components/BtcManifestBuilder.tsx" ]; then
    echo "📝 Copying BtcManifestBuilder.tsx as reference..."
    cp "$SOURCE_DIR/src/components/BtcManifestBuilder.tsx" src/components/wizard/BtcManifestBuilder.tsx.ref
fi

echo ""
echo "⚠️  Checking for conflicts..."
echo ""

# Check if old teleburn.ts would conflict
if [ -f "src/lib/teleburn.ts" ]; then
    echo "⚠️  WARNING: src/lib/teleburn.ts already exists"
    echo "   NOT copying old teleburn.ts (use our derived-owner.ts instead)"
fi

# Check for API route conflicts
if [ -d "src/app/api/tx" ]; then
    echo "ℹ️  API routes directory exists - will need manual integration"
fi

echo ""
echo "================================="
echo "✅ Safe Components Extracted!"
echo "================================="
echo ""
echo "Extracted components:"
echo "  ✓ Compressor.tsx → src/components/wizard/"
echo "  ✓ encode.worker.ts → src/workers/"
echo "  ✓ WalletProviders.tsx → src/components/"
echo "  ✓ download.ts → src/lib/"
echo "  📝 PointerBuilder.tsx.ref (reference only)"
echo "  📝 BtcManifestBuilder.tsx.ref (reference only)"
echo ""
echo "⚠️  IMPORTANT: Review INTEGRATION_GUIDE.md for:"
echo "  - Updating imports to use Phase 1 code"
echo "  - Adding missing dependencies"
echo "  - Fixing type errors"
echo ""
echo "Next steps:"
echo "1. pnpm install (add missing deps)"
echo "2. Review extracted files"
echo "3. Update imports to use Phase 1 code"
echo "4. pnpm type-check"
echo "5. pnpm test"
echo ""

