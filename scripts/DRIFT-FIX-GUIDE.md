# CloudFormation Drift Fix Guide for TransactionsTable

## Current Status
- ✅ CDK definition is CORRECT (matches actual table schema)
- ⚠️  CloudFormation has drift (expects old schema: `id` PK instead of `account_id`+`posted_date_tx_id`)

## The Problem
CloudFormation wants to replace the table (change primary key + GSIs), but DynamoDB only allows one GSI operation at a time.

## Solution: Remove and Re-import

### Automated Script
Run: `./scripts/fix-drift-final.sh`

### Manual Steps (Most Reliable)

1. **Remove TransactionsTable from CloudFormation:**
   ```bash
   # Get current template
   aws cloudformation get-template \
     --stack-name BebcoDataStack-stv \
     --region us-east-2 \
     --template-stage Original \
     --query 'TemplateBody' \
     --output text > template.yaml
   
   # Edit template.yaml: Remove TransactionsTable0A011FCB resource
   # (Table stays in AWS due to DeletionPolicy: Retain)
   
   # Update stack
   aws cloudformation update-stack \
     --stack-name BebcoDataStack-stv \
     --template-body file://template.yaml \
     --region us-east-2 \
     --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
   ```

2. **Import TransactionsTable back:**
   ```bash
   # Synthesize CDK template
   npx cdk synth BebcoDataStack-stv \
     --context environment=steven \
     --context region=us-east-2 > template-with-transactions.yaml
   
   # Create import changeset
   aws cloudformation create-change-set \
     --stack-name BebcoDataStack-stv \
     --change-set-name import-transactions \
     --change-set-type IMPORT \
     --resources-to-import file://import-transactions.json \
     --template-body file://template-with-transactions.yaml \
     --region us-east-2 \
     --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
   
   # Execute changeset
   aws cloudformation execute-change-set \
     --stack-name BebcoDataStack-stv \
     --change-set-name import-transactions \
     --region us-east-2
   ```

## Verification
```bash
aws cloudformation describe-stack-resource-drifts \
  --stack-name BebcoDataStack-stv \
  --region us-east-2 \
  --query "StackResourceDrifts[?LogicalResourceId=='TransactionsTable0A011FCB']"
```

Expected: `StackResourceDriftStatus: IN_SYNC`
