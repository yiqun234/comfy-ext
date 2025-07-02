#!/bin/bash

# Chrome Extension Packaging Script
# 打包Chrome扩展，生成CRX和ZIP文件，管理PEM私钥

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

echo -e "${BLUE}🚀 开始打包Chrome扩展...${NC}"

# 检查构建目录是否存在
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ 构建目录不存在: $BUILD_DIR${NC}"
    echo -e "${YELLOW}请先运行: pnpm build${NC}"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 检查是否存在私钥文件
if [ -f "$PRIVATE_KEY" ]; then
    echo -e "${GREEN}🔑 使用现有私钥: $PRIVATE_KEY${NC}"
    USE_EXISTING_KEY="--pack-extension-key=$PRIVATE_KEY"
else
    echo -e "${YELLOW}🔑 将生成新的私钥文件${NC}"
    USE_EXISTING_KEY=""
fi

echo -e "${BLUE}📦 正在生成CRX文件...${NC}"

# 使用Chrome打包扩展
if command -v google-chrome &> /dev/null; then
    CHROME_CMD="google-chrome"
elif command -v google-chrome-stable &> /dev/null; then
    CHROME_CMD="google-chrome-stable"
elif command -v chromium-browser &> /dev/null; then
    CHROME_CMD="chromium-browser"
else
    echo -e "${RED}❌ 未找到Chrome浏览器，请安装Chrome或Chromium${NC}"
    exit 1
fi

# 执行打包
$CHROME_CMD --pack-extension="$BUILD_DIR" $USE_EXISTING_KEY

# 移动生成的文件到输出目录
if [ -f "$BUILD_DIR.crx" ]; then
    mv "$BUILD_DIR.crx" "$OUTPUT_DIR/${EXTENSION_NAME}.crx"
    echo -e "${GREEN}✅ CRX文件已生成: $OUTPUT_DIR/${EXTENSION_NAME}.crx${NC}"
else
    echo -e "${RED}❌ CRX文件生成失败${NC}"
    exit 1
fi

# 处理私钥文件
if [ -f "$BUILD_DIR.pem" ]; then
    # 如果根目录没有私钥文件，则复制过来
    if [ ! -f "$PRIVATE_KEY" ]; then
        cp "$BUILD_DIR.pem" "$PRIVATE_KEY"
        echo -e "${GREEN}🔐 私钥文件已保存: $PRIVATE_KEY${NC}"
    fi
    # 移动到输出目录
    mv "$BUILD_DIR.pem" "$OUTPUT_DIR/${EXTENSION_NAME}.pem"
fi

echo -e "${BLUE}📋 正在生成ZIP文件...${NC}"

# 生成ZIP文件
cd "$BUILD_DIR"
zip -r "../../$OUTPUT_DIR/${EXTENSION_NAME}.zip" . -q
cd - > /dev/null

echo -e "${GREEN}✅ ZIP文件已生成: $OUTPUT_DIR/${EXTENSION_NAME}.zip${NC}"

# 显示文件信息
echo -e "${BLUE}📊 生成的文件:${NC}"
ls -lh "$OUTPUT_DIR"/${EXTENSION_NAME}.*

# 显示扩展ID（如果可能）
if command -v unzip &> /dev/null && command -v jq &> /dev/null; then
    echo -e "${BLUE}🆔 扩展信息:${NC}"
    TEMP_DIR=$(mktemp -d)
    unzip -q "$OUTPUT_DIR/${EXTENSION_NAME}.zip" -d "$TEMP_DIR"
    if [ -f "$TEMP_DIR/manifest.json" ]; then
        NAME=$(jq -r '.name' "$TEMP_DIR/manifest.json")
        VERSION=$(jq -r '.version' "$TEMP_DIR/manifest.json")
        echo -e "   名称: ${GREEN}$NAME${NC}"
        echo -e "   版本: ${GREEN}$VERSION${NC}"
    fi
    rm -rf "$TEMP_DIR"
fi

echo -e "${GREEN}🎉 打包完成！${NC}"
echo -e "${YELLOW}💡 私钥文件已保存在: $PRIVATE_KEY${NC}"
echo -e "${YELLOW}💡 请妥善保管私钥文件，用于后续更新时保持扩展ID不变${NC}" 