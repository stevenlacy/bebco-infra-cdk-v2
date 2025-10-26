#!/bin/bash

# Deploy Entire Environment
# Usage: ./scripts/deploy-environment.sh <environment>

set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Error: Environment required"
  echo "Usage: ./scripts/deploy-environment.sh <environment>"
  echo ""
  echo "Valid environments:"
  echo "  dev1, dev2, dev3, dev4  (personal)"
  echo "  dev                      (shared)"
  echo "  staging                  (pre-prod)"
  echo "  prod                     (production)"
  exit 1
fi

# Validate environment
if [[ ! "$ENV" =~ ^(dev1|dev2|dev3|dev4|dev|staging|prod)$ ]]; then
  echo "❌ Error: Invalid environment: $ENV"
  exit 1
fi

# Safety check for production
if [ "$ENV" == "prod" ]; then
  echo "⚠️  WARNING: You are about to deploy to PRODUCTION!"
  echo ""
  read -p "Type 'DEPLOY TO PRODUCTION' to confirm: " CONFIRM
  if [ "$CONFIRM" != "DEPLOY TO PRODUCTION" ]; then
    echo "Cancelled"
    exit 1
  fi
fi

# Set region based on environment
if [ "$ENV" == "prod" ]; then
  REGION="us-east-1"
else
  REGION="us-east-2"
fi

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🚀 Deploying Full Environment                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🏷️  Environment: $ENV"
echo "📍 Region: $REGION"
echo ""

# Build
echo "🔨 Building CDK..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

# List stacks
echo ""
echo "📋 Stacks to deploy:"
npx cdk list -c environment=$ENV -c region=$REGION

echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

# Deploy
echo ""
echo "🚀 Deploying all stacks..."
echo ""

START_TIME=$(date +%s)

npx cdk deploy --all \
  -c environment=$ENV \
  -c region=$REGION \
  --require-approval never

DEPLOY_STATUS=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║  ✅ Deployment Complete!                                     ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "⏱️  Duration: ${DURATION}s"
  echo "🏷️  Environment: $ENV"
  echo "📍 Region: $REGION"
  echo ""
  echo "📊 Get resource info:"
  echo ""
  echo "  API Endpoints:"
  echo "    aws apigateway get-rest-apis --region $REGION --query \"items[?contains(name,'$ENV')]\" --output table"
  echo ""
  echo "  Lambda Functions:"
  echo "    aws lambda list-functions --region $REGION --query \"Functions[?contains(FunctionName,'$ENV')].FunctionName\" --output table"
  echo ""
  echo "  DynamoDB Tables:"
  echo "    aws dynamodb list-tables --region $REGION --output table"
  echo ""
else
  echo ""
  echo "❌ Deployment failed"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check CloudFormation console for error details"
  echo "  2. Review CDK output above"
  echo "  3. Try deploying individual stacks"
  exit 1
fi

