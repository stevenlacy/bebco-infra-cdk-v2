# Transactions Table Migration: JPL → STV

## Overview
Recreate the `bebco-borrower-transactions-stv` table to match the schema of `bebco-borrower-transactions-jpl` and migrate all ~190,109 transactions.

## Table Schema (matches jpl)

**Primary Key:**
- Partition Key: `account_id` (STRING)
- Sort Key: `posted_date_tx_id` (STRING)

**Global Secondary Indexes:**
1. **CompanyIndex**
   - Partition Key: `company_id` (STRING)
   - Sort Key: `posted_date_account_id` (STRING)
   - Projection: ALL

2. **LoanNumberIndex**
   - Partition Key: `loan_no` (NUMBER)
   - Sort Key: `date` (STRING)
   - Projection: ALL

3. **PlaidTxIndex**
   - Partition Key: `plaid_transaction_id` (STRING)
   - Projection: ALL

## Steps

### Step 1: Recreate the Table

The table needs to be deleted and recreated because primary keys cannot be changed.

```bash
cd bebco-infra-cdk-v2
./scripts/recreate-transactions-table-stv.sh
```

**Or manually:**

```bash
# Delete existing table (if it exists)
aws dynamodb delete-table \
  --table-name bebco-borrower-transactions-stv \
  --region us-east-2

# Wait for deletion
aws dynamodb wait table-not-exists \
  --table-name bebco-borrower-transactions-stv \
  --region us-east-2

# Deploy CDK to create new table with correct schema
cd bebco-infra-cdk-v2
npm run build
cdk deploy BebcoDataStack-stv --region us-east-2
```

### Step 2: Deploy Migration Lambda

```bash
cd bebco-infra-cdk-v2
npm run build
cdk deploy BebcoMigrationStack-stv --region us-east-2
```

### Step 3: Run Migration

The migration Lambda will copy data in batches. You can invoke it manually or run it multiple times to resume from last position.

**Single invocation (will process all items):**
```bash
aws lambda invoke \
  --function-name bebco-stv-migration-transactions \
  --region us-east-2 \
  --payload '{}' \
  /tmp/migration-response.json

cat /tmp/migration-response.json | jq '.'
```

**With pagination (resume from last position):**
```bash
# First run
aws lambda invoke \
  --function-name bebco-stv-migration-transactions \
  --region us-east-2 \
  --payload '{"max_items": 50000}' \
  /tmp/migration-response-1.json

# Get last_evaluated_key from response, then resume:
aws lambda invoke \
  --function-name bebco-stv-migration-transactions \
  --region us-east-2 \
  --payload '{"exclusive_start_key": {...}}' \
  /tmp/migration-response-2.json
```

### Step 4: Monitor Progress

```bash
# Watch Lambda logs
aws logs tail /aws/lambda/bebco-stv-migration-transactions \
  --region us-east-2 \
  --follow

# Check item count
aws dynamodb describe-table \
  --table-name bebco-borrower-transactions-stv \
  --region us-east-2 \
  --query 'Table.ItemCount' \
  --output text
```

### Step 5: Verify Migration

```bash
# Compare counts
JPL_COUNT=$(aws dynamodb describe-table \
  --table-name bebco-borrower-transactions-jpl \
  --region us-east-2 \
  --query 'Table.ItemCount' \
  --output text)

STV_COUNT=$(aws dynamodb describe-table \
  --table-name bebco-borrower-transactions-stv \
  --region us-east-2 \
  --query 'Table.ItemCount' \
  --output text)

echo "JPL: $JPL_COUNT items"
echo "STV: $STV_COUNT items"
```

## Expected Results

- Source (jpl): ~190,109 transactions
- Target (stv): Should match source count after migration
- Migration time: ~15-30 minutes depending on DynamoDB throttling

## Notes

- The migration script skips duplicate items if re-run
- Uses batch writes (25 items per batch) for efficiency
- Handles pagination automatically
- Can be interrupted and resumed using `exclusive_start_key`

## Files Modified

1. **CDK Stack:** `lib/stacks/data-stack.ts` - Updated transactions table schema
2. **CDK Stack:** `lib/stacks/domains/migration-stack.ts` - New migration Lambda
3. **Lambda Code:** `scripts/migrate-transactions-jpl-to-stv.py` - Migration script
4. **Lambda Code:** `AdminPortal/lambda-functions/account-transaction-counts/app.py` - Updated to use primary key query


