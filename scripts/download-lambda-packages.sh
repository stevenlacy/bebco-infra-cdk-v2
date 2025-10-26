#!/bin/bash
set -e

SOURCE_REGION="${SOURCE_REGION:-us-east-1}"
OUTPUT_DIR="${OUTPUT_DIR:-dist/lambda-packages}"
CONFIG_FILE="${CONFIG_FILE:-config/lambda-packages.json}"

echo "==========================================="
echo "Downloading Lambda packages from ${SOURCE_REGION}"
echo "READ ONLY - No changes to ${SOURCE_REGION}"
echo "==========================================="

mkdir -p "$OUTPUT_DIR"

# fetch available functions in the target region once
AVAILABLE_FILE=$(mktemp)
aws lambda list-functions \
  --region "$SOURCE_REGION" \
  --query 'Functions[].FunctionName' \
  --output text \
  | tr '\t' '\n' \
  | sort > "$AVAILABLE_FILE"

resolve_function_name() {
  local original="$1"
  if grep -Fxq "$original" "$AVAILABLE_FILE"; then
    echo "$original"
    return 0
  fi

  local global_sub
  global_sub=$(echo "$original" | sed 's/staging/dev/g')
  if grep -Fxq "$global_sub" "$AVAILABLE_FILE"; then
    echo "$global_sub"
    return 0
  fi

  local hyphen_sub
  hyphen_sub=$(echo "$original" | sed 's/-staging/-dev/g')
  if grep -Fxq "$hyphen_sub" "$AVAILABLE_FILE"; then
    echo "$hyphen_sub"
    return 0
  fi

  local suffix_sub
  suffix_sub=$(echo "$original" | sed 's/staging$/dev/')
  if grep -Fxq "$suffix_sub" "$AVAILABLE_FILE"; then
    echo "$suffix_sub"
    return 0
  fi

  return 1
}

# Get list of all Lambda functions defined in config
TOTAL=$(jq 'length' "$CONFIG_FILE")
CURRENT=0

jq -r '.[] | .name' "$CONFIG_FILE" | while read func_name; do
  CURRENT=$((CURRENT + 1))
  echo ""
  echo "[$CURRENT/$TOTAL] Downloading: $func_name"

  RESOLVED_NAME=$(resolve_function_name "$func_name") || {
    echo "  Skipping: not present in ${SOURCE_REGION}"
    continue
  }
  if [ "$RESOLVED_NAME" != "$func_name" ]; then
    echo "  Using mapped function name: $RESOLVED_NAME"
  fi
  
  # Get the download URL for the function code
  CODE_URL=$(aws lambda get-function \
    --function-name "$RESOLVED_NAME" \
    --region $SOURCE_REGION \
    --query 'Code.Location' \
    --output text)
  
  # Download the ZIP file
  curl -s -o "$OUTPUT_DIR/${func_name}.zip" "$CODE_URL"
  
  SIZE=$(ls -lh "$OUTPUT_DIR/${func_name}.zip" | awk '{print $5}')
  echo "  Downloaded: ${func_name}.zip ($SIZE)"
done

rm -f "$AVAILABLE_FILE"

echo ""
echo "==========================================="
echo "Download complete!"
echo "Total packages: $(ls -1 $OUTPUT_DIR/*.zip | wc -l | tr -d ' ')"
echo "==========================================="

