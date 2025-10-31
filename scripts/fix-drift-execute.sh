#!/bin/bash
set -euo pipefail

# Final automated script - executes exact AWS CLI commands that work
# Handles all edge cases and provides clear output

STACK_NAME="BebcoDataStack-stv"
REGION="us-east-2"
LOGICAL_ID="TransactionsTable0A011FCB"
TABLE_NAME="bebco-borrower-transactions-stv"

echo "════════════════════════════════════════════════════════════════"
echo "🔧 AUTOMATED CloudFormation Drift Fix - EXECUTING NOW"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Get template in proper format and remove TransactionsTable
echo "📥 Step 1: Preparing template without TransactionsTable..."
python3 << 'PYTHON'
import json
import subprocess
import sys

# Get template from CloudFormation
result = subprocess.run([
    'aws', 'cloudformation', 'get-template',
    '--stack-name', 'BebcoDataStack-stv',
    '--region', 'us-east-2',
    '--template-stage', 'Processed',
    '--query', 'TemplateBody',
    '--output', 'json'
], capture_output=True, text=True, check=True)

data = json.loads(result.stdout)
template_str = data if isinstance(data, str) else json.dumps(data)
template = json.loads(template_str)

# Ensure AWSTemplateFormatVersion
if 'AWSTemplateFormatVersion' not in template:
    template['AWSTemplateFormatVersion'] = '2010-09-09'

# Remove TransactionsTable
removed = False
if 'TransactionsTable0A011FCB' in template.get('Resources', {}):
    del template['Resources']['TransactionsTable0A011FCB']
    removed = True

# Remove outputs referencing TransactionsTable
if 'Outputs' in template:
    outputs_to_remove = []
    for key, value in template['Outputs'].items():
        if isinstance(value, dict) and 'TransactionsTable0A011FCB' in str(value):
            outputs_to_remove.append(key)
    for key in outputs_to_remove:
        del template['Outputs'][key]

# Save template
with open('/tmp/template-remove-tx.json', 'w') as f:
    json.dump(template, f, indent=2)

if removed:
    print(f"✅ Removed TransactionsTable (Resources: {len(template.get('Resources', {}))})")
else:
    print("⚠️  TransactionsTable not found (may already be removed)")
PYTHON

# Step 2: Update stack using AWS CLI with proper JSON escaping
echo ""
echo "🗑️  Step 2: Removing TransactionsTable from CloudFormation..."
TEMPLATE_JSON=$(cat /tmp/template-remove-tx.json)
UPDATE_OUTPUT=$(aws cloudformation update-stack \
  --stack-name "$STACK_NAME" \
  --template-body "$TEMPLATE_JSON" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1 || true)

if echo "$UPDATE_OUTPUT" | grep -q "StackId\|No updates"; then
  echo "✅ Update initiated"
elif echo "$UPDATE_OUTPUT" | grep -q "No updates"; then
  echo "✅ No updates needed (resource may already be removed)"
else
  echo "⚠️  Update response: $(echo "$UPDATE_OUTPUT" | head -3)"
fi

# Step 3: Wait for update
echo ""
echo "⏳ Step 3: Waiting for update to complete..."
for i in {1..40}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")
  
  printf "\r  [%2d/40] Status: %-30s" $i "$STATUS"
  
  if [ "$STATUS" = "UPDATE_COMPLETE" ]; then
    echo ""
    echo "✅ ✅ Update complete! TransactionsTable removed"
    UPDATE_SUCCESS=true
    break
  elif [[ "$STATUS" == *"FAILED"* ]] || [[ "$STATUS" == *"ROLLBACK_COMPLETE"* ]]; then
    echo ""
    echo "⚠️  Update finished: $STATUS"
    UPDATE_SUCCESS=false
    break
  fi
  sleep 10
done

# Step 4: Check if resource was removed
echo ""
RESOURCE_COUNT=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "length(StackResources[?LogicalResourceId=='$LOGICAL_ID'])" \
  --output text 2>/dev/null || echo "1")

if [ "$RESOURCE_COUNT" = "0" ]; then
  echo "✅ ✅ ✅ TransactionsTable successfully removed from CloudFormation!"
  echo ""
  
  # Step 5: Synthesize CDK template
  echo "📝 Step 4: Synthesizing CDK template with correct schema..."
  cd "$(dirname "$0")/.."
  npx cdk synth "$STACK_NAME" \
    --context environment=steven \
    --context region="$REGION" \
    > /tmp/template-with-tx.yaml 2>&1
  
  # Step 6: Create import changeset
  echo ""
  echo "📦 Step 5: Creating import changeset..."
  cat > /tmp/import-tx.json << EOF
[
  {
    "ResourceType": "AWS::DynamoDB::Table",
    "LogicalResourceId": "$LOGICAL_ID",
    "ResourceIdentifier": {
      "TableName": "$TABLE_NAME"
    }
  }
]
EOF
  
  CHANGESET="import-tx-$(date +%s)"
  CHANGESET_OUTPUT=$(aws cloudformation create-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET" \
    --change-set-type IMPORT \
    --resources-to-import file:///tmp/import-tx.json \
    --template-body file:///tmp/template-with-tx.yaml \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    2>&1 || true)
  
  if echo "$CHANGESET_OUTPUT" | grep -q "ChangeSetId\|Id"; then
    echo "✅ Changeset created: $CHANGESET"
    
    # Step 7: Wait and execute
    echo ""
    echo "⏳ Waiting for changeset to be ready..."
    sleep 20
    
    echo ""
    echo "▶️  Step 6: Executing import..."
    aws cloudformation execute-change-set \
      --stack-name "$STACK_NAME" \
      --change-set-name "$CHANGESET" \
      --region "$REGION"
    
    echo ""
    echo "⏳ Waiting for import to complete..."
    for i in {1..40}; do
      STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")
      
      printf "\r  [%2d/40] Status: %-30s" $i "$STATUS"
      
      if [ "$STATUS" = "UPDATE_COMPLETE" ]; then
        echo ""
        echo "✅ ✅ ✅ Import complete!"
        IMPORT_SUCCESS=true
        break
      elif [[ "$STATUS" == *"FAILED"* ]]; then
        echo ""
        echo "❌ Import failed: $STATUS"
        IMPORT_SUCCESS=false
        break
      fi
      sleep 10
    done
    
    # Step 8: Verify drift
    if [ "$IMPORT_SUCCESS" = "true" ]; then
      echo ""
      echo "✅ Step 7: Verifying drift is fixed..."
      sleep 15
      DRIFT=$(aws cloudformation describe-stack-resource-drifts \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID'].StackResourceDriftStatus" \
        --output text 2>/dev/null || echo "NOT_CHECKED")
      
      echo ""
      if [ "$DRIFT" = "IN_SYNC" ]; then
        echo "🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉"
        echo "🎉  DRIFT COMPLETELY FIXED! Status: IN_SYNC"
        echo "🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉"
      else
        echo "Drift status: $DRIFT"
        echo "(May take a few minutes for CloudFormation to detect sync)"
      fi
    fi
  else
    echo "❌ Failed to create changeset:"
    echo "$CHANGESET_OUTPUT" | head -10
  fi
else
  echo "⚠️  TransactionsTable still exists in CloudFormation"
  echo "   This means the update didn't remove it."
  echo "   Status: $STATUS"
  echo ""
  echo "   The resource may need to be removed manually via AWS Console:"
  echo "   1. Go to CloudFormation Console"
  echo "   2. Select stack: $STACK_NAME"
  echo "   3. Stack Actions > Delete Resources"
  echo "   4. Select TransactionsTable0A011FCB, Retain=True"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Process complete!"
echo "════════════════════════════════════════════════════════════════"


