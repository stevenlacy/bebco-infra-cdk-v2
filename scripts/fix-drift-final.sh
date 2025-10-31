#!/bin/bash
set -euo pipefail

# Final, rock-solid script to fix CloudFormation drift for TransactionsTable
# Uses CloudFormation JSON templates directly for maximum reliability

STACK_NAME="BebcoDataStack-stv"
REGION="us-east-2"
LOGICAL_ID="TransactionsTable0A011FCB"
TABLE_NAME="bebco-borrower-transactions-stv"

echo "🔧 Fixing CloudFormation Drift for TransactionsTable"
echo "Stack: $STACK_NAME | Region: $REGION | Table: $TABLE_NAME"
echo ""

# Step 1: Get template in JSON format
echo "📥 Step 1: Getting CloudFormation template (JSON format)..."
aws cloudformation get-template \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --template-stage Processed \
  --query 'TemplateBody' \
  --output json > /tmp/template.json 2>&1

# Parse JSON (template body might be a JSON string or already parsed)
python3 << 'PYTHON'
import json

with open('/tmp/template.json', 'r') as f:
    data = json.load(f)

# Template body might be a string or already a dict
if isinstance(data, str):
    template = json.loads(data)
elif isinstance(data, dict) and 'TemplateBody' in data:
    template = json.loads(data['TemplateBody']) if isinstance(data['TemplateBody'], str) else data['TemplateBody']
else:
    template = data

# Ensure DeletionPolicy is set
if 'TransactionsTable0A011FCB' in template.get('Resources', {}):
    resource = template['Resources']['TransactionsTable0A011FCB']
    resource['DeletionPolicy'] = 'Retain'
    resource['UpdateReplacePolicy'] = 'Retain'
    
    with open('/tmp/template-with-retain.json', 'w') as f:
        json.dump(template, f, indent=2)
    print("✅ Added DeletionPolicy: Retain")
else:
    print("⚠️  TransactionsTable not found")
PYTHON

# Step 2: Update stack to add DeletionPolicy
echo ""
echo "📝 Step 2: Updating stack to add DeletionPolicy: Retain..."
aws cloudformation update-stack \
  --stack-name "$STACK_NAME" \
  --template-body file:///tmp/template-with-retain.json \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1 | grep -E "StackId|No updates|error" || true

echo "⏳ Waiting 30 seconds for update..."
sleep 30

# Step 3: Remove TransactionsTable from template
echo ""
echo "✂️  Step 3: Removing TransactionsTable from template..."
python3 << 'PYTHON'
import json

with open('/tmp/template-with-retain.json', 'r') as f:
    template = json.load(f)

# Remove TransactionsTable
if 'TransactionsTable0A011FCB' in template.get('Resources', {}):
    del template['Resources']['TransactionsTable0A011FCB']
    
    # Remove exports
    if 'Outputs' in template:
        to_remove = [k for k, v in template['Outputs'].items() 
                    if 'TransactionsTable0A011FCB' in str(v)]
        for k in to_remove:
            del template['Outputs'][k]
    
    with open('/tmp/without-transactions.json', 'w') as f:
        json.dump(template, f, indent=2)
    print(f"✅ Removed TransactionsTable (Resources: {len(template.get('Resources', {}))})")
else:
    print("⚠️  TransactionsTable already removed")
PYTHON

# Step 4: Update stack to remove TransactionsTable
echo ""
echo "🗑️  Step 4: Removing TransactionsTable from CloudFormation..."
aws cloudformation update-stack \
  --stack-name "$STACK_NAME" \
  --template-body file:///tmp/without-transactions.json \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1 | grep -E "StackId|No updates|error" || true

echo "⏳ Waiting for removal (2 minutes)..."
for i in {1..24}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")
  
  if [[ "$STATUS" == *"COMPLETE"* ]] && [[ "$STATUS" != *"ROLLBACK"* ]]; then
    echo "✅ Update complete (status: $STATUS)"
    break
  fi
  sleep 5
done

# Step 5: Synthesize CDK template
echo ""
echo "📝 Step 5: Synthesizing CDK template with correct schema..."
cd "$(dirname "$0")/.."
npx cdk synth "$STACK_NAME" \
  --context environment=steven \
  --context region="$REGION" \
  > /tmp/with-transactions.yaml 2>&1

# Step 6: Import TransactionsTable
echo ""
echo "📦 Step 6: Creating import changeset..."
cat > /tmp/import-transactions.json << EOF
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

CHANGESET_NAME="import-transactions-$(date +%s)"
aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --change-set-type IMPORT \
  --resources-to-import file:///tmp/import-transactions.json \
  --template-body file:///tmp/with-transactions.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1 | grep -E "ChangeSetId|Id|error" || true

echo "⏳ Waiting for changeset (30 seconds)..."
sleep 30

# Step 7: Execute changeset
echo ""
echo "▶️  Step 7: Executing import..."
aws cloudformation execute-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --region "$REGION"

echo "⏳ Waiting for import (2 minutes)..."
for i in {1..24}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")
  
  if [[ "$STATUS" == "UPDATE_COMPLETE" ]]; then
    echo "✅ Import complete!"
    break
  fi
  sleep 5
done

# Step 8: Verify drift
echo ""
echo "✅ Step 8: Verifying drift is fixed..."
sleep 10
DRIFT=$(aws cloudformation describe-stack-resource-drifts \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID'].StackResourceDriftStatus" \
  --output text 2>/dev/null || echo "NOT_CHECKED")

if [ "$DRIFT" = "IN_SYNC" ]; then
  echo "🎉 🎉 🎉 Drift Fixed! Status: IN_SYNC 🎉 🎉 🎉"
else
  echo "Drift status: $DRIFT (may take a few minutes to update)"
fi

echo ""
echo "✅ Process complete!"

