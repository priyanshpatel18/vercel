#!/bin/bash
set -e

echo "🏁 Starting container for project: $PROJECT_ID"
cd /home/app

# Check if backup already exists
if node check-backup.js; then
  echo "🪣 Found backup in R2. Downloading..."
  node restore-backup.js
else
  echo "🧩 No backup found. Cloning repo..."
  git clone "$GIT_REPOSITORY__URL" /home/app/output

  echo "💾 Uploading backup to R2..."
  node upload-backup.js
fi

echo "🚀 Starting runner.js..."
exec node runner.js
