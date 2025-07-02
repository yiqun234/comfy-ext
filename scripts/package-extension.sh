#!/bin/bash

# Chrome Extension Packaging Script
# Package Chrome extension, generate CRX and ZIP files, manage PEM private key

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BUILD_DIR="build/chrome-mv3-prod"
OUTPUT_DIR="dist"
PRIVATE_KEY="PRIVATE.pem"
EXTENSION_NAME="comfy-ext"

echo -e "${BLUE}🚀 Starting Chrome extension packaging...${NC}"

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ Build directory not found: $BUILD_DIR${NC}"
    echo -e "${YELLOW}Please run first: pnpm build${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if private key file exists
if [ -f "$PRIVATE_KEY" ]; then
    echo -e "${GREEN}🔑 Using existing private key: $PRIVATE_KEY${NC}"
    USE_EXISTING_KEY="--pack-extension-key=$PRIVATE_KEY"
else
    echo -e "${YELLOW}🔑 Will generate new private key file${NC}"
    USE_EXISTING_KEY=""
fi

echo -e "${BLUE}📦 Generating CRX file...${NC}"

# Use Chrome to package extension
if command -v google-chrome &> /dev/null; then
    CHROME_CMD="google-chrome"
elif command -v google-chrome-stable &> /dev/null; then
    CHROME_CMD="google-chrome-stable"
elif command -v chromium-browser &> /dev/null; then
    CHROME_CMD="chromium-browser"
else
    echo -e "${RED}❌ Chrome browser not found, please install Chrome or Chromium${NC}"
    exit 1
fi

# Execute packaging
$CHROME_CMD --pack-extension="$BUILD_DIR" $USE_EXISTING_KEY

# Move generated files to output directory
if [ -f "$BUILD_DIR.crx" ]; then
    mv "$BUILD_DIR.crx" "$OUTPUT_DIR/${EXTENSION_NAME}.crx"
    echo -e "${GREEN}✅ CRX file generated: $OUTPUT_DIR/${EXTENSION_NAME}.crx${NC}"
else
    echo -e "${RED}❌ CRX file generation failed${NC}"
    exit 1
fi

# Handle private key file
if [ -f "$BUILD_DIR.pem" ]; then
    # If no private key file in root directory, copy it
    if [ ! -f "$PRIVATE_KEY" ]; then
        cp "$BUILD_DIR.pem" "$PRIVATE_KEY"
        echo -e "${GREEN}🔐 Private key file saved: $PRIVATE_KEY${NC}"
    fi
    # Move to output directory
    mv "$BUILD_DIR.pem" "$OUTPUT_DIR/${EXTENSION_NAME}.pem"
fi

echo -e "${BLUE}📋 Generating ZIP file...${NC}"

# Generate ZIP file
cd "$BUILD_DIR"
zip -r "../../$OUTPUT_DIR/${EXTENSION_NAME}.zip" . -q
cd - > /dev/null

echo -e "${GREEN}✅ ZIP file generated: $OUTPUT_DIR/${EXTENSION_NAME}.zip${NC}"

# Display file information
echo -e "${BLUE}📊 Generated files:${NC}"
ls -lh "$OUTPUT_DIR"/${EXTENSION_NAME}.*

# Display extension ID (if possible)
if command -v unzip &> /dev/null && command -v jq &> /dev/null; then
    echo -e "${BLUE}🆔 Extension info:${NC}"
    TEMP_DIR=$(mktemp -d)
    unzip -q "$OUTPUT_DIR/${EXTENSION_NAME}.zip" -d "$TEMP_DIR"
    if [ -f "$TEMP_DIR/manifest.json" ]; then
        NAME=$(jq -r '.name' "$TEMP_DIR/manifest.json")
        VERSION=$(jq -r '.version' "$TEMP_DIR/manifest.json")
        echo -e "   Name: ${GREEN}$NAME${NC}"
        echo -e "   Version: ${GREEN}$VERSION${NC}"
    fi
    rm -rf "$TEMP_DIR"
fi

echo -e "${GREEN}🎉 Packaging completed!${NC}"
echo -e "${YELLOW}💡 Private key file saved at: $PRIVATE_KEY${NC}"
echo -e "${YELLOW}💡 Please keep the private key file safe for future updates to maintain same extension ID${NC}" 