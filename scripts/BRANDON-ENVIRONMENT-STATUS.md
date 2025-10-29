# Brandon Environment Setup - Status

**Environment Suffix:** `bdn`  
**Started:** October 28, 2025 at 23:18:30 UTC  
**Status:** ✅ **RUNNING** - Background jobs copying data

---

## Executive Summary

Successfully created all 33 DynamoDB tables for Brandon's environment with correct schemas, including:
- ✅ **Banks tables** with composite keys (PK + SK) and 2 GSIs
- ✅ **Transactions tables** with composite keys (account_id + posted_date_tx_id) and 2 GSIs
- ✅ All other tables with their respective schemas and indexes

Background copy jobs are now running to populate the tables with data from `-dev`.

---

## Phase 1: Table Creation ✅ COMPLETE

| Status | Count |
|--------|-------|
| **Tables Created** | 33/33 |
| **Failed** | 0 |
| **All Active** | ✅ Yes |

### Special Tables with Complex Schemas

#### 1. Banks Tables (`bebco-borrower-banks-bdn`)
- ✅ Primary Key: `PK` (HASH) + `SK` (RANGE)
- ✅ GSI1: `GSI1PK` + `GSI1SK`
- ✅ ShortNameIndex: `short_name`
- ✅ Streams: Enabled (NEW_AND_OLD_IMAGES)

#### 2. Transactions Tables (`bebco-borrower-transactions-bdn`)
- ✅ Primary Key: `account_id` (HASH) + `posted_date_tx_id` (RANGE)
- ✅ CompanyIndex: `company_id` + `posted_date_account_id`
- ✅ PlaidTxIndex: `plaid_transaction_id`
- ✅ Streams: Enabled (NEW_AND_OLD_IMAGES)

---

## Phase 2: Data Copy 🔄 IN PROGRESS

### Current Progress

| Status | Count | Items Copied |
|--------|-------|--------------|
| ✅ **Completed** | 29 tables | ~10,390 items |
| ⏳ **Running** | 4 tables | ~7,908 items (in progress) |
| ❌ **Failed** | 0 | - |

### Jobs Still Running

| Table | Progress | Items | ETA |
|-------|----------|-------|-----|
| **loans** | 9.5% | 2,170 / 22,959 | ~15 min |
| **monthly-reportings** | 55.4% | 1,940 / 3,499 | ~3 min |
| **statements** | 34.4% | 2,479 / 7,216 | ~8 min |
| **transactions** | 0.7% | 1,319 / 190,109 | ~25 min |

### Completed Tables (29)

Small & Medium tables already done:
- accounts: 319 items ✅
- ach-batches: 26 items ✅
- annual-reportings: 56 items ✅
- banks: 9 items ✅
- companies: 134 items ✅
- files: 77 items ✅
- loan-loc: 2,567 items ✅
- payments: 2,267 items ✅
- plaid-items: 79 items ✅
- users: 317 items ✅
- Plus 19 empty tables ✅

---

## Monitoring & Management

### Check Status Anytime
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2/scripts
./check-brandon-status.sh
```

### Live Monitoring (Auto-refresh every 5 seconds)
```bash
watch -n 5 ./check-brandon-status.sh
```

### View Real-Time Logs
```bash
# All jobs
tail -f brandon-setup-logs/copy-jobs/*.log

# Specific large tables
tail -f brandon-setup-logs/copy-jobs/bebco-borrower-transactions-dev-to-bebco-borrower-transactions-bdn.log
tail -f brandon-setup-logs/copy-jobs/bebco-borrower-loans-dev-to-bebco-borrower-loans-bdn.log
```

### Check Individual Table Status
```bash
# See process status
ps aux | grep 'copy-single-table.py.*bdn'

# Check specific table count in AWS
aws dynamodb describe-table --table-name bebco-borrower-transactions-bdn --region us-east-2 --query 'Table.ItemCount'
```

### Stop Jobs (if needed)
```bash
pkill -f 'copy-single-table.py.*bdn'
```

---

## Background Job Details

All copy jobs are running with `nohup`, which means:
- ✅ Jobs continue even if you close the terminal
- ✅ Jobs persist across disconnections
- ✅ Each job updates its status file in real-time
- ✅ Jobs can be monitored independently

### Job Tracking Files

**Main Status:**
```bash
cat brandon-setup-logs/setup-status.json | jq
```

**Individual Job Status:**
```bash
ls brandon-setup-logs/copy-jobs/*.status.json
cat brandon-setup-logs/copy-jobs/[job-name].status.json | jq
```

**Process IDs:**
```bash
cat brandon-setup-logs/copy-jobs/[job-name].pid
```

---

## Expected Completion

### Timeline
- ⏱️ **Small tables:** Completed (5 minutes)
- ⏱️ **Medium tables:** ~10 minutes remaining
- ⏱️ **Large tables:** 
  - loans: ~15 minutes remaining
  - transactions: ~25 minutes remaining

### Total Expected Time
**~25-30 minutes** from start (complete by ~23:45-23:50 UTC)

---

## Verification Commands

### Quick Count Check
```bash
# Check all -bdn tables
aws dynamodb list-tables --region us-east-2 --output json | jq -r '.TableNames[] | select(endswith("-bdn"))'

# Count items in key tables
aws dynamodb describe-table --table-name bebco-borrower-banks-bdn --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
aws dynamodb describe-table --table-name bebco-borrower-transactions-bdn --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
aws dynamodb describe-table --table-name bebco-borrower-loans-bdn --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}'
```

### Full Environment Report
```bash
# Update the count script to include bdn
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2/scripts
python3 get-all-table-counts.py
```

---

## Expected Final State

When complete, Brandon's environment will have:

| Table | Expected Items | Source |
|-------|---------------|--------|
| accounts | 319 | dev |
| ach-batches | 26 | dev |
| annual-reportings | 56 | dev |
| banks | 9 | dev |
| companies | 134 | dev |
| files | 77 | dev |
| loan-loc | 2,567 | dev |
| loans | 22,959 | dev |
| monthly-reportings | 3,499 | dev |
| payments | 2,267 | dev |
| plaid-items | 79 | dev |
| statements | 7,216 | dev |
| transactions | 190,109 | dev |
| users | 317 | dev |
| + 19 empty tables | 0 | dev |

**Total:** ~229,634 items

---

## Next Steps

### When Complete (Check with status script)
1. ✅ Verify all jobs show "COMPLETED"
2. ✅ Run full table count report
3. ✅ Update Brandon's CDK config if needed
4. ✅ Test application access to `-bdn` tables
5. ✅ Deploy Brandon's environment stack

### If Any Issues
1. Check logs in `brandon-setup-logs/copy-jobs/`
2. Review individual status files
3. Re-run specific copy jobs if needed:
   ```bash
   python3 copy-single-table.py --source [source] --target [target] --region us-east-2
   ```

---

## Summary

✅ **All tables created with correct schemas**  
🔄 **Background copy jobs running autonomously**  
⏱️ **Estimated completion: 25-30 minutes**  
📊 **Monitor anytime with `./check-brandon-status.sh`**  

Brandon's environment is being set up automatically! 🎉


