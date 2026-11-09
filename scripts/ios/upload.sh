#!/bin/sh
# App Store Connect 에 빌드를 올린다 (Flash 와 같은 방식, 2026-11-09).
#   sh scripts/ios/upload.sh
# 버전·빌드 번호는 app.json 의 version / ios.buildNumber 를 따른다. 올리기 전에 buildNumber 를 하나 올린다.
# auto mode 는 업로드(-exportArchive)를 막으므로 터미널에서 직접 돌린다.
set -e
cd "$(dirname "$0")/../.."
npx expo prebuild -p ios >/dev/null
mkdir -p ios/build-archive
ARCHIVE=ios/build-archive/Poground.xcarchive
xcodebuild -workspace ios/Poground.xcworkspace -scheme Poground -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates archive > ios/build-archive/archive.log 2>&1 \
  || { grep -E "error:" ios/build-archive/archive.log | sort -u | head -20; echo "아카이브 실패 — 전체 로그: ios/build-archive/archive.log"; exit 1; }
echo "아카이브 완료"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist scripts/ios/ExportOptions.plist \
  -exportPath ios/build-archive/export -allowProvisioningUpdates 2>&1 | grep -E "error|EXPORT|Upload|upload" | tail -10
