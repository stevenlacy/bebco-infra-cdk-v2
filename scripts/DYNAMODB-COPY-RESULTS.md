# DynamoDB Table Copy Results

**Date:** October 26, 2025  
**Duration:** 6 minutes 24 seconds  
**Region:** us-east-2

## Summary

Successfully copied data from `-dev` tables to both `-jpl` and `-din` tables in DynamoDB.

### Statistics

- **Total Tables Processed:** 33 source tables
- **Successfully Completed:** 30 tables (including empty tables)
- **Failed Tables:** 3 tables (schema mismatch issues)
- **Total Items Copied:** 73,898 items
- **Total Time:** 6m 24s

## Successful Tables

The following tables were successfully copied to both `-jpl` and `-din` variants:

1. ✅ **bebco-borrower-accounts-dev** - 319 items
2. ✅ **bebco-borrower-ach-batches-dev** - 26 items
3. ✅ **bebco-borrower-annual-reportings-dev** - 56 items
4. ⚠️ **bebco-borrower-approvals-dev** - Empty (skipped)
5. ⚠️ **bebco-borrower-borrower-value-config-settings-dev** - Empty (skipped)
6. ⚠️ **bebco-borrower-case-counsel-relationships-dev** - Empty (skipped)
7. ⚠️ **bebco-borrower-case-financials-current-dev** - Empty (skipped)
8. ⚠️ **bebco-borrower-case-underwritings-dev** - Empty (skipped)
9. ⚠️ **bebco-borrower-cases-dev** - Empty (skipped)
10. ✅ **bebco-borrower-companies-dev** - 134 items
11. ⚠️ **bebco-borrower-discount-rate-matrix-dev** - Empty (skipped)
12. ⚠️ **bebco-borrower-docket-review-case-details-dev** - Empty (skipped)
13. ⚠️ **bebco-borrower-expenses-dev** - Empty (skipped)
14. ✅ **bebco-borrower-files-dev** - 77 items
15. ⚠️ **bebco-borrower-invoices-dev** - Empty (skipped)
16. ⚠️ **bebco-borrower-ledger-entries-dev** - Empty (skipped)
17. ⚠️ **bebco-borrower-lines-of-credit-dev** - Empty (skipped)
18. ✅ **bebco-borrower-loans-dev** - 22,959 items (largest table!)
19. ⚠️ **bebco-borrower-mass-tort-general-dev** - Empty (skipped)
20. ⚠️ **bebco-borrower-mass-tort-plaintiffs-dev** - Empty (skipped)
21. ✅ **bebco-borrower-monthly-reportings-dev** - 3,499 items
22. ⚠️ **bebco-borrower-notifications-dev** - Empty (skipped)
23. ⚠️ **bebco-borrower-otp-codes-dev** - Empty (skipped)
24. ✅ **bebco-borrower-payments-dev** - 2,267 items
25. ✅ **bebco-borrower-plaid-items-dev** - 79 items
26. ⚠️ **bebco-borrower-settlement-success-tracking-dev** - Empty (skipped)
27. ✅ **bebco-borrower-statements-dev** - 7,216 items
28. ✅ **bebco-borrower-users-dev** - 317 items
29. ⚠️ **bebco-borrower-valuations-summary-dev** - Empty (skipped)
30. ⚠️ **bebco-borrower-variance-tracking-dev** - Empty (skipped)

## Failed Tables (Schema Mismatch)

The following tables failed due to schema differences between `-dev` and `-jpl`/`-din` tables:

### 1. ❌ bebco-borrower-banks-dev
- **Issue:** Schema mismatch
- **Dev Schema:** PK (HASH) + SK (RANGE)
- **Target Schema:** id (HASH only)
- **Items:** 9 items not copied
- **Status:** The target tables have a different key structure

### 2. ❌ bebco-borrower-transactions-dev
- **Issue:** Schema mismatch
- **Dev Schema:** account_id (HASH) + posted_date_tx_id (RANGE)
- **Target Schema:** id (HASH only)
- **Items:** ~190,109 items not copied
- **Partial Success:** 1,267 items copied before error, 52 items failed
- **Status:** This is the largest failed table with significant data

### 3. ⚠️ bebco-borrower-loan-loc-dev
- **Status:** Mostly successful but had 1 failed item per target
- **Items:** 2,566 items copied to each target (jpl/din)
- **Failed:** 1 item per target (likely schema-related)

## Resolution Required

The three tables with schema mismatches need manual intervention:

1. **Option A - Update Target Schemas:**
   - Recreate `-jpl` and `-din` tables with matching schemas from `-dev`
   - Rerun the copy script for these specific tables

2. **Option B - Transform Data:**
   - Create a custom migration script that transforms the data to match the new schema
   - Map composite keys (PK/SK or account_id/posted_date_tx_id) to single `id` field

3. **Option C - Keep Current State:**
   - If the schema change is intentional and the new environments don't need this data
   - Document the decision and mark as complete

## Log Files

All detailed logs are available at:
- **Summary:** `dynamodb-copy-logs/summary_20251026_162858.json`
- **Detailed Log:** `dynamodb-copy-logs/copy_log_20251026_162858.jsonl`
- **Checkpoint:** `dynamodb-copy-logs/checkpoint.json`

## Resumption Support

The script automatically saves checkpoints after each table. If interrupted, simply run the script again and it will resume from where it left off.

## Script Location

`/Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2/scripts/copy-dynamodb-tables.py`

### Usage Examples

```bash
# Dry run to preview
./copy-dynamodb-tables.py --dry-run

# Full copy operation
./copy-dynamodb-tables.py

# Resume from checkpoint (automatic)
./copy-dynamodb-tables.py

# Custom log directory
./copy-dynamodb-tables.py --log-dir /path/to/logs
```

## Next Steps

1. ✅ **Completed:** 73,898 items successfully copied across 30 tables
2. 🔧 **Pending:** Resolve schema mismatch for 3 tables:
   - bebco-borrower-banks-dev (9 items)
   - bebco-borrower-transactions-dev (~190K items)
   - bebco-borrower-loan-loc-dev (1 item per target)

3. 📋 **Decision Needed:** Choose resolution approach (A, B, or C above)

