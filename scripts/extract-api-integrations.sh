#!/bin/bash

# Script to extract all Lambda integrations from API Gateway resources
# This is a READ ONLY operation on us-east-1

set -e

API_ID=$1
OUTPUT_FILE=$2
RESOURCES_FILE=$3

if [ -z "$API_ID" ] || [ -z "$OUTPUT_FILE" ] || [ -z "$RESOURCES_FILE" ]; then
  echo "Usage: $0 <api-id> <output-file> <resources-file>"
  exit 1
fi

echo "Processing API: $API_ID"
echo "Reading resources from: $RESOURCES_FILE"
echo "Output will be saved to: $OUTPUT_FILE"
echo ""

# Initialize output
echo "[]" > "$OUTPUT_FILE"

# Read each resource
RESOURCES=$(jq -c '.items[]' "$RESOURCES_FILE")

TOTAL=$(echo "$RESOURCES" | wc -l | tr -d ' ')
CURRENT=0

echo "$RESOURCES" | while IFS= read -r resource; do
  CURRENT=$((CURRENT + 1))
  
  RESOURCE_ID=$(echo "$resource" | jq -r '.id')
  PATH=$(echo "$resource" | jq -r '.path')
  
  # Get methods for this resource
  METHODS=$(echo "$resource" | jq -r '.resourceMethods // {} | keys[]' 2>/dev/null)
  
  if [ -n "$METHODS" ]; then
    echo "[$CURRENT/$TOTAL] $PATH"
    
    for METHOD in $METHODS; do
      # Get integration details for this method
      INTEGRATION=$(aws apigateway get-integration \
        --rest-api-id "$API_ID" \
        --resource-id "$RESOURCE_ID" \
        --http-method "$METHOD" \
        --region us-east-1 \
        --output json 2>/dev/null || echo "{}")
      
      if [ "$INTEGRATION" != "{}" ]; then
        # Extract Lambda function name from URI
        LAMBDA_URI=$(echo "$INTEGRATION" | jq -r '.uri // ""')
        LAMBDA_NAME=""
        
        if [[ $LAMBDA_URI =~ functions/([^/]+)/ ]]; then
          LAMBDA_NAME="${BASH_REMATCH[1]}"
        fi
        
        # Create integration record
        RECORD=$(jq -n \
          --arg path "$PATH" \
          --arg method "$METHOD" \
          --arg lambda "$LAMBDA_NAME" \
          --arg uri "$LAMBDA_URI" \
          --arg type "$(echo "$INTEGRATION" | jq -r '.type // ""')" \
          '{path: $path, method: $method, lambdaFunction: $lambda, uri: $uri, integrationType: $type}')
        
        # Append to output file
        jq --argjson new "$RECORD" '. += [$new]' "$OUTPUT_FILE" > "${OUTPUT_FILE}.tmp"
        mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
        
        echo "    $METHOD -> $LAMBDA_NAME"
      fi
    done
  fi
done

INTEGRATION_COUNT=$(jq 'length' "$OUTPUT_FILE")
echo ""
echo "✓ Extracted $INTEGRATION_COUNT integrations"

