#!/bin/bash
set -e

EXPORT_DIR="exports/lambda-configs"
OUTPUT_FILE="config/lambda-packages.json"

echo "Analyzing exported Lambda functions..."

# Generate Lambda package manifest
jq '[.[] | {
  name: .FunctionName,
  runtime: .Runtime,
  handler: .Handler,
  timeout: .Timeout,
  memorySize: .MemorySize,
  codeSize: .CodeSize,
  layers: [.Layers[]? | .Arn],
  layerCount: (.Layers | length),
  environment: .Environment.Variables
}]' "$EXPORT_DIR/all-functions.json" > "$OUTPUT_FILE"

echo "Generated Lambda manifest: $OUTPUT_FILE"
echo ""
echo "=== Summary ==="
echo "Total functions: $(jq 'length' $OUTPUT_FILE)"
echo "With layers: $(jq '[.[] | select(.layerCount > 0)] | length' $OUTPUT_FILE)"
echo "Without layers: $(jq '[.[] | select(.layerCount == 0)] | length' $OUTPUT_FILE)"
echo ""
echo "=== Runtimes ==="
jq -r 'group_by(.runtime) | .[] | "\(.[0].runtime): \(length)"' $OUTPUT_FILE
echo ""
echo "=== Top 10 Largest Functions ==="
jq -r 'sort_by(-.codeSize) | .[:10] | .[] | "\(.name): \(.codeSize / 1024 / 1024 | floor)MB"' $OUTPUT_FILE

