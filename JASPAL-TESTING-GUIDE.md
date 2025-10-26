# 🧪 Jaspal's Personal Dev Environment - Testing Guide

**Environment:** `jpl` (Jaspal's isolated AWS environment in `us-east-2`)  
**Status:** ✅ 100% Deployed (27/27 stacks complete)  
**Date:** October 26, 2025

---

## 📋 What You Have

Your personal AWS environment includes:
- **130 Lambda functions** (with `-jpl` suffix)
- **33 DynamoDB tables** (with `-jpl` suffix)
- **4 S3 buckets** (with `-jpl` suffix)
- **5 APIs** (3 REST APIs + 2 GraphQL APIs)
- **Complete infrastructure** (Cognito, SQS, SNS, EventBridge, CloudWatch)

**Everything is isolated from:**
- ✅ Production (`us-east-1`)
- ✅ Shared dev environment (`dev`)
- ✅ Other developers (Dinu, Brandon, Steven)

---

## 🚀 Quick Start (5 Minutes)

### **Step 1: Get Your AWS Credentials**

Your environment uses these AWS resource identifiers:

```
Region: us-east-2
Suffix: -jpl
Cognito User Pool ID: us-east-2_MCfFL1JxA
Cognito Client ID: 1sscdh33p4f9opudog0q3unafr
Identity Pool ID: us-east-2:4047793c-c222-48e6-aa4b-2155fc5c103f
```

**API Endpoints:**
```bash
# Borrower Portal REST API
https://102cew94t7.execute-api.us-east-2.amazonaws.com/prod

# Admin Portal REST API
https://k2hlyos8n3.execute-api.us-east-2.amazonaws.com/prod

# Admin Secondary REST API
https://a8glseo7x3.execute-api.us-east-2.amazonaws.com/prod

# GraphQL API (Borrowers)
https://cyhxyazoeneyrbkywsponr7c6e.appsync-api.us-east-2.amazonaws.com/graphql

# GraphQL API (Borrower Statements)
https://epttj74zevg77mgusas75gwaxi.appsync-api.us-east-2.amazonaws.com/graphql
```

---

### **Step 2: Configure BorrowerPortal (Frontend)**

Navigate to your BorrowerPortal directory and create/update `.env.local`:

```bash
cd ~/path/to/BorrowerPortal
```

Create `.env.local` file:

```bash
# Jaspal's Personal Dev Environment (-jpl)

# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-2

# Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=us-east-2_MCfFL1JxA
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1sscdh33p4f9opudog0q3unafr
NEXT_PUBLIC_IDENTITY_POOL_ID=us-east-2:4047793c-c222-48e6-aa4b-2155fc5c103f

# API Gateway Endpoint
NEXT_PUBLIC_API_ENDPOINT=https://102cew94t7.execute-api.us-east-2.amazonaws.com/prod

# GraphQL Endpoint
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://cyhxyazoeneyrbkywsponr7c6e.appsync-api.us-east-2.amazonaws.com/graphql

# S3 Buckets
NEXT_PUBLIC_DOCUMENTS_BUCKET=bebco-borrower-documents-jpl-us-east-2-303555290462
NEXT_PUBLIC_STATEMENTS_BUCKET=bebco-borrower-statements-jpl-us-east-2-303555290462

# Environment Identifier
NEXT_PUBLIC_ENVIRONMENT=jaspal-dev
```

---

### **Step 3: Configure AdminPortal (if testing admin)**

Navigate to your AdminPortal directory and create/update `.env.local`:

```bash
cd ~/path/to/AdminPortal
```

Create `.env.local` file (same Cognito as Borrower, different API):

```bash
# Jaspal's Personal Dev Environment (-jpl)

# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-2

# Cognito Configuration (same as Borrower)
NEXT_PUBLIC_USER_POOL_ID=us-east-2_MCfFL1JxA
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1sscdh33p4f9opudog0q3unafr
NEXT_PUBLIC_IDENTITY_POOL_ID=us-east-2:4047793c-c222-48e6-aa4b-2155fc5c103f

# Admin API Gateway Endpoints
NEXT_PUBLIC_API_ENDPOINT=https://k2hlyos8n3.execute-api.us-east-2.amazonaws.com/prod
NEXT_PUBLIC_SECONDARY_API_ENDPOINT=https://a8glseo7x3.execute-api.us-east-2.amazonaws.com/prod

# GraphQL Endpoint (same as Borrower)
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://cyhxyazoeneyrbkywsponr7c6e.appsync-api.us-east-2.amazonaws.com/graphql

# S3 Buckets
NEXT_PUBLIC_DOCUMENTS_BUCKET=bebco-borrower-documents-jpl-us-east-2-303555290462

# Environment Identifier
NEXT_PUBLIC_ENVIRONMENT=jaspal-dev-admin
```

---

### **Step 4: Install Dependencies & Start Dev Server**

```bash
# For BorrowerPortal
cd ~/path/to/BorrowerPortal
npm install  # Only needed first time or if package.json changed
npm run dev

# The app should start on http://localhost:3000
```

**Or for AdminPortal:**
```bash
cd ~/path/to/AdminPortal
npm install
npm run dev
# Should start on http://localhost:3001 (or next available port)
```

---

## 🧪 Testing Checklist

### **1. Authentication Test**
- [ ] Open BorrowerPortal (`http://localhost:3000`)
- [ ] Click "Sign Up" or "Login"
- [ ] Create a new test account (email + password)
- [ ] Verify email works (check CloudWatch logs if needed)
- [ ] Verify successful login redirects to dashboard

**Check this in AWS Console:**
```bash
# View Cognito Users
aws cognito-idp list-users \
  --user-pool-id us-east-2_MCfFL1JxA \
  --region us-east-2
```

---

### **2. Database Operations Test**
- [ ] Create a new borrower account
- [ ] Add a company/case
- [ ] Upload a document
- [ ] View transactions

**Check DynamoDB data:**
```bash
# View users table
aws dynamodb scan \
  --table-name bebco-borrower-users-jpl \
  --region us-east-2 \
  --max-items 5

# View accounts table
aws dynamodb scan \
  --table-name bebco-borrower-accounts-jpl \
  --region us-east-2 \
  --max-items 5
```

---

### **3. API Test**
- [ ] Test REST API calls from the browser console
- [ ] Check Network tab in DevTools for API responses
- [ ] Verify 200 status codes (not 403/500)

**Manual API Test (using curl):**
```bash
# Get a JWT token first from your app (check localStorage in browser DevTools)
TOKEN="your-jwt-token-here"

# Test Borrower API
curl -X GET \
  "https://102cew94t7.execute-api.us-east-2.amazonaws.com/prod/users" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **4. Lambda Function Test**
- [ ] Trigger a Lambda function (e.g., by creating an account)
- [ ] Check CloudWatch Logs for execution

**View Lambda logs:**
```bash
# List recent log groups
aws logs describe-log-groups \
  --region us-east-2 \
  --query "logGroups[?contains(logGroupName, 'jpl')].logGroupName" \
  --output table

# View specific Lambda logs (example: users-create)
aws logs tail /aws/lambda/bebco-dev-users-create-jpl \
  --region us-east-2 \
  --follow
```

---

### **5. S3 File Upload Test**
- [ ] Upload a document/statement in the app
- [ ] Verify it appears in S3

**Check S3 bucket:**
```bash
# List files in documents bucket
aws s3 ls s3://bebco-borrower-documents-jpl-us-east-2-303555290462/ \
  --region us-east-2 \
  --recursive
```

---

## 🐛 Troubleshooting

### **Problem: "Incorrect username or password"**
- **Cause:** Cognito User Pool doesn't have any users yet
- **Solution:** Click "Sign Up" to create a new account first

---

### **Problem: "Access Denied" or 403 errors**
- **Cause:** API Gateway authorizer configuration or incorrect JWT token
- **Solution:** 
  1. Check CloudWatch Logs for the API Gateway
  2. Verify your JWT token is valid (check expiration in jwt.io)
  3. Ensure you're using the correct API endpoint

```bash
# View API Gateway logs
aws logs tail /aws/apigateway/bebco-borrower-jpl-api \
  --region us-east-2 \
  --follow
```

---

### **Problem: "Network Error" or CORS issues**
- **Cause:** API Gateway CORS configuration or wrong endpoint
- **Solution:**
  1. Verify your API endpoint in `.env.local` is correct
  2. Check browser console for exact error
  3. Verify API Gateway has CORS enabled

---

### **Problem: Lambda functions not executing**
- **Cause:** Could be permissions, environment variables, or code errors
- **Solution:** Check CloudWatch Logs for the specific Lambda

```bash
# Example: Check users-create Lambda
aws logs tail /aws/lambda/bebco-dev-users-create-jpl \
  --region us-east-2 \
  --since 10m
```

---

### **Problem: Data not appearing in DynamoDB**
- **Cause:** Lambda function might have failed, or using wrong table name
- **Solution:**
  1. Check Lambda logs for errors
  2. Verify Lambda environment variables point to `-jpl` tables
  3. Check DynamoDB table exists

```bash
# List all your DynamoDB tables
aws dynamodb list-tables \
  --region us-east-2 \
  --query "TableNames[?contains(@, 'jpl')]"
```

---

## 📊 Monitoring Your Environment

### **CloudWatch Dashboard**
Open the CloudWatch Dashboard for a visual overview:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards:name=bebco-jpl-overview
```

### **View Lambda Metrics**
```bash
# Get Lambda invocation count (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=bebco-dev-users-create-jpl \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-2
```

---

## 🔄 Making Changes to Your Environment

### **Option A: Quick Lambda Update (Fast Iteration)**

If you need to test a quick code change in a Lambda function:

```bash
# 1. Make your code changes in the Lambda source
cd ~/path/to/your/lambda/function

# 2. Zip the updated code
zip -r function.zip .

# 3. Update the Lambda directly (bypasses CDK)
aws lambda update-function-code \
  --function-name bebco-dev-your-function-jpl \
  --zip-file fileb://function.zip \
  --region us-east-2

# 4. Wait a few seconds for deployment
aws lambda wait function-updated \
  --function-name bebco-dev-your-function-jpl \
  --region us-east-2

echo "✅ Lambda updated! Test your changes now."
```

**⚠️ Important:** This is for **quick testing only**. To persist changes long-term, you must update via CDK (see Option B).

---

### **Option B: Full CDK Deployment (Persists Changes)**

To make permanent changes that sync with the team:

```bash
cd ~/path/to/bebco-infra-cdk-v2

# 1. Make your infrastructure changes (e.g., update Lambda code, add environment variables)

# 2. Deploy to YOUR environment only
npx cdk deploy --all \
  -c environment=jaspal \
  -c region=us-east-2 \
  --require-approval never
```

**When to use CDK deploy:**
- Adding new Lambda functions
- Changing environment variables
- Adding new DynamoDB tables/indexes
- Updating IAM permissions
- Changing API Gateway routes

---

## 🤝 Collaborating with the Team

### **Your Changes Won't Affect:**
- ❌ **Production** (`us-east-1`) - READ ONLY, never touched
- ❌ **Shared Dev** - Steven's environment
- ❌ **Dinu's Environment** (`-din` suffix)
- ❌ **Brandon's Environment** (`-bdn` suffix)

### **Sharing Your Work:**
1. Test thoroughly in YOUR environment (`-jpl`)
2. Push code changes to a feature branch in Git
3. Open a Pull Request
4. Team reviews and merges to `main`
5. Changes deploy to shared `dev` environment for final testing
6. Then promote to `staging` and finally `production`

---

## 📞 Need Help?

### **Quick Commands Reference**

```bash
# Get your API Gateway URLs
aws apigateway get-rest-apis --region us-east-2 \
  --query "items[?contains(name, 'jpl')].[name,id]" --output table

# Get your AppSync endpoints
aws appsync list-graphql-apis --region us-east-2 \
  --query "graphqlApis[?contains(name, 'jpl')].uris.GRAPHQL" --output table

# List your Lambda functions
aws lambda list-functions --region us-east-2 \
  --query "Functions[?contains(FunctionName, 'jpl')].FunctionName" --output table

# List your DynamoDB tables
aws dynamodb list-tables --region us-east-2 \
  --query "TableNames[?contains(@, 'jpl')]" --output table

# List your S3 buckets
aws s3 ls | grep jpl

# View CloudWatch Dashboard
open "https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards:name=bebco-jpl-overview"
```

### **Common AWS Console Links**
- **Lambda Functions:** https://us-east-2.console.aws.amazon.com/lambda/home?region=us-east-2#/functions
- **DynamoDB Tables:** https://us-east-2.console.aws.amazon.com/dynamodbv2/home?region=us-east-2#tables
- **API Gateway:** https://us-east-2.console.aws.amazon.com/apigateway/home?region=us-east-2#/apis
- **Cognito User Pools:** https://us-east-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=us-east-2
- **CloudWatch Logs:** https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#logsV2:log-groups
- **S3 Buckets:** https://s3.console.aws.amazon.com/s3/buckets?region=us-east-2&prefix=bebco

---

## ✅ You're All Set!

Your personal dev environment is ready to use. You have:
- ✅ Complete isolation from other environments
- ✅ All 130 Lambda functions deployed
- ✅ Full database with 33 tables
- ✅ Working APIs (REST + GraphQL)
- ✅ Cognito authentication
- ✅ CloudWatch monitoring

**Next steps:**
1. Configure your `.env.local` files (Step 2 & 3)
2. Start your dev server (Step 4)
3. Create a test account and start testing! (Testing Checklist)

**Questions?** Ask in the team Slack channel or check the troubleshooting section above.

Happy coding! 🚀

