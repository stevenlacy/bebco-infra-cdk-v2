# DynamoDB Table Recreation & Copy Status

**Date:** October 27, 2025  
**Status:** ✅ IN PROGRESS - Background jobs running

## Summary

Successfully recreated tables with correct schemas and started background copy jobs.

## What Was Done

### 1. Deleted Incorrectly Structured Tables ✅
- `bebco-borrower-banks-jpl` (had wrong schema: single `id` key)
- `bebco-borrower-banks-din` (had wrong schema: single `id` key)
- `bebco-borrower-transactions-jpl` (had wrong schema: single `id` key)
- `bebco-borrower-transactions-din` (had wrong schema: single `id` key)

### 2. Recreated Tables with Correct Schemas ✅

#### Banks Tables
**Schema:**
- Primary Key: `PK` (HASH) + `SK` (RANGE)
- GSI1: `GSI1PK` (HASH) + `GSI1SK` (RANGE)
- ShortNameIndex: `short_name` (HASH)
- Billing: PAY_PER_REQUEST
- Streams: Enabled (NEW_AND_OLD_IMAGES)

**Tables Created:**
- ✅ `bebco-borrower-banks-jpl`
- ✅ `bebco-borrower-banks-din`

#### Transactions Tables
**Schema:**
- Primary Key: `account_id` (HASH) + `posted_date_tx_id` (RANGE)
- CompanyIndex: `company_id` (HASH) + `posted_date_account_id` (RANGE)
- PlaidTxIndex: `plaid_transaction_id` (HASH)
- Billing: PAY_PER_REQUEST
- Streams: Enabled (NEW_AND_OLD_IMAGES)

**Tables Created:**
- ✅ `bebco-borrower-transactions-jpl`
- ✅ `bebco-borrower-transactions-din`

### 3. Started Background Copy Jobs ✅

Four background processes are now running to copy data:

| Job | Source | Target | Status | PID |
|-----|--------|--------|--------|-----|
| 1 | bebco-borrower-banks-dev | bebco-borrower-banks-jpl | ✅ COMPLETED | 32585 |
| 2 | bebco-borrower-banks-dev | bebco-borrower-banks-din | ✅ COMPLETED | 32589 |
| 3 | bebco-borrower-transactions-dev | bebco-borrower-transactions-jpl | 🔄 RUNNING | 32593 |
| 4 | bebco-borrower-transactions-dev | bebco-borrower-transactions-din | 🔄 RUNNING | 32597 |

**Banks Tables:** ✅ COMPLETE - 9 items copied to each table

**Transactions Tables:** 🔄 IN PROGRESS
- Source has ~190,109 items
- Estimated completion: 15-20 minutes
- Jobs are running in background with nohup (persist even if you close terminal)

## How to Monitor Progress

### Check Status
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2/scripts
./check-copy-status.sh
```

### Live Monitoring (Auto-refresh every 5 seconds)
```bash
watch -n 5 ./check-copy-status.sh
```

### View Logs in Real-Time
```bash
# All logs
tail -f copy-job-logs/*.log

# Specific job
tail -f copy-job-logs/bebco-borrower-transactions-dev-to-bebco-borrower-transactions-jpl.log
```

### Check Process Status
```bash
# See if jobs are still running
ps aux | grep copy-single-table.py
```

### Stop Jobs (if needed)
```bash
pkill -f copy-single-table.py
```

## Log Files

All logs are stored in:
```
/Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2/scripts/copy-job-logs/
```

**Log Files:**
- `bebco-borrower-banks-dev-to-bebco-borrower-banks-jpl.log`
- `bebco-borrower-banks-dev-to-bebco-borrower-banks-din.log`
- `bebco-borrower-transactions-dev-to-bebco-borrower-transactions-jpl.log`
- `bebco-borrower-transactions-dev-to-bebco-borrower-transactions-din.log`

**Status Files (JSON):**
- `*.status.json` files contain real-time progress in JSON format

## AWS CLI Commands to Check Tables

### Check Table Schemas
```bash
# Banks JPL
aws dynamodb describe-table --table-name bebco-borrower-banks-jpl --region us-east-2 --query 'Table.KeySchema'

# Transactions JPL
aws dynamodb describe-table --table-name bebco-borrower-transactions-jpl --region us-east-2 --query 'Table.KeySchema'
```

### Check Item Counts
```bash
# All target tables
aws dynamodb describe-table --table-name bebco-borrower-banks-jpl --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
aws dynamodb describe-table --table-name bebco-borrower-banks-din --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
aws dynamodb describe-table --table-name bebco-borrower-transactions-jpl --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
aws dynamodb describe-table --table-name bebco-borrower-transactions-din --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
```

## Expected Final Results

When complete, you should have:

| Table | Expected Items | Status |
|-------|---------------|--------|
| bebco-borrower-banks-jpl | 9 | ✅ COMPLETE |
| bebco-borrower-banks-din | 9 | ✅ COMPLETE |
| bebco-borrower-transactions-jpl | ~190,109 | 🔄 IN PROGRESS |
| bebco-borrower-transactions-din | ~190,109 | 🔄 IN PROGRESS |

## Notes

1. **Background Jobs:** The copy jobs are running with `nohup` so they will continue even if you close your terminal or disconnect.

2. **Resume Support:** If a job fails, you can restart it by running:
   ```bash
   ./start-table-copy-jobs.sh
   ```
   The script will only start jobs that haven't completed yet.

3. **Throttling Protection:** Each job includes a small delay (0.1s) between batches to avoid DynamoDB throttling.

4. **Batch Size:** Using DynamoDB batch_writer with automatic batching (up to 25 items per batch).

5. **Process Isolation:** Each copy job runs as a separate Python process, so they run in parallel.

## Troubleshooting

### If a job fails:
1. Check the log file: `cat copy-job-logs/[job-name].log`
2. Check the status file: `cat copy-job-logs/[job-name].status.json | jq`
3. Restart the specific job by manually running:
   ```bash
   python3 copy-single-table.py --source [SOURCE] --target [TARGET] --region us-east-2
   ```

### To verify schema matches:
```bash
# Compare source and target key schemas
aws dynamodb describe-table --table-name bebco-borrower-banks-dev --region us-east-2 --query 'Table.KeySchema'
aws dynamodb describe-table --table-name bebco-borrower-banks-jpl --region us-east-2 --query 'Table.KeySchema'
```

## Next Steps

1. ⏳ **Wait for completion** - Transactions tables will take ~15-20 minutes
2. ✅ **Verify data** - Run `./check-copy-status.sh` to confirm all items copied
3. ✅ **Test applications** - Verify jpl/din environments can access the data
4. 📋 **Update original results doc** - Mark these tables as complete in `DYNAMODB-COPY-RESULTS.md`

