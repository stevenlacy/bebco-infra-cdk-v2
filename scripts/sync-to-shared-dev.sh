#!/bin/bash

# Sync Personal Environment to Shared Dev
# Usage: ./scripts/sync-to-shared-dev.sh

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🔄 Sync to Shared Dev Environment                           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  WARNING: This will deploy YOUR changes to the SHARED 'dev'"
echo "   environment that all team members use for integration testing."
echo ""
echo "Before proceeding, make sure:"
echo "  ✅ Your code works in your personal environment"
echo "  ✅ You've tested thoroughly"
echo "  ✅ You've communicated with the team"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

# Get current git branch
CURRENT_BRANCH=$(git branch --show-current)
echo ""
echo "📋 Current branch: $CURRENT_BRANCH"
echo ""

# Build CDK
echo "🔨 Building CDK..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Fix errors and try again."
  exit 1
fi

# Deploy to shared dev
echo ""
echo "🚀 Deploying to shared 'dev' environment..."
echo ""

npx cdk deploy --all \
  -c environment=dev \
  -c region=us-east-2 \
  --require-approval never

if [ $? -eq 0 ]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║  ✅ Deployment to Shared Dev Complete!                       ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📝 Next steps:"
  echo ""
  echo "1. Notify team in Slack:"
  echo "   'Deployed feature/$CURRENT_BRANCH to shared dev'"
  echo ""
  echo "2. Share API endpoints:"
  echo "   aws apigateway get-rest-apis --region us-east-2 --query \"items[?contains(name,'dev')]\" --output table"
  echo ""
  echo "3. Create PR to 'develop' when ready"
  echo ""
else
  echo "❌ Deployment failed"
  exit 1
fi

