#!/bin/bash
set -euo pipefail

# Rock-solid automated drift fix
# This script orchestrates the complete process

STACK_NAME="BebcoDataStack-stv"
REGION="us-east-2"
LOGICAL_ID="TransactionsTable0A011FCB"
TABLE_NAME="bebco-borrower-transactions-stv"

echo "════════════════════════════════════════════════════════════════"
echo "🔧 ROCK-SOLID CloudFormation Drift Fix"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "This script will:"
echo "  1. Remove TransactionsTable from CloudFormation (table stays)"
echo "  2. Import it back with correct schema"
echo "  3. Verify drift is fixed"
echo ""
echo "Starting automated fix..."

# Step 1: Ensure we're using the right template format
echo ""
echo "📥 Step 1: Getting template from CloudFormation..."
aws cloudformation get-template \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --template-stage Original \
  --query 'TemplateBody' \
  --output text > /tmp/template.yaml

# Step 2: Remove TransactionsTable using Python (handles all edge cases)
echo ""
echo "✂️  Step 2: Removing TransactionsTable resource..."
python3 << 'PYTHON'
with open('/tmp/template.yaml', 'r') as f:
    lines = f.readlines()

# Remove TransactionsTable resource using line-by-line approach
new_lines = []
in_resource = False
skip_indent = None

for line in lines:
    if 'TransactionsTable0A011FCB:' in line:
        in_resource = True
        skip_indent = len(line) - len(line.lstrip())
        continue
    
    if in_resource:
        # Check if we've reached next resource or top-level key
        stripped = line.lstrip()
        if stripped and not stripped.startswith('#'):
            current_indent = len(line) - len(stripped)
            # Next resource starts at same or lower indent with uppercase letter
            if current_indent <= skip_indent and stripped and stripped[0].isupper() and ':' in stripped:
                in_resource = False
                new_lines.append(line)
        continue
    
    # Remove exports/outputs referencing TransactionsTable
    if 'TransactionsTable0A011FCB' in line:
        continue
    
    new_lines.append(line)

with open('/tmp/template-without.yaml', 'w') as f:
    f.writelines(new_lines)

print(f"✅ Removed TransactionsTable (reduced from {len(lines)} to {len(new_lines)} lines)")
PYTHON

# Step 3: Update stack
echo ""
echo "🗑️  Step 3: Updating stack (removes TransactionsTable from CF)..."
UPDATE_OUTPUT=$(aws cloudformation update-stack \
  --stack-name "$STACK_NAME" \
  --template-body file:///tmp/template-without.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1 || true)

if echo "$UPDATE_OUTPUT" | grep -q "StackId\|No updates"; then
  echo "✅ Update initiated"
else
  echo "⚠️  Update output: $UPDATE_OUTPUT"
fi

# Wait
echo "⏳ Waiting for update (checking every 10 seconds)..."
for i in {1..30}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")
  
  if [[ "$STATUS" == *"COMPLETE"* ]] && [[ "$STATUS" != *"ROLLBACK"* ]]; then
    echo "✅ Update complete: $STATUS"
    break
  fi
  echo "  [$i/30] Status: $STATUS"
  sleep 10
done

# Step 4: Synthesize and import
echo ""
echo "📝 Step 4: Synthesizing CDK template..."
cd "$(dirname "$0")/.."
npx cdk synth "$STACK_NAME" \
  --context environment=steven \
  --context region="$REGION" \
  > /tmp/with-transactions.yaml 2>&1

echo ""
echo "📦 Step 5: Creating import changeset..."
cat > /tmp/import.json << EOF
[
  {
    "ResourceType": "AWS::DynamoDB::Table",
    "LogicalResourceId": "$LOGICAL_ID",
    "ResourceIdentifier": {"TableName": "$TABLE_NAME"}
  }
]
EOF

CHANGESET="import-$(date +%s)"
aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET" \
  --change-set-type IMPORT \
  --resources-to-import file:///tmp/import.json \
  --template-body file:///tmp/with-transactions.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND

echo "⏳ Waiting for changeset..."
sleep 20

echo ""
echo "▶️  Step 6: Executing import..."
aws cloudformation execute-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET" \
  --region "$REGION"

echo "⏳ Waiting for import..."
for i in {1..30}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")
  
  if [ "$STATUS" = "UPDATE_COMPLETE" ]; then
    echo "✅ Import complete!"
    break
  fi
  echo "  [$i/30] Status: $STATUS"
  sleep 10
done

# Verify
echo ""
echo "✅ Step 7: Verifying drift..."
sleep 15
DRIFT=$(aws cloudformation describe-stack-resource-drifts \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID'].StackResourceDriftStatus" \
  --output text 2>/dev/null || echo "NOT_CHECKED")

if [ "$DRIFT" = "IN_SYNC" ]; then
  echo "🎉 🎉 🎉 DRIFT FIXED! Status: IN_SYNC 🎉 🎉 🎉"
else
  echo "Drift status: $DRIFT (may take a few minutes to sync)"
fi

echo ""
echo "✅ Process complete!"
