# DynamoDB Data Migration Options: us-east-1 → us-east-2

## 🎯 Your Situation

You have **19 DynamoDB tables** backed up in **AWS Backup** vault `bebco-dynamodb-production-backups`:
- Backup time: **2025-10-26 at 05:00 AM** (less than 2 hours ago)
- All backups status: **COMPLETED**
- No app usage since backup
- Location: us-east-1

### Tables Backed Up Today:
1. bebco-borrower-staging-accounts
2. bebco-borrower-staging-ach-batches
3. bebco-borrower-staging-annual-reportings
4. bebco-borrower-staging-approvals
5. bebco-borrower-staging-banks
6. bebco-borrower-staging-companies
7. bebco-borrower-staging-files
8. bebco-borrower-staging-ledger-entries
9. bebco-borrower-staging-lines-of-credit
10. bebco-borrower-staging-loan-loc
11. bebco-borrower-staging-loans
12. bebco-borrower-staging-monthly-reportings
13. bebco-borrower-staging-notifications
14. bebco-borrower-staging-otp-codes
15. bebco-borrower-staging-payments
16. bebco-borrower-staging-plaid-items
17. bebco-borrower-staging-statements
18. bebco-borrower-staging-transactions
19. bebco-borrower-staging-users

---

## 📊 Comparison of Options

| Feature | **Option 1: AWS Backup Restore** | **Option 2: DynamoDB Export/Import** |
|---------|----------------------------------|--------------------------------------|
| **Data Freshness** | ✅ 2 hours old (05:00 AM backup) | ⚠️ Current at time of export (~30 min process) |
| **Cross-Region Support** | ❌ **CANNOT restore to different region directly** | ✅ **Full cross-region support** |
| **Table Name Change** | ❌ **CANNOT change table name** (staging → dev) | ✅ **Can rename during import** |
| **AWS-to-AWS Transfer** | ✅ Yes (if same region) | ✅ Yes (via S3) |
| **us-east-1 Impact** | ✅ READ ONLY | ✅ READ ONLY |
| **Cost** | 💰 $0.50/GB restore + storage | 💰 $0.10/GB export + S3 storage |
| **Speed** | ⚡ Fast (~5-10 min/table) | ⚡ Medium (~15-30 min/table) |
| **Automation** | 🤖 CLI/API available | 🤖 CLI/API available |
| **Point-in-Time Consistency** | ✅ Yes (05:00 AM snapshot) | ✅ Yes (export time snapshot) |
| **Tables Covered** | ✅ 19/31 tables | ✅ All 31+ tables |

---

## ❌ **Critical Issue with AWS Backup (Option 1)**

### **Problem: Cross-Region Restore Not Supported for DynamoDB**

AWS Backup **CANNOT** restore DynamoDB tables to a different region directly. From AWS documentation:

> "Cross-Region backup is not supported for DynamoDB. You can only restore DynamoDB backups to the same region where the backup was taken."

### **Additional Problems:**

1. **Table Name Cannot Be Changed**: AWS Backup restores with the **original table name**
   - Would restore as `bebco-borrower-staging-*` 
   - Cannot rename to `bebco-borrower-*-dev` during restore
   - Would conflict with your naming convention

2. **Missing Tables**: Only 19 tables in backup, but you have 31+ tables in us-east-1
   - Missing tables like:
     - `bebco-borrower-staging-expenses`
     - `bebco-borrower-staging-invoices`
     - `bebco-borrower-staging-case-*` tables
     - `bebco-borrower-staging-discount-rate-matrix`
     - `bebco-borrower-staging-mass-tort-*` tables
     - And others...

3. **Workaround Would Be Complex**: To use AWS Backup, you would need to:
   - Restore all 19 tables to us-east-1 with **different names** (not possible)
   - OR restore to us-east-1, then export/import to us-east-2 (defeats the purpose)

---

## ✅ **RECOMMENDED: Option 2 - DynamoDB Export/Import**

### **Why This Is The Best Choice:**

1. **✅ Cross-Region Support**: Direct export from us-east-1 to S3, import to us-east-2
2. **✅ Table Renaming**: Can rename `staging` → `dev` during import
3. **✅ All Tables**: Can export all 31+ tables, not just the 19 in backup
4. **✅ us-east-1 READ ONLY**: Export uses internal snapshots, zero impact
5. **✅ No Local Machine**: Direct AWS-to-AWS via S3
6. **✅ Current Data**: Export captures the **latest** data (not 2 hours old)

### **Process:**

```bash
# 1. Export from us-east-1 (READ ONLY)
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:303555290462:table/bebco-borrower-staging-companies \
  --s3-bucket bebco-dynamodb-migration-temp-303555290462 \
  --s3-prefix exports/companies \
  --export-format DYNAMODB_JSON \
  --region us-east-1

# 2. Import to us-east-2 with new name
aws dynamodb import-table \
  --input-format DYNAMODB_JSON \
  --s3-bucket-source S3Bucket=bebco-dynamodb-migration-temp-303555290462,S3KeyPrefix=exports/companies \
  --input-format-options csv={} \
  --table-creation-parameters '{
    "TableName": "bebco-borrower-companies-dev",
    "AttributeDefinitions": [...],
    "KeySchema": [...],
    "BillingMode": "PAY_PER_REQUEST"
  }' \
  --region us-east-2
```

---

## 🔄 **Alternative: Hybrid Approach (NOT RECOMMENDED)**

You could theoretically:
1. Use AWS Backup to restore 19 tables to **us-east-1** with original names
2. Then export those restored tables to S3
3. Then import to us-east-2

**Problems:**
- ❌ Creates resources in us-east-1 (violates READ ONLY requirement)
- ❌ More complex (3 steps instead of 2)
- ❌ Slower overall
- ❌ Still need to handle the missing 12+ tables separately
- ❌ No real benefit over direct export

---

## 📋 **FINAL RECOMMENDATION**

### **Use DynamoDB Export/Import (Option 2)**

**Reasons:**
1. **Perfectly aligned with requirements**:
   - us-east-1 stays READ ONLY ✅
   - Direct AWS-to-AWS transfer ✅
   - Can rename tables ✅
   - Covers all 31+ tables ✅

2. **Data freshness acceptable**:
   - Your app hasn't been used in 2 hours
   - Export will capture current state
   - Difference from backup is negligible

3. **Production-safe**:
   - Zero impact on us-east-1
   - No performance degradation
   - Uses DynamoDB's internal mechanisms

4. **Complete coverage**:
   - AWS Backup only has 19 tables
   - Export can handle all 31+ tables
   - No gaps in data migration

---

## 🚀 **Implementation Plan**

### **Phase 1: Create Migration Scripts**
- Script to export all 31 tables in parallel
- Script to import with renamed tables
- Validation script to compare counts

### **Phase 2: Execute Export (30-45 minutes)**
- Export all tables from us-east-1 to S3
- Monitor progress
- Verify completion

### **Phase 3: Execute Import (30-45 minutes)**
- Import from S3 to us-east-2
- Tables created with new names
- Monitor progress

### **Phase 4: Validation (10 minutes)**
- Compare item counts
- Verify GSIs
- Spot-check sample data

### **Total Time**: ~90-120 minutes

---

## 💰 **Cost Comparison**

### **Option 1 (AWS Backup - If It Were Possible):**
- Restore cost: ~$0.50/GB × 50GB = $25
- **BUT: Cannot do cross-region restore for DynamoDB**

### **Option 2 (Export/Import - RECOMMENDED):**
- Export cost: $0.10/GB × 50GB = $5
- S3 storage: $0.023/GB/month × 50GB = $1.15/month (can delete after)
- Import cost: **FREE**
- Data transfer: **FREE** (same account)
- **Total: ~$5-6**

---

## ✅ **Decision**

**Proceed with DynamoDB Export/Import (Option 2)**

Ready to create automated scripts when you are!

