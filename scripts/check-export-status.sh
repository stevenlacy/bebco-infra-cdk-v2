#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
EXPORT_ARNS_FILE="export-arns.txt"

cd "$(dirname "$0")"

if [ ! -f "$EXPORT_ARNS_FILE" ]; then
  echo "Error: No export ARNs file found. Run start-all-dynamodb-exports.sh first."
  exit 1
fi

echo "==========================================="
echo "DynamoDB Export Status Check"
echo "==========================================="
echo ""
echo "Checking status of all export jobs..."
echo ""

TOTAL=0
COMPLETED=0
IN_PROGRESS=0
FAILED=0

while IFS='|' read -r export_arn table_name; do
  TOTAL=$((TOTAL + 1))
  
  # Get export status
  STATUS_OUTPUT=$(aws dynamodb describe-export \
    --export-arn "$export_arn" \
    --region "$SOURCE_REGION" \
    --output json 2>&1)
  
  if [ $? -eq 0 ]; then
    STATUS=$(echo "$STATUS_OUTPUT" | jq -r '.ExportDescription.ExportStatus')
    ITEM_COUNT=$(echo "$STATUS_OUTPUT" | jq -r '.ExportDescription.ItemCount // 0')
    
    case "$STATUS" in
      COMPLETED)
        echo "✅ $table_name: COMPLETED ($ITEM_COUNT items)"
        COMPLETED=$((COMPLETED + 1))
        ;;
      IN_PROGRESS)
        echo "⏳ $table_name: IN_PROGRESS..."
        IN_PROGRESS=$((IN_PROGRESS + 1))
        ;;
      FAILED)
        FAILURE_CODE=$(echo "$STATUS_OUTPUT" | jq -r '.ExportDescription.FailureCode // "UNKNOWN"')
        FAILURE_MSG=$(echo "$STATUS_OUTPUT" | jq -r '.ExportDescription.FailureMessage // "No message"')
        echo "❌ $table_name: FAILED - $FAILURE_CODE: $FAILURE_MSG"
        FAILED=$((FAILED + 1))
        ;;
      *)
        echo "⚠️  $table_name: $STATUS"
        ;;
    esac
  else
    echo "❌ $table_name: Could not get status (API error)"
    FAILED=$((FAILED + 1))
  fi
done < "$EXPORT_ARNS_FILE"

echo ""
echo "==========================================="
echo "Summary: $COMPLETED/$TOTAL completed"
echo "==========================================="
echo ""
echo "Completed:    $COMPLETED"
echo "In Progress:  $IN_PROGRESS"
echo "Failed:       $FAILED"
echo ""

if [ $COMPLETED -eq $TOTAL ]; then
  echo "🎉 All exports complete! Ready for import."
  echo ""
  echo "Next step: Run ./start-all-dynamodb-imports.sh"
elif [ $IN_PROGRESS -gt 0 ]; then
  echo "⏳ Still processing... Check back in a few minutes."
  echo "   Run this script again to update status."
elif [ $FAILED -gt 0 ]; then
  echo "⚠️  Some exports failed. Review errors above."
fi
echo ""

