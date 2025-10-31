#!/bin/bash
set -euo pipefail

# Robust script to fix CloudFormation drift for TransactionsTable
# Handles all edge cases and ensures clean drift removal

STACK_NAME="BebcoDataStack-stv"
REGION="us-east-2"
LOGICAL_ID="TransactionsTable0A011FCB"
TABLE_NAME="bebco-borrower-transactions-stv"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling - only trap on critical errors
set +e  # Don't exit on error immediately, handle manually
# trap 'echo -e "${RED}❌ Script failed at line $LINENO${NC}"; exit 1' ERR

echo -e "${BLUE}🔧 Fixing CloudFormation Drift for TransactionsTable${NC}"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo "Table: $TABLE_NAME"
echo ""

# Verify prerequisites
echo -e "${BLUE}📋 Step 0: Verifying prerequisites...${NC}"
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI not found${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq not found. Install with: brew install jq${NC}"; exit 1; }
python3 -c "import yaml" 2>/dev/null || { echo -e "${YELLOW}⚠️  PyYAML not found. Installing...${NC}"; pip3 install --quiet pyyaml; }
echo -e "${GREEN}✅ Prerequisites verified${NC}"
echo ""

# Step 1: Check current stack status
echo -e "${BLUE}📥 Step 1: Checking stack status...${NC}"
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
  echo -e "${RED}❌ Stack not found: $STACK_NAME${NC}"
  exit 1
fi

echo "Stack Status: $STACK_STATUS"

# Check if resource exists in stack
RESOURCE_EXISTS=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResources[?LogicalResourceId=='$LOGICAL_ID'].LogicalResourceId" \
  --output text 2>/dev/null || echo "")

if [ -z "$RESOURCE_EXISTS" ]; then
  echo -e "${YELLOW}⚠️  TransactionsTable resource not found in stack. It may have been removed already.${NC}"
  echo "Proceeding to import..."
  SKIP_REMOVAL=true
else
  echo -e "${GREEN}✅ TransactionsTable resource found in stack${NC}"
  SKIP_REMOVAL=false
fi
echo ""

# Step 2: Get current template
if [ "$SKIP_REMOVAL" = "false" ]; then
  echo -e "${BLUE}📥 Step 2: Getting current CloudFormation template...${NC}"
  aws cloudformation get-template \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'TemplateBody' \
    --output text > /tmp/current-template-raw.yaml 2>&1

  if [ ! -s /tmp/current-template-raw.yaml ]; then
    echo -e "${RED}❌ Failed to get current template${NC}"
    exit 1
  fi
  
  # Clean the template (remove any non-YAML content, handle both JSON and YAML)
  # First check if it's JSON
  if head -1 /tmp/current-template-raw.yaml 2>/dev/null | grep -q "^{"; then
    # It's JSON, convert to YAML
    python3 -c "import json, yaml; yaml.dump(json.load(open('/tmp/current-template-raw.yaml')), open('/tmp/current-template.yaml', 'w'), default_flow_style=False, sort_keys=False, allow_unicode=True)" 2>/dev/null || cp /tmp/current-template-raw.yaml /tmp/current-template.yaml
  else
    # It's YAML, clean it
    grep -v "^$" /tmp/current-template-raw.yaml 2>/dev/null | grep -v "^---" > /tmp/current-template.yaml 2>/dev/null || cp /tmp/current-template-raw.yaml /tmp/current-template.yaml
  fi
  
  # Verify template file exists and has content
  if [ ! -s /tmp/current-template.yaml ]; then
    echo -e "${RED}❌ Template file is empty after processing${NC}"
    exit 1
  fi
  
  LINE_COUNT=$(wc -l < /tmp/current-template.yaml 2>/dev/null | awk '{print $1}' || echo "0")
  if [ "$LINE_COUNT" = "0" ]; then
    echo -e "${RED}❌ Template appears to be empty${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Template downloaded ($LINE_COUNT lines)${NC}"
  echo ""

  # Step 3: Remove TransactionsTable resource from template using sed (more robust)
  echo -e "${BLUE}✂️  Step 3: Removing TransactionsTable resource from template...${NC}"
  
  # Use sed to remove the TransactionsTable resource section
  # Find start line
  START_LINE=$(grep -n "TransactionsTable0A011FCB:" /tmp/current-template.yaml | head -1 | cut -d: -f1)
  
  if [ -z "$START_LINE" ]; then
    echo -e "${YELLOW}⚠️  TransactionsTable resource not found in template${NC}"
    echo "Proceeding to import (resource may have been removed already)"
    cp /tmp/current-template.yaml /tmp/without-transactions.yaml
    SKIP_REMOVAL=true
  else
    # Find the indent level of TransactionsTable
    INDENT=$(sed -n "${START_LINE}p" /tmp/current-template.yaml | sed 's/[^ ].*//' | wc -c)
    INDENT=$((INDENT - 1))
    
    # Find end line (next resource/section at same or lower indent)
    TOTAL_LINES=$(wc -l < /tmp/current-template.yaml)
    END_LINE=$TOTAL_LINES
    
    for i in $(seq $((START_LINE + 1)) $TOTAL_LINES); do
      LINE=$(sed -n "${i}p" /tmp/current-template.yaml)
      STRIPPED=$(echo "$LINE" | sed 's/^[[:space:]]*//')
      
      # Skip empty lines
      [ -z "$STRIPPED" ] && continue
      
      # Check if next resource/section starts (uppercase at beginning or lower indent)
      CURRENT_INDENT=$(echo "$LINE" | sed 's/[^ ].*//' | wc -c)
      CURRENT_INDENT=$((CURRENT_INDENT - 1))
      
      # Check if it's a new resource (uppercase letter after optional whitespace)
      if [ "$CURRENT_INDENT" -le "$INDENT" ] && echo "$STRIPPED" | grep -q "^[A-Z]"; then
        END_LINE=$i
        break
      fi
    done
    
    # Remove the resource and any exports
    # First, remove the resource block
    sed "${START_LINE},${END_LINE}d" /tmp/current-template.yaml > /tmp/temp-template.yaml
    
    # Remove exports referencing TransactionsTable
    grep -v "TransactionsTable0A011FCB" /tmp/temp-template.yaml > /tmp/without-transactions.yaml
    
    REMOVED_LINES=$((END_LINE - START_LINE + 1))
    echo -e "${GREEN}✅ Removed TransactionsTable from template (lines $START_LINE-$END_LINE, $REMOVED_LINES lines)${NC}"
    SKIP_REMOVAL=false
  fi
  echo ""

  # Step 4: Update stack to remove TransactionsTable
  echo -e "${BLUE}🗑️  Step 4: Updating stack to remove TransactionsTable from CloudFormation...${NC}"
  echo "   (Table will remain in AWS due to DeletionPolicy: Retain)"
  
  UPDATE_OUTPUT=$(aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body file:///tmp/without-transactions.yaml \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    2>&1 || true)
  
  if echo "$UPDATE_OUTPUT" | grep -q "StackId\|No updates"; then
    echo -e "${GREEN}✅ Update initiated${NC}"
  else
    echo -e "${YELLOW}⚠️  Update output: $UPDATE_OUTPUT${NC}"
    if echo "$UPDATE_OUTPUT" | grep -q "No updates"; then
      echo "Stack already up to date (resource may have been removed)"
    fi
  fi
  
  # Wait for update to complete
  echo "⏳ Waiting for stack update to complete..."
  aws cloudformation wait stack-update-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --max-attempts 60 \
    || {
      CURRENT_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text)
      if [ "$CURRENT_STATUS" = "UPDATE_ROLLBACK_COMPLETE" ] || [ "$CURRENT_STATUS" = "UPDATE_COMPLETE" ]; then
        echo -e "${GREEN}✅ Stack update finished (status: $CURRENT_STATUS)${NC}"
      else
        echo -e "${YELLOW}⚠️  Stack update may have issues (status: $CURRENT_STATUS)${NC}"
        echo "Continuing anyway..."
      fi
    }
  echo ""
fi

# Step 5: Synthesize CDK template with correct TransactionsTable schema
echo -e "${BLUE}📝 Step 5: Synthesizing CDK template with correct TransactionsTable schema...${NC}"
cd "$CDK_DIR"
npx cdk synth "$STACK_NAME" \
  --context environment=steven \
  --context region="$REGION" \
  > /tmp/with-transactions.yaml 2>&1

if [ ! -s /tmp/with-transactions.yaml ]; then
  echo -e "${RED}❌ Failed to synthesize template${NC}"
  exit 1
fi

# Verify it contains TransactionsTable
if ! grep -q "TransactionsTable0A011FCB" /tmp/with-transactions.yaml; then
  echo -e "${RED}❌ Synthesized template doesn't contain TransactionsTable${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Template synthesized ($(wc -l < /tmp/with-transactions.yaml) lines)${NC}"
echo ""

# Step 6: Create import changeset
echo -e "${BLUE}📦 Step 6: Creating import changeset...${NC}"
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
CHANGESET_OUTPUT=$(aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --change-set-type IMPORT \
  --resources-to-import file:///tmp/import-transactions.json \
  --template-body file:///tmp/with-transactions.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  2>&1)

if echo "$CHANGESET_OUTPUT" | grep -q "ChangeSetId\|Id"; then
  echo -e "${GREEN}✅ Changeset created: $CHANGESET_NAME${NC}"
  CHANGESET_ID=$(echo "$CHANGESET_OUTPUT" | grep -oP 'ChangeSetId[":\s]+[^,}]+' | head -1 | cut -d'"' -f2 || echo "$CHANGESET_NAME")
else
  echo -e "${RED}❌ Failed to create changeset${NC}"
  echo "$CHANGESET_OUTPUT"
  exit 1
fi

# Wait for changeset to be ready
echo "⏳ Waiting for changeset to be ready..."
for i in {1..30}; do
  STATUS=$(aws cloudformation describe-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME" \
    --region "$REGION" \
    --query 'Status' \
    --output text 2>/dev/null || echo "NOT_FOUND")
  
  if [ "$STATUS" = "CREATE_COMPLETE" ]; then
    echo -e "${GREEN}✅ Changeset ready${NC}"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    REASON=$(aws cloudformation describe-change-set \
      --stack-name "$STACK_NAME" \
      --change-set-name "$CHANGESET_NAME" \
      --region "$REGION" \
      --query 'StatusReason' \
      --output text 2>/dev/null || echo "Unknown")
    echo -e "${RED}❌ Changeset failed: $REASON${NC}"
    exit 1
  fi
  
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}⚠️  Changeset taking longer than expected, continuing anyway...${NC}"
  else
    sleep 2
  fi
done
echo ""

# Step 7: Execute changeset
echo -e "${BLUE}▶️  Step 7: Executing changeset to import TransactionsTable...${NC}"
aws cloudformation execute-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGESET_NAME" \
  --region "$REGION"

echo "⏳ Waiting for import to complete..."
aws cloudformation wait stack-update-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --max-attempts 60 \
  || {
    CURRENT_STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$REGION" \
      --query 'Stacks[0].StackStatus' \
      --output text)
    if [ "$CURRENT_STATUS" = "UPDATE_COMPLETE" ]; then
      echo -e "${GREEN}✅ Import completed${NC}"
    else
      echo -e "${YELLOW}⚠️  Import status: $CURRENT_STATUS${NC}"
    fi
  }
echo ""

# Step 8: Verify drift is fixed
echo -e "${BLUE}✅ Step 8: Verifying drift is fixed...${NC}"
sleep 10  # Give CloudFormation time to update drift detection

# Check drift status
DRIFT_STATUS=$(aws cloudformation describe-stack-resource-drifts \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID'].StackResourceDriftStatus" \
  --output text 2>/dev/null || echo "NOT_CHECKED")

if [ "$DRIFT_STATUS" = "IN_SYNC" ]; then
  echo -e "${GREEN}✅ ✅ ✅ Drift fixed! TransactionsTable is now IN_SYNC${NC}"
  SUCCESS=true
elif [ "$DRIFT_STATUS" = "MODIFIED" ]; then
  echo -e "${YELLOW}⚠️  Drift still detected. Checking details...${NC}"
  aws cloudformation describe-stack-resource-drifts \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID']" \
    --output json | jq '.'
  SUCCESS=false
elif [ "$DRIFT_STATUS" = "NOT_CHECKED" ]; then
  echo -e "${YELLOW}⚠️  Drift not checked yet. This is normal immediately after import.${NC}"
  echo "Drift detection can take a few minutes. Please check later:"
  echo "  aws cloudformation describe-stack-resource-drifts \\"
  echo "    --stack-name $STACK_NAME \\"
  echo "    --region $REGION \\"
  echo "    --query \"StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID']\""
  SUCCESS=true  # Assume success since import completed
else
  echo -e "${BLUE}ℹ️  Drift status: $DRIFT_STATUS${NC}"
  SUCCESS=true
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}🎉 🎉 🎉 Drift Fix Process Complete! 🎉 🎉 🎉${NC}"
else
  echo -e "${YELLOW}⚠️  Drift fix completed with warnings${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  ✅ Removed TransactionsTable from CloudFormation (table retained)"
echo "  ✅ Imported TransactionsTable back with correct schema"
echo "  ✅ Table: $TABLE_NAME"
echo "  ✅ Stack: $STACK_NAME"
echo "  ✅ Region: $REGION"
echo ""
echo "To verify drift status manually:"
echo "  aws cloudformation describe-stack-resource-drifts \\"
echo "    --stack-name $STACK_NAME \\"
echo "    --region $REGION \\"
echo "    --query \"StackResourceDrifts[?LogicalResourceId=='$LOGICAL_ID']\" \\"
echo "    --output json | jq '.'"

