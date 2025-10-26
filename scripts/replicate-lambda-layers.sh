#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
TARGET_REGION="us-east-2"

echo "==========================================="
echo "Replicating Lambda layers:"
echo "$SOURCE_REGION → $TARGET_REGION"
echo "READ ONLY operations on $SOURCE_REGION"
echo "==========================================="

mkdir -p dist/layers

# DocuSign Layer (used by 5 functions)
echo ""
echo "Replicating bebco-docusign-layer..."
aws lambda get-layer-version \
  --layer-name bebco-docusign-layer \
  --version-number 1 \
  --region $SOURCE_REGION \
  --query 'Content.Location' \
  --output text > dist/layers/docusign-url.txt

echo "Downloading layer ZIP..."
curl -s -o dist/layers/docusign-layer.zip $(cat dist/layers/docusign-url.txt)

echo "Uploading to $TARGET_REGION..."
DOCUSIGN_LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name bebco-docusign-layer \
  --description "DocuSign SDK for envelope operations" \
  --zip-file fileb://dist/layers/docusign-layer.zip \
  --compatible-runtimes python3.9 \
  --region $TARGET_REGION \
  --query 'LayerVersionArn' \
  --output text)

echo "✓ DocuSign layer replicated to $TARGET_REGION"
echo "  ARN: $DOCUSIGN_LAYER_ARN"

# Python Deps Layer (used by 6 functions)
echo ""
echo "Replicating bebco-python-deps layer..."
aws lambda get-layer-version \
  --layer-name bebco-staging-python-deps \
  --version-number 4 \
  --region $SOURCE_REGION \
  --query 'Content.Location' \
  --output text > dist/layers/python-deps-url.txt

echo "Downloading layer ZIP..."
curl -s -o dist/layers/python-deps-layer.zip $(cat dist/layers/python-deps-url.txt)

echo "Uploading to $TARGET_REGION..."
PYTHON_DEPS_LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name bebco-python-deps \
  --description "Python dependencies for Lambda functions" \
  --zip-file fileb://dist/layers/python-deps-layer.zip \
  --compatible-runtimes python3.9 python3.11 python3.12 \
  --region $TARGET_REGION \
  --query 'LayerVersionArn' \
  --output text)

echo "✓ Python deps layer replicated to $TARGET_REGION"
echo "  ARN: $PYTHON_DEPS_LAYER_ARN"

echo ""
echo "==========================================="
echo "Layer replication complete!"
echo "==========================================="
echo "DocuSign Layer: $DOCUSIGN_LAYER_ARN"
echo "Python Deps Layer: $PYTHON_DEPS_LAYER_ARN"
echo "==========================================="

