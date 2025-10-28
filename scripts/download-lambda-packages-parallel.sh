#!/bin/bash
set -e

# region for prod comparison
SOURCE_REGION="us-east-1"
OUTPUT_DIR="dist/lambda-packages"
CONFIG_FILE="config/lambda-packages.json"
PARALLEL_JOBS=10

echo "==========================================="
echo "Downloading Lambda packages from us-east-1"
echo "Using $PARALLEL_JOBS parallel downloads"
echo "READ ONLY - No changes to us-east-1"
echo "==========================================="

mkdir -p $OUTPUT_DIR

# Function to download a single Lambda package
download_function() {
  local func_name=$1
  local region=$2
  local output_dir=$3
  
  # Get the download URL for the function code
  CODE_URL=$(aws lambda get-function \
    --function-name "$func_name" \
    --region $region \
    --query 'Code.Location' \
    --output text 2>/dev/null)
  
  if [ -n "$CODE_URL" ]; then
    # Download the ZIP file
    curl -s -o "$output_dir/${func_name}.zip" "$CODE_URL"
    SIZE=$(ls -lh "$output_dir/${func_name}.zip" | awk '{print $5}')
    echo "✓ $func_name ($SIZE)"
  else
    echo "✗ $func_name (failed to get URL)"
  fi
}

export -f download_function
export SOURCE_REGION OUTPUT_DIR

# Download all functions in parallel
echo ""
echo "Starting downloads..."
jq -r '.[] | .name' $CONFIG_FILE | \
  xargs -P $PARALLEL_JOBS -I {} bash -c 'download_function "$@"' _ {} "$SOURCE_REGION" "$OUTPUT_DIR"

echo ""
echo "==========================================="
echo "Download complete!"
DOWNLOADED=$(ls -1 $OUTPUT_DIR/*.zip 2>/dev/null | wc -l | tr -d ' ')
echo "Total packages: $DOWNLOADED"
echo "==========================================="

