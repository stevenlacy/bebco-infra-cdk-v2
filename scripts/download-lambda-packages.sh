#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
OUTPUT_DIR="dist/lambda-packages"
CONFIG_FILE="config/lambda-packages.json"

echo "==========================================="
echo "Downloading Lambda packages from us-east-1"
echo "READ ONLY - No changes to us-east-1"
echo "==========================================="

mkdir -p $OUTPUT_DIR

# Get list of all Lambda functions
TOTAL=$(jq 'length' $CONFIG_FILE)
CURRENT=0

jq -r '.[] | .name' $CONFIG_FILE | while read func_name; do
  CURRENT=$((CURRENT + 1))
  echo ""
  echo "[$CURRENT/$TOTAL] Downloading: $func_name"
  
  # Get the download URL for the function code
  CODE_URL=$(aws lambda get-function \
    --function-name "$func_name" \
    --region $SOURCE_REGION \
    --query 'Code.Location' \
    --output text)
  
  # Download the ZIP file
  curl -s -o "$OUTPUT_DIR/${func_name}.zip" "$CODE_URL"
  
  SIZE=$(ls -lh "$OUTPUT_DIR/${func_name}.zip" | awk '{print $5}')
  echo "  Downloaded: ${func_name}.zip ($SIZE)"
done

echo ""
echo "==========================================="
echo "Download complete!"
echo "Total packages: $(ls -1 $OUTPUT_DIR/*.zip | wc -l | tr -d ' ')"
echo "==========================================="

