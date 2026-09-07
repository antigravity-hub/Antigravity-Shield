#!/bin/bash
set -e

# Antigravity Tools - Arch Linux Self-Updating Installer
# This script fetches the latest release from GitHub and installs it using makepkg.

echo "🚀 Fetching latest release information..."
REPO="lbjlaq/Antigravity-Manager"
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
PKGVER=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')

if [ -z "$PKGVER" ]; then
    echo "❌ Error: Could not fetch latest version."
    exit 1
fi

echo "📦 Latest version: v$PKGVER"

# Find asset URLs
URL_X86_64=$(echo "$LATEST_RELEASE" | grep -oP '"browser_download_url": "\K[^"]*amd64\.deb' | head -n 1)
URL_AARCH64=$(echo "$LATEST_RELEASE" | grep -oP '"browser_download_url": "\K[^"]*arm64\.deb' | head -n 1)

if [ -z "$URL_X86_64" ] || [ -z "$URL_AARCH64" ]; then
    echo "❌ Error: Could not find .deb assets for v$PKGVER"
    exit 1
fi

echo "🔍 Downloading assets to calculate checksums..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

wget -q "$URL_X86_64" -O x86_64.deb
wget -q "$URL_AARCH64" -O aarch64.deb

SHA_X86_64=$(sha256sum x86_64.deb | cut -d' ' -f1)
SHA_AARCH64=$(sha256sum aarch64.deb | cut -d' ' -f1)

echo "📝 Generating PKGBUILD..."
# Download PKGBUILD template
curl -sSL "https://raw.githubusercontent.com/$REPO/main/deploy/arch/PKGBUILD.template" -o PKGBUILD.template

# Replace placeholders
sed -e "s/\${_pkgver}/$PKGVER/g" \
    -e "s|\${_url_x86_64}|$URL_X86_64|g" \
    -e "s|\${_url_aarch64}|$URL_AARCH64|g" \
    -e "s/\${_sha256_x86_64}/$SHA_X86_64/g" \
    -e "s/\${_sha256_aarch64}/$SHA_AARCH64/g" \
    PKGBUILD.template > PKGBUILD

echo "🛠️ Starting installation via makepkg..."
makepkg -si --noconfirm

echo "✅ Installation complete!"
cd - > /dev/null
rm -rf "$TEMP_DIR"
