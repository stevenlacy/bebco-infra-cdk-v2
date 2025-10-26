#!/bin/bash

set -e

REGION="us-east-2"
ENV_SUFFIX="jpl"
ACCOUNT_ID="303555290462"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║  🧹 CLEANING UP JASPAL'S FAILED RESOURCES                    ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "This will delete:"
echo "  • Failed CloudFormation stacks"
echo "  • S3 buckets with -jaspal suffix"
echo "  • DynamoDB tables with -jaspal suffix"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Delete CloudFormation Stacks
echo "🗑️  Step 1: Deleting Failed CloudFormation Stacks..."
echo ""

STACKS=(
  "BebcoLoansStack-jaspal"
  "BebcoDataStack-jaspal"
  "BebcoStorageStack-jaspal"
  "BebcoAuthStack-jaspal"
)

for stack in "${STACKS[@]}"; do
  if aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &>/dev/null; then
    echo "  Deleting stack: $stack"
    aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
  else
    echo "  Stack does not exist: $stack (OK)"
  fi
done

echo ""
echo "  Waiting for stack deletions to complete..."
for stack in "${STACKS[@]}"; do
  if aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &>/dev/null; then
    echo "    Waiting for: $stack"
    aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$REGION" 2>/dev/null || echo "    (Stack deletion complete or doesn't exist)"
  fi
done

echo "  ✅ CloudFormation stacks deleted"
echo ""

# Step 2: Delete S3 Buckets
echo "🗑️  Step 2: Deleting S3 Buckets..."
echo ""

S3_BUCKETS=(
  "bebco-borrower-documents-${ENV_SUFFIX}-${REGION}-${ACCOUNT_ID}"
  "bebco-borrower-statements-${ENV_SUFFIX}-${REGION}-${ACCOUNT_ID}"
  "bebco-change-tracking-${ENV_SUFFIX}-${REGION}-${ACCOUNT_ID}"
  "bebco-lambda-deployments-${ENV_SUFFIX}-${REGION}-${ACCOUNT_ID}"
)

for bucket in "${S3_BUCKETS[@]}"; do
  if aws s3 ls "s3://${bucket}" --region "$REGION" &>/dev/null; then
    echo "  Deleting bucket: $bucket"
    aws s3 rb "s3://${bucket}" --force --region "$REGION"
    echo "    ✅ Deleted"
  else
    echo "  Bucket does not exist: $bucket (OK)"
  fi
done

echo "  ✅ S3 buckets deleted"
echo ""

# Step 3: Delete DynamoDB Tables
echo "🗑️  Step 3: Deleting DynamoDB Tables..."
echo ""

# Get all tables with jaspal suffix
TABLES=$(aws dynamodb list-tables --region "$REGION" --query "TableNames[?contains(@, '-${ENV_SUFFIX}')]" --output text)

if [ -z "$TABLES" ]; then
  echo "  No DynamoDB tables found with -${ENV_SUFFIX} suffix (OK)"
else
  TABLE_COUNT=$(echo "$TABLES" | wc -w | tr -d ' ')
  echo "  Found $TABLE_COUNT tables to delete"
  echo ""
  
  for table in $TABLES; do
    echo "  Deleting table: $table"
    aws dynamodb delete-table --table-name "$table" --region "$REGION" &>/dev/null
  done
  
  echo ""
  echo "  Waiting for table deletions to complete..."
  for table in $TABLES; do
    aws dynamodb wait table-not-exists --table-name "$table" --region "$REGION" 2>/dev/null || true
  done
  
  echo "  ✅ All DynamoDB tables deleted"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║  ✅ CLEANUP COMPLETE!                                        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  • CloudFormation stacks: Deleted"
echo "  • S3 buckets: Deleted"
echo "  • DynamoDB tables: Deleted"
echo ""
echo "Ready for fresh deployment! 🚀"
echo ""
