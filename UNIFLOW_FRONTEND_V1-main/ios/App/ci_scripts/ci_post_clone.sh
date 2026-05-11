#!/bin/bash
#
# Xcode Cloud post-clone hook for the UniFlow iOS app.
#
# Why this script exists:
#   xcodebuild needs the CocoaPods workspace to be generated before it can
#   archive. Capacitor also needs the JS bundle to exist in `dist/` so that
#   `cap sync` can copy it into the iOS native project, and the plugin pods
#   it adds to the Podfile must be present before `pod install` runs.
#
# Pipeline (must run in this order):
#   1. cd into the project root (where package.json lives)
#   2. Install Node 20 explicitly (Xcode Cloud's default Node version drifts
#      across image bumps; React 19 + Capacitor 7 need Node 20+)
#   3. `npm ci`         — deterministic install from package-lock.json
#   4. `npm run build`  — produces `dist/` for Capacitor to consume
#   5. `npx cap sync ios` — copies web assets + plugin configs into iOS
#   6. `pod install`    — generates Pods/ and the *.xcconfig files xcodebuild
#                         references; without these you get the error
#                         "Unable to open base configuration reference file
#                         'Pods-App.release.xcconfig'".
#
# Repository layout note:
#   The Git repo has the entire project nested inside `UNIFLOW_FRONTEND_V1-main/`
#   rather than at the repo root, so we anchor every path off Xcode Cloud's
#   $CI_PRIMARY_REPOSITORY_PATH instead of relying on the script's CWD.

set -euo pipefail

echo "=== ci_post_clone.sh: start ==="
echo "Xcode:    $(xcodebuild -version | head -n 1)"
echo "PWD:      $(pwd)"
echo "CI_PRIMARY_REPOSITORY_PATH: ${CI_PRIMARY_REPOSITORY_PATH:-<unset>}"
echo "CI_WORKSPACE: ${CI_WORKSPACE:-<unset>}"

# Resolve the project root. Xcode Cloud sets CI_PRIMARY_REPOSITORY_PATH to
# the cloned repo root; we then descend into the nested project folder.
# If the env var is missing (e.g. when testing locally) fall back to walking
# up from the script's location.
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
PROJECT_ROOT="$REPO_ROOT/UNIFLOW_FRONTEND_V1-main"

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  echo "ERROR: package.json not found at $PROJECT_ROOT" >&2
  echo "Contents of REPO_ROOT ($REPO_ROOT):" >&2
  ls -la "$REPO_ROOT" >&2 || true
  exit 1
fi

cd "$PROJECT_ROOT"
echo "Project root resolved: $(pwd)"

# Pin Node 20. The macOS image's default Node version changes when Apple
# bumps Xcode, which has caused silent build breakages here in the past.
echo "--- Installing Node 20 ---"
brew install node@20
brew link --overwrite --force node@20
hash -r
echo "node $(node --version) / npm $(npm --version)"

# Deterministic install from package-lock.json. Fails loudly if the lockfile
# is out of sync with package.json (catches drift before xcodebuild does).
echo "--- npm ci ---"
npm ci

echo "--- npm run build ---"
npm run build

echo "--- npx cap sync ios ---"
npx cap sync ios

# CocoaPods integration. `--repo-update` refreshes the local spec mirror so
# we don't fail with stale-spec errors on a fresh Xcode Cloud image.
echo "--- pod install ---"
cd "$PROJECT_ROOT/ios/App"
brew install cocoapods
pod --version
pod install --repo-update

# Defensive verification. If the xcconfig the next step needs is still
# missing, fail this step (red) with a clear message rather than letting
# xcodebuild surface its much-less-actionable error.
CONFIG="Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG was not produced by pod install" >&2
  echo "Contents of $(pwd)/Pods/Target Support Files:" >&2
  ls -la "Pods/Target Support Files" >&2 || true
  exit 1
fi

echo "Generated $CONFIG"
echo "=== ci_post_clone.sh: complete ==="
