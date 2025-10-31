# 🧪 Steven's Personal Dev Environment - Testing Guide

**Environment:** `stv` (Steven's isolated AWS environment in `us-east-2`)  
**Status:** ✅ 100% Deployed (28/28 stacks complete)  
**Date:** October 29, 2025

---

## 📋 What You Have

Your personal AWS environment includes:
- **130 Lambda functions** (with `-stv` suffix)
- **33 DynamoDB tables** (with `-stv` suffix)
- **5 S3 buckets** (with `-stv` suffix)
- **5 APIs** (3 REST APIs + 2 GraphQL APIs)
- **Complete infrastructure** (Cognito, SQS, SNS, EventBridge, CloudWatch)

**Everything is isolated from:**
- ✅ Production (`us-east-1`)
- ✅ Shared dev environment (`dev`)
- ✅ Other developers (Jaspal, Dinu, Brandon)

---

## 🚀 Quick Start (5 Minutes)

### **Step 1: Your AWS Credentials**

Your environment uses these AWS resource identifiers:

```
Region: us-east-2
Suffix: -stv
Cognito User Pool ID: us-east-2_utDnXmP6E
Cognito Client ID: 141r63lc6r33v1hesrg83odvtj
Identity Pool ID: us-east-2:cbba2d63-5aa7-41fb-af12-1a99112f9bb5
```

**API Endpoints:**
```bash
# Borrower Portal REST API
https://ae9x40fui5.execute-api.us-east-2.amazonaws.com/prod

# Admin Portal REST API
https://ga6ahst9qi.execute-api.us-east-2.amazonaws.com/prod

# Admin Secondary REST API
https://l9ek0xo5u0.execute-api.us-east-2.amazonaws.com/prod

# GraphQL API (Borrowers)
https://d2x74ybey5h7dpdymdxr6zbniq.appsync-api.us-east-2.amazonaws.com/graphql

# GraphQL API (Borrower Statements)
https://5n5fo2cafbcavip43ckma546ze.appsync-api.us-east-2.amazonaws.com/graphql
```

---

### **Step 2: Configure Frontend Applications**

You have **two frontend applications** to configure:

#### **A. BorrowerPortal Configuration**

Navigate to your BorrowerPortal directory and create/update `.env.local`:

```bash
cd ~/path/to/BorrowerPortal
```

Create `.env.local` file:

```bash
# Steven's Personal Dev Environment (-stv)

# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-2

# Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=us-east-2_utDnXmP6E
NEXT_PUBLIC_USER_POOL_CLIENT_ID=141r63lc6r33v1hesrg83odvtj
NEXT_PUBLIC_IDENTITY_POOL_ID=us-east-2:cbba2d63-5aa7-41fb-af12-1a99112f9bb5

# API Endpoints (Borrower API) - using /dev/ stage
NEXT_PUBLIC_API_ENDPOINT=https://ae9x40fui5.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://d2x74ybey5h7dpdymdxr6zbniq.appsync-api.us-east-2.amazonaws.com/graphql

# S3 Buckets
NEXT_PUBLIC_DOCUMENTS_BUCKET=bebco-borrower-documents-stv-us-east-2-303555290462
NEXT_PUBLIC_STATEMENTS_BUCKET=bebco-borrower-statements-stv-us-east-2-303555290462

# Environment
NEXT_PUBLIC_ENVIRONMENT=steven-dev
```

#### **B. AdminPortal Configuration**

Navigate to your AdminPortal directory and create/update `.env.local`:

```bash
cd ~/path/to/AdminPortal
```

Create `.env.local` file:

```bash
# Steven's Personal Dev Environment (-stv)

# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-2

# Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=us-east-2_utDnXmP6E
NEXT_PUBLIC_USER_POOL_CLIENT_ID=141r63lc6r33v1hesrg83odvtj
NEXT_PUBLIC_IDENTITY_POOL_ID=us-east-2:cbba2d63-5aa7-41fb-af12-1a99112f9bb5

# API Endpoints (Admin API) - using /dev/ stage
NEXT_PUBLIC_ADMIN_API_URL=https://ga6ahst9qi.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_BANKS_API_URL=https://l9ek0xo5u0.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_BORROWERS_API_URL=https://ae9x40fui5.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_PAYMENTS_API_URL=https://ga6ahst9qi.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_DOCUSIGN_API_URL=https://l9ek0xo5u0.execute-api.us-east-2.amazonaws.com/dev
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://d2x74ybey5h7dpdymdxr6zbniq.appsync-api.us-east-2.amazonaws.com/graphql
NEXT_PUBLIC_GRAPHQL_STATEMENTS_ENDPOINT=https://5n5fo2cafbcavip43ckma546ze.appsync-api.us-east-2.amazonaws.com/graphql

# AppSync GraphQL Configuration (required for annual reporting and other GraphQL features)
NEXT_PUBLIC_APPSYNC_ENDPOINT=https://d2x74ybey5h7dpdymdxr6zbniq.appsync-api.us-east-2.amazonaws.com/graphql
NEXT_PUBLIC_APPSYNC_API_KEY=da2-su4qfifrbfad5n2yjswvbazxty

# S3 Buckets
NEXT_PUBLIC_DOCUMENTS_BUCKET=bebco-borrower-documents-stv-us-east-2-303555290462
NEXT_PUBLIC_STATEMENTS_BUCKET=bebco-borrower-statements-stv-us-east-2-303555290462

# Environment
NEXT_PUBLIC_ENVIRONMENT=steven-dev
```

---

### **Step 3: Start Dev Servers**

#### **BorrowerPortal:**
```bash
cd path/to/BorrowerPortal
npm install  # Only if first time
npm run dev
```
Open `http://localhost:3000` and test!

#### **AdminPortal:**
```bash
cd path/to/AdminPortal
npm install  # Only if first time
npm run dev
```
Open `http://localhost:3000` (or the port AdminPortal uses) and test!

---

## 📊 Deployed Stacks (28 total)

### Foundation (4 stacks)
- ✅ BebcoAuthStack-stv (Cognito)
- ✅ BebcoStorageStack-stv (5 S3 buckets)
- ✅ BebcoSharedServicesStack-stv (Textract, SNS)
- ✅ BebcoDataStack-stv (33 DynamoDB tables)

### Lambda Functions (17 stacks, 130 functions)
- ✅ BebcoPlaidStack-stv (9 functions)
- ✅ BebcoAccountsStack-stv (9 functions)
- ✅ BebcoUsersStack-stv (21 functions)
- ✅ BebcoDrawsStack-stv (7 functions)
- ✅ BebcoReportingStack-stv (15 functions)
- ✅ BebcoLoansStack-stv (3 functions)
- ✅ BebcoPaymentsStack-stv (7 functions)
- ✅ BebcoCasesStack-stv (6 functions)
- ✅ BebcoAuthLambdasStack-stv (6 functions)
- ✅ BebcoDocuSignStack-stv (6 functions)
- ✅ BebcoBorrowersStack-stv (10 functions)
- ✅ BebcoExpensesStack-stv (4 functions)
- ✅ BebcoInvoicesStack-stv (5 functions)
- ✅ BebcoBanksStack-stv (3 functions)
- ✅ BebcoStatementsStack-stv (5 functions)
- ✅ BebcoIntegrationsStack-stv (8 functions)
- ✅ BebcoMiscStack-stv (6 functions)

### API Layer (5 stacks)
- ✅ BebcoBorrowerApiStack-stv (74 endpoints)
- ✅ BebcoAdminApiStack-stv (77 endpoints)
- ✅ BebcoAdminSecondaryApiStack-stv (7 endpoints)
- ✅ BebcoBorrowersGraphQLStack-stv
- ✅ BebcoBorrowerStatementsGraphQLStack-stv

### Infrastructure (2 stacks)
- ✅ BebcoQueuesStack-stv (SQS, SNS, EventBridge)
- ✅ BebcoMonitoringStack-stv (CloudWatch)

---

## 🧪 Testing Checklist

### 1. Authentication Flow
- [ ] Create test user in Cognito
- [ ] Test login flow
- [ ] Test token generation
- [ ] Test token refresh

### 2. API Endpoints
```bash
# Health check (example)
curl https://ae9x40fui5.execute-api.us-east-2.amazonaws.com/prod/health
```

### 3. Lambda Functions
```bash
# List your Lambda functions
aws lambda list-functions --region us-east-2 \
  --query 'Functions[?contains(FunctionName, `stv`)].FunctionName' \
  | jq 'length'
# Should return: 130
```

### 4. DynamoDB Tables
```bash
# List your DynamoDB tables
aws dynamodb list-tables --region us-east-2 \
  | jq '.TableNames | map(select(contains("stv"))) | length'
# Should return: 33
```

### 5. S3 Buckets
```bash
# List your S3 buckets
aws s3 ls | grep stv
# Should show 5 buckets
```

---

## 🔧 Development Workflow

### Quick Lambda Update (without CDK)
```bash
cd ~/path/to/your/lambda/code
zip -r function.zip .

aws lambda update-function-code \
  --function-name bebco-dev-your-function-stv \
  --zip-file fileb://function.zip \
  --region us-east-2
```

### Deploy Changes via CDK
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
npm run build

# Deploy specific stack
npx cdk deploy BebcoUsersStack-stv \
  -c environment=steven -c region=us-east-2

# Deploy all stacks
npx cdk deploy --all \
  -c environment=steven -c region=us-east-2 \
  --require-approval never
```

---

## 🗑️ Teardown (when not in use)

To save costs, you can destroy your environment when not actively developing:

```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2

# WARNING: This will delete ALL resources
npx cdk destroy --all \
  -c environment=steven -c region=us-east-2
```

**Note:** You can redeploy in ~20-30 minutes when needed!

---

## 📞 Useful Commands

### Check Stack Status
```bash
aws cloudformation list-stacks --region us-east-2 \
  --query "StackSummaries[?contains(StackName,'stv')].{Name:StackName,Status:StackStatus}" \
  --output table
```

### View CloudWatch Logs
```bash
# List log groups
aws logs describe-log-groups --region us-east-2 \
  --query 'logGroups[?contains(logGroupName, `stv`)].logGroupName'

# Tail a specific function's logs
aws logs tail /aws/lambda/bebco-dev-users-create-stv --region us-east-2 --follow
```

### CloudWatch Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards:name=bebco-stv-overview

---

## 🐛 Troubleshooting

### Issue: Lambda can't access DynamoDB
**Solution:** Check IAM permissions in the Lambda function's role:
```bash
aws lambda get-function --function-name bebco-dev-your-function-stv --region us-east-2
```

### Issue: API Gateway returns 403
**Solution:** Verify Cognito authorizer is configured correctly and token is valid.

### Issue: Frontend can't connect to API
**Solution:** Check CORS settings in API Gateway and verify endpoint URLs in `.env.local`.

---

## 💰 Cost Management

**Estimated Monthly Cost:** $50-90

**Tips to reduce costs:**
- Destroy environment when not in use
- Clean up CloudWatch logs older than 7 days
- Delete unused S3 files
- Monitor with AWS Cost Explorer

---

## 🎯 Next Steps

1. **Configure both frontend applications**
   - BorrowerPortal with Borrower API endpoint
   - AdminPortal with Admin API endpoints (primary + secondary)

2. **Create test users** in Cognito
   - Create borrower users for BorrowerPortal testing
   - Create admin users for AdminPortal testing

3. **Seed test data** in DynamoDB tables
   - Sample borrowers, accounts, loans, etc.

4. **Test key workflows**
   - **BorrowerPortal:** Login, view accounts, statements, payments
   - **AdminPortal:** Login, manage borrowers, cases, reports
   - CRUD operations on both portals

5. **Monitor CloudWatch** for any errors

6. **Share feedback** with the team

---

## 📝 Important Notes

- ✅ **Fixed:** Removed hardcoded "staging" table names - all tables now use `-stv` suffix
- ✅ **All 130 Lambda functions** deployed successfully
- ✅ **All 33 DynamoDB tables** created (empty, ready for test data)
- ✅ **All 5 APIs** deployed with correct integrations
- ✅ **Complete isolation** from other environments

---

**🎉 Your environment is ready! Happy coding!**

Last Updated: October 29, 2025  
Deployment Duration: ~30 minutes  
Status: ✅ Fully Operational

