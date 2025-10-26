#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
ACCOUNT_ID="303555290462"
S3_BUCKET="bebco-dynamodb-migration-temp-303555290462"
TABLES_FILE="../config/dynamodb-tables-to-migrate.txt"
EXPORT_ARNS_FILE="export-arns.txt"

cd "$(dirname "$0")"

echo "==========================================="
echo "DynamoDB Export: us-east-1 → S3"
echo "==========================================="
echo ""
echo "Source Region: $SOURCE_REGION (READ ONLY)"
echo "Destination S3: s3://$S3_BUCKET/"
echo ""

# Clear previous export ARNs
> "$EXPORT_ARNS_FILE"

# Read tables and start exports
TOTAL_TABLES=$(wc -l < "$TABLES_FILE" | tr -d ' ')
COUNTER=0

while IFS= read -r table; do
  COUNTER=$((COUNTER + 1))
  echo "[$COUNTER/$TOTAL_TABLES] Starting export for: $table"
  
  TABLE_ARN="arn:aws:dynamodb:${SOURCE_REGION}:${ACCOUNT_ID}:table/${table}"
  S3_PREFIX="exports/${table}"
  
  # Start export (this returns immediately, export runs in AWS)
  EXPORT_OUTPUT=$(aws dynamodb export-table-to-point-in-time \
    --table-arn "$TABLE_ARN" \
    --s3-bucket "$S3_BUCKET" \
    --s3-prefix "$S3_PREFIX" \
    --export-format DYNAMODB_JSON \
    --region "$SOURCE_REGION" \
    --output json 2>&1)
  
  if [ $? -eq 0 ]; then
    EXPORT_ARN=$(echo "$EXPORT_OUTPUT" | jq -r '.ExportDescription.ExportArn')
    echo "$EXPORT_ARN|$table" >> "$EXPORT_ARNS_FILE"
    echo "   ✓ Export started (ARN saved)"
  else
    echo "   ✗ Failed to start export: $EXPORT_OUTPUT"
  fi
  
  echo ""
done < "$TABLES_FILE"

echo "==========================================="
echo "✅ All $TOTAL_TABLES export jobs submitted!"
echo "==========================================="
echo ""
echo "Exports are now running in AWS (independent of this machine)."
echo "You can:"
echo "  - Close your laptop"
echo "  - Lose internet connection"
echo "  - Come back later"
echo ""
echo "To check status, run:"
echo "  ./check-export-status.sh"
echo ""
echo "Export ARNs saved to: $EXPORT_ARNS_FILE"
echo ""

