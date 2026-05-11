#!/bin/bash

# Fail if any command fails
set -e

# Path to the root of your project
# On Xcode Cloud, the script runs from ios/App/ci_scripts/
# So we go up 3 levels to reach the root (where package.json is)
cd ../../..

echo "Current directory: $(pwd)"

# Install Node dependencies
npm install

# Build the web assets
npm run build

# Sync Capacitor
npx cap sync ios

# Go into the iOS folder to run Pods
# Use the full path from the root to be safe
cd ios/App
brew install cocoapods
pod install

echo "Pod install complete!"