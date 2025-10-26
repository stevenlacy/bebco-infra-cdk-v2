#!/bin/bash

# Setup Personal Developer Environment
# Usage: ./scripts/setup-developer-env.sh dev1|dev2|dev3|dev4

set -e

DEV_ENV=$1

if [ -z "$DEV_ENV" ]; then
  echo "❌ Error: Environment name required"
  echo "Usage: ./scripts/setup-developer-env.sh <developer-name>"
  echo ""
  echo "Developer names:"
  echo "  jaspal   - Jaspal's environment"
  echo "  dinu     - Dinu's environment"
  echo "  brandon  - Brandon's environment"
  echo "  steven   - Steven's environment"
  exit 1
fi

if [[ ! "$DEV_ENV" =~ ^(jaspal|dinu|brandon|steven|dev[1-4])$ ]]; then
  echo "❌ Error: Invalid environment name"
  echo "Valid names: jaspal, dinu, brandon, steven"
  echo "  (or dev1, dev2, dev3, dev4 for generic names)"
  exit 1
fi

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║  🚀 Setting up Personal Developer Environment: $DEV_ENV        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Create config file
CONFIG_FILE="config/environments/${DEV_ENV}-us-east-2.json"

if [ -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config file already exists: $CONFIG_FILE"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping config file creation"
  else
    rm "$CONFIG_FILE"
  fi
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "📝 Creating config file: $CONFIG_FILE"
  cat > "$CONFIG_FILE" << EOF
{
  "environment": "$DEV_ENV",
  "region": "us-east-2",
  "account": "303555290462",
  "stackPrefix": "Bebco",
  "naming": {
    "prefix": "bebco",
    "environmentSuffix": "$DEV_ENV"
  },
  "cognito": {
    "userPoolName": "bebco-borrower-portal-$DEV_ENV",
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSymbols": true
    }
  },
  "domains": {
    "api": "api-$DEV_ENV.bebco.dev",
    "graphql": "graphql-$DEV_ENV.bebco.dev"
  },
  "integrations": {
    "plaidClientId": "use-dev-credentials",
    "plaidEnvironment": "sandbox",
    "docusignSecretName": "bebco/$DEV_ENV/docusign",
    "sharepointSecretName": "bebco/$DEV_ENV/sharepoint",
    "sendgridSecretName": "bebco/$DEV_ENV/sendgrid"
  },
  "lambdaDefaults": {
    "runtime": "python3.11",
    "timeout": 30,
    "memorySize": 256
  }
}
EOF
  echo "✅ Config file created"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying Infrastructure to $DEV_ENV (us-east-2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  This will take 15-20 minutes to deploy all stacks..."
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled. Config file created at: $CONFIG_FILE"
  echo "You can deploy later with:"
  echo "  npx cdk deploy --all -c environment=$DEV_ENV -c region=us-east-2"
  exit 0
fi

# Step 2: Build CDK
echo "🔨 Building CDK project..."
npm run build

# Step 3: Deploy stacks
echo ""
echo "🚀 Deploying foundation stacks..."

npx cdk deploy BebcoAuthStack BebcoStorageStack BebcoDataStack \
  -c environment=$DEV_ENV \
  -c region=us-east-2 \
  --require-approval never

echo ""
echo "🚀 Deploying Lambda stacks..."

# Deploy Lambda stacks (choose a subset for faster setup)
npx cdk deploy BebcoPlaidStack BebcoUsersStack BebcoPaymentsStack \
  -c environment=$DEV_ENV \
  -c region=us-east-2 \
  --require-approval never

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║  ✅ Personal Environment Setup Complete!                     ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   Environment: $DEV_ENV"
echo "   Region: us-east-2"
echo "   Config: $CONFIG_FILE"
echo ""
echo "🔧 Next Steps:"
echo ""
echo "1. Set your environment variable:"
echo "   export DEV_ENV=$DEV_ENV"
echo ""
echo "2. Deploy remaining stacks (optional):"
echo "   npx cdk deploy --all -c environment=$DEV_ENV -c region=us-east-2"
echo ""
echo "3. Quick Lambda update:"
echo "   ./scripts/update-lambda-quick.sh <function-name> <source-dir> $DEV_ENV"
echo ""
echo "4. Get API endpoints:"
echo "   aws apigateway get-rest-apis --region us-east-2 --query \"items[?contains(name,'$DEV_ENV')]\" --output table"
echo ""
echo "🎉 Happy coding!"

