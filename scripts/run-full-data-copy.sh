#!/bin/bash
# Master script to copy all data from jpl to stv
# Runs tables in order from smallest to largest

set -e

REGION="us-east-2"
FUNCTION_NAME="bebco-data-copy-jpl-to-stv"
LOG_FILE="/tmp/data-copy-jpl-to-stv-$(date +%Y%m%d-%H%M%S).log"

echo "Starting full data copy from jpl to stv environment" | tee $LOG_FILE
echo "Log file: $LOG_FILE" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Define tables in order from smallest to largest (based on analysis)
TABLES=(
  # Empty tables (0 items)
  "bebco-borrower-approvals"
  "bebco-borrower-borrower-value-config-settings"
  "bebco-borrower-case-counsel-relationships"
  "bebco-borrower-case-financials-current"
  "bebco-borrower-case-underwritings"
  "bebco-borrower-cases"
  "bebco-borrower-discount-rate-matrix"
  "bebco-borrower-docket-review-case-details"
  "bebco-borrower-expenses"
  "bebco-borrower-invoices"
  "bebco-borrower-ledger-entries"
  "bebco-borrower-lines-of-credit"
  "bebco-borrower-mass-tort-general"
  "bebco-borrower-mass-tort-plaintiffs"
  "bebco-borrower-notifications"
  "bebco-borrower-settlement-success-tracking"
  "bebco-borrower-valuations-summary"
  "bebco-borrower-variance-tracking"
  "bebco-integrations-docusign-requests"
  # Small tables
  "bebco-borrower-banks"
  "bebco-borrower-ach-batches"
  "bebco-borrower-otp-codes"
  "bebco-borrower-annual-reportings"
  "bebco-borrower-files"
  "bebco-borrower-plaid-items"
  "bebco-borrower-companies"
  "bebco-borrower-accounts"
  "bebco-borrower-users"
  # Medium tables
  "bebco-borrower-payments"
  "bebco-borrower-loan-loc"
  "bebco-borrower-monthly-reportings"
  "bebco-borrower-statements"
  # Large tables
  "bebco-borrower-loans"
  "bebco-borrower-transactions"
  # Legacy table
  "bebco-borrower-legacy-statements"
)

TOTAL_TABLES=${#TABLES[@]}
COMPLETED=0
FAILED=0

echo "Total tables to copy: $TOTAL_TABLES" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

for TABLE in "${TABLES[@]}"; do
  SOURCE_TABLE="${TABLE}-jpl"
  DEST_TABLE="${TABLE}-stv"
  
  COMPLETED=$((COMPLETED + 1))
  
  echo "[$COMPLETED/$TOTAL_TABLES] Copying $SOURCE_TABLE to $DEST_TABLE..." | tee -a $LOG_FILE
  
  # Create payload file
  PAYLOAD_FILE="/tmp/lambda-payload-${TABLE}.json"
  cat > $PAYLOAD_FILE <<EOF
{
  "source_table": "$SOURCE_TABLE",
  "dest_table": "$DEST_TABLE",
  "batch_size": 25
}
EOF
  
  # Invoke Lambda function
  OUTPUT_FILE="/tmp/lambda-output-${TABLE}.json"
  
  if aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --cli-binary-format raw-in-base64-out \
    --payload file://$PAYLOAD_FILE \
    --region $REGION \
    $OUTPUT_FILE > /dev/null 2>&1; then
    
    # Check result
    SUCCESS=$(cat $OUTPUT_FILE | jq -r '.success // false')
    ITEMS_COPIED=$(cat $OUTPUT_FILE | jq -r '.items_copied // 0')
    
    if [ "$SUCCESS" = "true" ]; then
      echo "  ✅ Success: Copied $ITEMS_COPIED items" | tee -a $LOG_FILE
    else
      echo "  ❌ Failed: $(cat $OUTPUT_FILE | jq -r '.error // "Unknown error"')" | tee -a $LOG_FILE
      FAILED=$((FAILED + 1))
    fi
  else
    echo "  ❌ Lambda invocation failed" | tee -a $LOG_FILE
    FAILED=$((FAILED + 1))
  fi
  
  # Clean up files
  rm -f $OUTPUT_FILE $PAYLOAD_FILE
  
  echo "" | tee -a $LOG_FILE
done

echo "================================" | tee -a $LOG_FILE
echo "Data copy complete!" | tee -a $LOG_FILE
echo "Total tables: $TOTAL_TABLES" | tee -a $LOG_FILE
echo "Successful: $((TOTAL_TABLES - FAILED))" | tee -a $LOG_FILE
echo "Failed: $FAILED" | tee -a $LOG_FILE
echo "Log file: $LOG_FILE" | tee -a $LOG_FILE
echo "================================" | tee -a $LOG_FILE

if [ $FAILED -gt 0 ]; then
  exit 1
fi

