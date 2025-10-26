#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
ACCOUNT_ID="303555290462"
S3_BUCKET="bebco-dynamodb-migration-temp-303555290462"
EXPORT_ARNS_FILE="export-arns.txt"

cd "$(dirname "$0")"

echo "==========================================="
echo "Starting Remaining DynamoDB Exports"
echo "==========================================="
echo ""

# Get list of tables already exported
if [ -f "$EXPORT_ARNS_FILE" ]; then
  EXPORTED_TABLES=$(cut -d'|' -f2 "$EXPORT_ARNS_FILE")
else
  EXPORTED_TABLES=""
fi

# Tables that need to be exported
REMAINING_TABLES=(
  "bebco-borrower-staging-borrower-value-config-settings"
  "bebco-borrower-staging-case-counsel-relationships"
  "bebco-borrower-staging-case-financials-current"
  "bebco-borrower-staging-case-underwritings"
  "bebco-borrower-staging-cases"
  "bebco-borrower-staging-companies"
  "bebco-borrower-staging-discount-rate-matrix"
  "bebco-borrower-staging-docket-review-case-details"
  "bebco-borrower-staging-files"
  "bebco-borrower-staging-ledger-entries"
  "bebco-borrower-staging-lines-of-credit"
  "bebco-borrower-staging-loan-loc"
  "bebco-borrower-staging-loans"
  "bebco-borrower-staging-mass-tort-general"
  "bebco-borrower-staging-mass-tort-plaintiffs"
  "bebco-borrower-staging-monthly-reportings"
  "bebco-borrower-staging-notifications"
  "bebco-borrower-staging-otp-codes"
  "bebco-borrower-staging-payments"
  "bebco-borrower-staging-plaid-items"
  "bebco-borrower-staging-settlement-success-tracking"
  "bebco-borrower-staging-statements"
  "bebco-borrower-staging-transactions"
  "bebco-borrower-staging-users"
  "bebco-borrower-staging-valuations-summary"
  "bebco-borrower-staging-variance-tracking"
)

TOTAL=${#REMAINING_TABLES[@]}
COUNTER=0
SUCCESS=0
FAILED=0

for table in "${REMAINING_TABLES[@]}"; do
  COUNTER=$((COUNTER + 1))
  
  # Skip if already exported
  if echo "$EXPORTED_TABLES" | grep -q "^${table}$"; then
    echo "[$COUNTER/$TOTAL] Skipping $table (already exported)"
    SUCCESS=$((SUCCESS + 1))
    continue
  fi
  
  echo "[$COUNTER/$TOTAL] Starting export for: $table"
  
  TABLE_ARN="arn:aws:dynamodb:${SOURCE_REGION}:${ACCOUNT_ID}:table/${table}"
  S3_PREFIX="exports/${table}"
  
  # Start export with error handling
  EXPORT_OUTPUT=$(aws dynamodb export-table-to-point-in-time \
    --table-arn "$TABLE_ARN" \
    --s3-bucket "$S3_BUCKET" \
    --s3-prefix "$S3_PREFIX" \
    --export-format DYNAMODB_JSON \
    --region "$SOURCE_REGION" \
    --output json 2>&1)
  
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    EXPORT_ARN=$(echo "$EXPORT_OUTPUT" | jq -r '.ExportDescription.ExportArn')
    echo "$EXPORT_ARN|$table" >> "$EXPORT_ARNS_FILE"
    echo "   ✓ Export started (ARN: ${EXPORT_ARN##*/})"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "   ✗ Failed: $EXPORT_OUTPUT"
    FAILED=$((FAILED + 1))
    
    # Check for rate limiting
    if echo "$EXPORT_OUTPUT" | grep -q "LimitExceededException\|ThrottlingException"; then
      echo "   ⏳ Rate limit hit, waiting 30 seconds..."
      sleep 30
      
      # Retry once
      echo "   🔄 Retrying $table..."
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
        echo "   ✓ Retry successful"
        SUCCESS=$((SUCCESS + 1))
        FAILED=$((FAILED - 1))
      fi
    fi
  fi
  
  # Small delay between exports to avoid rate limiting
  sleep 2
  echo ""
done

echo "==========================================="
echo "✅ Export submission complete!"
echo "==========================================="
echo ""
echo "Success: $SUCCESS/$TOTAL"
echo "Failed:  $FAILED/$TOTAL"
echo ""
echo "Total exports in progress: $(wc -l < $EXPORT_ARNS_FILE | tr -d ' ')"
echo ""
echo "Exports are running in AWS. You can:"
echo "  - Close your laptop"
echo "  - Check status with: ./check-export-status.sh"
echo ""

