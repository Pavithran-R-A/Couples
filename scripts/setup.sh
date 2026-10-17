#!/usr/bin/env bash
# Reproducible local setup for Project Two.
set -euo pipefail

echo "== Project Two setup =="

# 1. Node version check (CI uses 20; warn below 18)
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node >= 18 required (found $(node -v)). Install Node 20 LTS."
  exit 1
fi
echo "Node $(node -v) OK"

# 2. Install dependencies exactly as locked
npm ci
echo "Dependencies installed"

# 3. Expo dependency compatibility
npx expo install --check
echo "Expo dependency versions OK"

# 4. Environment configuration
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "  Demo mode works with no changes."
  echo "  For production backend: set SUPABASE_URL and SUPABASE_ANON_KEY"
  echo "  (values from your Supabase project settings)."
else
  echo ".env already present, left untouched"
fi

# 5. Verify everything
echo ""
echo "== Verification =="
npm run typecheck
npm run test:privacy
npm run test:smoke
npm run test:tour

echo ""
echo "Setup complete. Start with: npm run dev"
