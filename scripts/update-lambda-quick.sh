#!/bin/bash

# Quick Lambda Update (bypasses CDK for speed)
# Usage: ./scripts/update-lambda-quick.sh <function-name> <source-dir> <environment>

set -e

FUNCTION_NAME=$1
SOURCE_DIR=$2
ENV=${3:-dev}

if [ -z "$FUNCTION_NAME" ] || [ -z "$SOURCE_DIR" ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: ./scripts/update-lambda-quick.sh <function-name> <source-dir> <environment>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/update-lambda-quick.sh plaid-link-token-create /path/to/source dev1"
  echo "  ./scripts/update-lambda-quick.sh users-create . dev2"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory not found: $SOURCE_DIR"
  exit 1
fi

FULL_FUNCTION_NAME="bebco-${ENV}-${FUNCTION_NAME}"
TEMP_ZIP="/tmp/${FUNCTION_NAME}-$(date +%s).zip"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ⚡ Quick Lambda Update (No CDK)                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Function:  $FUNCTION_NAME"
echo "🌍 Full Name: $FULL_FUNCTION_NAME"
echo "📁 Source:    $SOURCE_DIR"
echo "🏷️  Environment: $ENV"
echo "📍 Region:    us-east-2"
echo ""

# Step 1: Package Lambda
echo "📦 Packaging Lambda function..."
cd "$SOURCE_DIR"
zip -r "$TEMP_ZIP" . -x "*.git*" -x "*__pycache__*" -x "*.pyc" -x "*.DS_Store" > /dev/null
ZIP_SIZE=$(ls -lh "$TEMP_ZIP" | awk '{print $5}')
echo "✅ Package created: $ZIP_SIZE"

# Step 2: Update Lambda
echo ""
echo "🚀 Updating Lambda function in AWS..."
UPDATE_OUTPUT=$(aws lambda update-function-code \
  --function-name "$FULL_FUNCTION_NAME" \
  --zip-file "fileb://$TEMP_ZIP" \
  --region us-east-2 \
  --output json 2>&1)

if [ $? -eq 0 ]; then
  echo "✅ Lambda function updated successfully!"
  
  # Parse response
  LAST_MODIFIED=$(echo "$UPDATE_OUTPUT" | jq -r '.LastModified' 2>/dev/null || echo "N/A")
  CODE_SIZE=$(echo "$UPDATE_OUTPUT" | jq -r '.CodeSize' 2>/dev/null || echo "N/A")
  
  echo ""
  echo "📊 Details:"
  echo "   Last Modified: $LAST_MODIFIED"
  echo "   Code Size: $CODE_SIZE bytes"
  
  # Clean up
  rm "$TEMP_ZIP"
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚠️  IMPORTANT: CDK is now OUT OF SYNC"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Before merging to 'develop', sync to S3 and deploy via CDK:"
  echo ""
  echo "  1. Upload to S3:"
  echo "     aws s3 cp $SOURCE_DIR/$FUNCTION_NAME.zip \\"
  echo "       s3://bebco-lambda-deployments-$ENV-us-east-2-303555290462/lambda-packages/"
  echo ""
  echo "  2. Deploy via CDK:"
  echo "     npx cdk deploy <StackName> -c environment=$ENV -c region=us-east-2"
  echo ""
  echo "🧪 Test your function:"
  echo "   aws lambda invoke --function-name $FULL_FUNCTION_NAME \\"
  echo "     --region us-east-2 \\"
  echo "     --payload '{\"test\": true}' \\"
  echo "     /tmp/response.json"
  echo ""
  echo "📝 View logs:"
  echo "   aws logs tail /aws/lambda/$FULL_FUNCTION_NAME --follow --region us-east-2"
  echo ""
else
  echo "❌ Error updating Lambda function:"
  echo "$UPDATE_OUTPUT"
  rm "$TEMP_ZIP"
  exit 1
fi

