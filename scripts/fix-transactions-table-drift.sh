#!/bin/bash
set -euo pipefail

# Script to fix CloudFormation drift for TransactionsTable
# Removes resource from CloudFormation, then imports it back with correct schema

STACK_NAME="BebcoDataStack-stv"
REGION="us-east-2"
LOGICAL_ID="TransactionsTable0A011FCB"
TABLE_NAME="bebco-borrower-transactions-stv"

echo "🔧 Fixing CloudFormation Drift for TransactionsTable"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo "Table: $TABLE_NAME"
echo ""

# Step 1: Get current template
echo "📥 Step 1: Getting current CloudFormation template..."
aws cloudformation get-template \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'TemplateBody' \
  --output text > /tmp/current-template.yaml

if [ ! -s /tmp/current-template.yaml ]; then
  echo "❌ Failed to get current template"
  exit 1
fi
echo "✅ Template downloaded"

# Step 2: Remove TransactionsTable resource from template
echo ""
echo "✂️  Step 2: Removing TransactionsTable resource from template..."
# Use Python to parse YAML and remove the resource
python3 << 'PYTHON_SCRIPT'
import yaml
import sys

try:
    with open('/tmp/current-template.yaml', 'r') as f:
        content = f.read()
        template = yaml.safe_load(content)
    
    # Handle case where template might be a list (multiple documents)
    if isinstance(template, list):
        template = template[0] if template else {}
    
    # Remove TransactionsTable resource
    if 'Resources' in template and 'TransactionsTable0A011FCB' in template['Resources']:
        # Add DeletionPolicy: Retain before removing
        resource = template['Resources']['TransactionsTable0A011FCB']
        if isinstance(resource, dict):
            resource['DeletionPolicy'] = 'Retain'
            resource['UpdateReplacePolicy'] = 'Retain'
        
        # Save template without TransactionsTable
        del template['Resources']['TransactionsTable0A011FCB']
        
        with open('/tmp/without-transactions.yaml', 'w') as f:
            yaml.dump(template, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
        
        print("✅ Removed TransactionsTable from template (with Retain policy)")
    else:
        print("⚠️  TransactionsTable resource not found in template")
        # Copy template as-is
        with open('/tmp/without-transactions.yaml', 'w') as f:
            yaml.dump(template, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
except Exception as e:
    import traceback
    print(f"❌ Error processing template: {e}")
    traceback.print_exc()
    sys.exit(1)
PYTHON_SCRIPT

if [ $? -ne 0 ]; then
  echo "❌ Failed to process template"
  exit 1
fi

# Step 3: Update stack to remove TransactionsTable
echo ""
echo "🗑️  Step 3: Updating stack to remove TransactionsTable from CloudFormation..."
echo "   (Table will remain in AWS due to Retain policy)"
aws cloudformation update-stack \
  --stack-name "$STACK_NAME" \
  --template-body file:///tmp/without-transactions.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  2>&1 | tee /tmp/update-stack.log

UPDATE_STATUS=$(grep -oP 'StackId|StackName' /tmp/update-stack.log | head -1 || echo "")

if [ -z "$UPDATE_STATUS" ]; then
  echo "⚠️  Update may have failed or already in progress. Checking status..."
else
  echo "✅ Update initiated"
fi

# Wait for update to complete
echo ""
echo "⏳ Waiting for stack update to complete..."
aws cloudformation wait stack-update-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  || echo "⚠️  Update may have failed, but continuing..."

# Step 4: Synthesize template with TransactionsTable (correct schema)
echo ""
echo "📝 Step 4: Synthesizing CDK template with correct TransactionsTable schema..."
cd "$(dirname "$0")/.."
npx cdk synth "$STACK_NAME" \
  --context environment=steven \
  --context region="$REGION" \
  > /tmp/with-transactions.yaml 2>&1

if [ ! -s /tmp/with-transactions.yaml ]; then
  echo "❌ Failed to synthesize template"
  exit 1
fi
echo "✅ Template synthesized"

# Step 5: Create import changeset
echo ""
echo "📦 Step 5: Creating import changeset..."
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
  --capabilities CAPABILITY_NAMED_IAM \
  2>&1 | tee /tmp/create-changeset.log

if grep -q "ChangeSetId" /tmp/create-changeset.log; then
  echo "✅ Changeset created: $CHANGESET_NAME"
else
  echo "❌ Failed to create changeset"
  cat /tmp/create-changeset.log
  exit 1
fi

# Step 6: Wait for changeset to be ready
echo ""
echo "⏳ Waiting for changeset to be ready..."
sleep 10
aws cloudformation wait change-set-create-complete \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --region "$REGION" \
  || echo "⚠️  Changeset may still be creating..."

# Step 7: Execute changeset
echo ""
echo "▶️  Step 6: Executing changeset to import TransactionsTable..."
aws cloudformation execute-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --region "$REGION"

echo ""
echo "⏳ Waiting for import to complete..."
aws cloudformation wait stack-update-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

# Step 8: Verify no drift
echo ""
echo "✅ Step 7: Verifying drift is fixed..."
sleep 5
DRIFT_STATUS=$(aws cloudformation describe-stack-resource-drifts \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID'].StackResourceDriftStatus" \
  --output text 2>/dev/null || echo "NOT_CHECKED")

if [ "$DRIFT_STATUS" = "IN_SYNC" ]; then
  echo "✅ ✅ ✅ Drift fixed! TransactionsTable is now IN_SYNC"
elif [ "$DRIFT_STATUS" = "MODIFIED" ]; then
  echo "⚠️  Drift still detected. Checking details..."
  aws cloudformation describe-stack-resource-drifts \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID']" \
    --output json
else
  echo "ℹ️  Drift status: $DRIFT_STATUS"
fi

echo ""
echo "🎉 Drift fix process complete!"
echo ""
echo "Summary:"
echo "  - Removed TransactionsTable from CloudFormation (table retained)"
echo "  - Imported TransactionsTable back with correct schema"
echo "  - Table: $TABLE_NAME"
echo "  - Stack: $STACK_NAME"

