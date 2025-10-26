# Bebco Infrastructure CDK v2 - Deployment Guide

**Ready to Deploy:** Foundation Stacks + PlaidStack (9 Lambda functions)  
**Target Region:** us-east-2  
**Environment:** dev

---

## 🎯 Current Status

### ✅ Ready for Deployment

| Stack | Resources | Status |
|---|---|---|
| **BebcoAuthStack** | Cognito User Pool + Identity Pool | ✅ Ready |
| **BebcoStorageStack** | 4 S3 buckets | ✅ Ready |
| **BebcoDataStack** | 31 DynamoDB tables | ✅ Ready |
| **BebcoPlaidStack** | 9 Plaid Lambda functions | ✅ Ready |

**Total Resources Ready:**
- 1 Cognito User Pool
- 1 Cognito Identity Pool  
- 4 S3 buckets
- 31 DynamoDB tables
- 9 Lambda functions (Plaid integration)

---

## 📋 Pre-Deployment Checklist

### 1. Verify All Prerequisites

```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2

# Check Lambda packages downloaded
echo "Lambda packages: $(ls dist/lambda-packages/*.zip | wc -l) / 130"

# Check Lambda layers in us-east-2
aws lambda list-layer-versions --layer-name bebco-docusign-layer --region us-east-2
aws lambda list-layer-versions --layer-name bebco-python-deps --region us-east-2

# Verify CDK synth works
npx cdk synth --context environment=dev --context region=us-east-2 --all
```

### 2. Review Configuration

**Environment:** `config/environments/dev-us-east-2.json`
- Region: us-east-2
- Account: 303555290462
- Environment suffix: dev

**Resource Names Preview:**
- Tables: `bebco-borrower-<name>-dev`
- Lambda: `bebco-dev-<domain>-<action>`
- S3: `bebco-<purpose>-dev-us-east-2-303555290462`

---

## 🚀 Deployment Steps

### Step 1: Bootstrap CDK (First Time Only)

```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2

# Bootstrap CDK in us-east-2
npx cdk bootstrap aws://303555290462/us-east-2
```

This creates:
- CDK staging bucket
- CDK execution roles
- Required IAM policies

### Step 2: Deploy Foundation Stacks

**Deploy Auth Stack (Cognito):**
```bash
npx cdk deploy BebcoAuthStack \
  --context environment=dev \
  --context region=us-east-2 \
  --require-approval never
```

**Expected Outputs:**
- User Pool ID: `us-east-2_<ID>`
- User Pool Client ID: `<CLIENT_ID>`
- Identity Pool ID: `us-east-2:<IDENTITY_ID>`

**Deploy Storage Stack (S3):**
```bash
npx cdk deploy BebcoStorageStack \
  --context environment=dev \
  --context region=us-east-2 \
  --require-approval never
```

**Expected Resources:**
- `bebco-borrower-documents-dev-us-east-2-303555290462`
- `bebco-borrower-statements-dev-us-east-2-303555290462`
- `bebco-change-tracking-dev-us-east-2-303555290462`
- `bebco-lambda-deployments-dev-us-east-2-303555290462`

**Deploy Data Stack (DynamoDB):**
```bash
npx cdk deploy BebcoDataStack \
  --context environment=dev \
  --context region=us-east-2 \
  --require-approval never
```

**Expected Resources:**
- 31 DynamoDB tables with names like `bebco-borrower-accounts-dev`
- All tables with PAY_PER_REQUEST billing
- Point-in-time recovery enabled
- DynamoDB streams enabled

**Estimated Time:** 5-10 minutes for all 3 stacks

### Step 3: Deploy PlaidStack (Lambda Functions)

```bash
npx cdk deploy BebcoPlaidStack \
  --context environment=dev \
  --context region=us-east-2
```

**Expected Resources:**
- `bebco-dev-plaid-link-token-create`
- `bebco-dev-plaid-token-exchange`
- `bebco-dev-plaid-accounts-preview`
- `bebco-dev-create-account-from-plaid`
- `bebco-dev-plaid-transactions-sync`
- `bebco-dev-plaid-sync-manual`
- `bebco-dev-plaid-webhook-handler`
- `bebco-dev-plaid-account-transactions`
- `bebco-dev-plaid-item-webhook-bulk-update`

**Estimated Time:** 3-5 minutes

### Step 4: Verify Deployment

```bash
# List all Lambda functions in us-east-2
aws lambda list-functions --region us-east-2 \
  --query 'Functions[?starts_with(FunctionName, `bebco-dev`)].FunctionName' \
  --output table

# List all DynamoDB tables in us-east-2  
aws dynamodb list-tables --region us-east-2 \
  --output json | jq '.TableNames | map(select(contains("bebco-borrower") and endswith("-dev")))'

# List S3 buckets
aws s3 ls | grep bebco.*dev.*us-east-2

# Check Cognito User Pool
aws cognito-idp list-user-pools --max-results 10 --region us-east-2
```

---

## 🔧 Troubleshooting

### Issue: CDK Bootstrap Fails

**Error:** "Bucket already exists"

**Solution:**
```bash
# Check if already bootstrapped
aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region us-east-2

# If it exists, skip bootstrap step
```

### Issue: Lambda Package Not Found

**Error:** `Lambda package not found: dist/lambda-packages/bebco-staging-X.zip`

**Solution:**
```bash
# Check if packages downloaded
ls -l dist/lambda-packages/*.zip | wc -l

# If not 130, re-run download
./scripts/download-lambda-packages-parallel.sh
```

### Issue: Layer Not Found

**Error:** `Layer arn:aws:lambda:us-east-2:...:layer:bebco-python-deps:1 does not exist`

**Solution:**
```bash
# Replicate layers again
./scripts/replicate-lambda-layers.sh
```

### Issue: Table Already Exists

**Error:** `Table bebco-borrower-accounts-dev already exists`

**Solution:**
This means you've already deployed. Either:
1. Skip deployment of DataStack
2. Delete existing tables first (⚠️ data loss!)
3. Update CDK to use `removalPolicy: RETAIN` (already set)

---

## 📊 Post-Deployment Validation

### 1. Test Lambda Functions

```bash
# Invoke a Lambda function
aws lambda invoke \
  --function-name bebco-dev-plaid-link-token-create \
  --payload '{"test": "true"}' \
  --region us-east-2 \
  response.json

cat response.json
```

### 2. Test DynamoDB Access

```bash
# Scan a table (check if accessible)
aws dynamodb scan \
  --table-name bebco-borrower-companies-dev \
  --limit 1 \
  --region us-east-2
```

### 3. Test S3 Access

```bash
# List bucket contents
aws s3 ls s3://bebco-borrower-documents-dev-us-east-2-303555290462/
```

### 4. Test Cognito

```bash
# List users in pool (should be empty initially)
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region us-east-2 \
  --query 'UserPools[?Name==`bebco-borrower-portal-dev`].Id' \
  --output text)

aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --region us-east-2
```

---

## 🔄 Rollback Plan

If issues occur:

### Rollback Single Stack

```bash
# Destroy a problematic stack
npx cdk destroy BebcoPlaidStack \
  --context environment=dev \
  --context region=us-east-2 \
  --force
```

### Rollback All Stacks

```bash
# Destroy all stacks (reverse order)
npx cdk destroy BebcoPlaidStack BebcoDataStack BebcoStorageStack BebcoAuthStack \
  --context environment=dev \
  --context region=us-east-2 \
  --force
```

**Note:** Tables with `RETAIN` policy won't be deleted. Delete manually if needed:
```bash
aws dynamodb delete-table --table-name bebco-borrower-accounts-dev --region us-east-2
```

---

## 📈 Next Steps After Deployment

### 1. Implement Remaining Lambda Stacks

Currently deployed: 9 / 130 Lambda functions

**Remaining stacks to create:**
- UsersStack (12 functions)
- AuthLambdasStack (13 functions)  
- BorrowersStack (~20 functions)
- LoansStack (~15 functions)
- PaymentsStack (~10 functions)
- ReportingStack (Monthly/Annual reports)
- CasesStack (Legal case management)
- DrawsStack (7 functions)
- ExpensesStack (4 functions)
- BanksStack (3 functions)
- SharePointStack (3 functions)
- InvoicesStack (5 functions)
- StatementsStack
- DocuSignStack (6 functions)
- IntegrationsStack (OCR, Textract, misc)

### 2. Create API Gateway Stack

Implement REST API endpoints for all Lambda functions.

### 3. Create AppSync Stack

Implement GraphQL APIs and resolvers.

### 4. Create Queues Stack

- 5 SQS queues
- 2 SNS topics
- 7 EventBridge rules

### 5. Data Migration

```bash
# Export from us-east-1 (READ ONLY)
./scripts/export-dynamodb-data.sh

# Import to us-east-2
./scripts/import-dynamodb-data.sh
```

---

## 📝 Deployment Checklist

- [ ] CDK bootstrapped in us-east-2
- [ ] Lambda layers replicated
- [ ] All 130 Lambda packages downloaded
- [ ] BebcoAuthStack deployed
- [ ] BebcoStorageStack deployed
- [ ] BebcoDataStack deployed
- [ ] BebcoPlaidStack deployed
- [ ] Lambda functions tested
- [ ] DynamoDB tables accessible
- [ ] S3 buckets created
- [ ] Cognito pools configured

---

## 🔐 Security Notes

1. **IAM Permissions:** Lambda functions have least-privilege IAM roles
2. **S3 Buckets:** Block all public access enabled
3. **DynamoDB:** Point-in-time recovery enabled
4. **Cognito:** Password policy enforced
5. **Lambda:** X-Ray tracing enabled for all functions

---

## 📞 Support

For issues or questions:
1. Check CloudWatch Logs for Lambda errors
2. Review CloudFormation events in AWS Console
3. Check CDK output for specific error messages
4. Refer to `STATUS.md` for current project status

