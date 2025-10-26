# 🚀 Jaspal - Your Personal Dev Environment is Ready!

Hey Jaspal! Your personal AWS dev environment (`-jpl` suffix) is fully deployed and ready for testing. Here's what you need to do:

---

## **Quick Start (5 mins):**

### **1. Get Your API Endpoints**

Run these commands in your terminal:

```bash
# Get API Gateway URLs
aws apigateway get-rest-apis --region us-east-2 --query "items[?contains(name, 'jpl')].{Name:name,ID:id,URL:join('',[id,'.execute-api.us-east-2.amazonaws.com/prod'])}"

# Get AppSync (GraphQL) endpoints  
aws appsync list-graphql-apis --region us-east-2 --query "graphqlApis[?contains(name, 'jpl')].{Name:name,Endpoint:uris.GRAPHQL}"
```

Copy these URLs - you'll need them in Step 2.

---

### **2. Configure BorrowerPortal**

Create `BorrowerPortal/.env.local`:

```bash
# Jaspal's Personal Dev Environment
NEXT_PUBLIC_AWS_REGION=us-east-2

# Cognito
NEXT_PUBLIC_USER_POOL_ID=us-east-2_MCfFL1JxA
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1sscdh33p4f9opudog0q3unafr
NEXT_PUBLIC_IDENTITY_POOL_ID=us-east-2:4047793c-c222-48e6-aa4b-2155fc5c103f

# API Endpoint (from Step 1 - Borrower API)
NEXT_PUBLIC_API_ENDPOINT=https://YOUR-API-ID-HERE.execute-api.us-east-2.amazonaws.com/prod

# GraphQL Endpoint (from Step 1)
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://YOUR-APPSYNC-ID-HERE.appsync-api.us-east-2.amazonaws.com/graphql

# S3 Buckets
NEXT_PUBLIC_DOCUMENTS_BUCKET=bebco-borrower-documents-jpl-us-east-2-303555290462
NEXT_PUBLIC_STATEMENTS_BUCKET=bebco-borrower-statements-jpl-us-east-2-303555290462

NEXT_PUBLIC_ENVIRONMENT=jaspal-dev
```

**Replace** `YOUR-API-ID-HERE` and `YOUR-APPSYNC-ID-HERE` with the URLs from Step 1.

---

### **3. Start Dev Server**

```bash
cd path/to/BorrowerPortal
npm install  # Only if first time
npm run dev
```

Open `http://localhost:3000` and test!

---

## **What You Have:**

✅ **130 Lambda functions** (with `-jpl` suffix)  
✅ **33 DynamoDB tables** (isolated - only yours)  
✅ **5 APIs** (3 REST + 2 GraphQL)  
✅ **Cognito authentication** (create new users here)  
✅ **S3 buckets** for documents & statements  
✅ **Complete isolation** - won't affect prod, shared dev, or other devs

---

## **Testing Checklist:**

1. **Sign up** for a new account (no existing users yet)
2. **Login** and verify redirect to dashboard
3. **Create** a borrower/company
4. **Upload** a document
5. **View** data in the app

---

## **Troubleshooting:**

**"Incorrect username or password"**  
→ Sign up first - Cognito is empty on your environment

**403 / Access Denied errors**  
→ Check CloudWatch logs: `aws logs tail /aws/lambda/bebco-dev-users-create-jpl --region us-east-2 --follow`

**CORS errors**  
→ Double-check your API endpoint URL in `.env.local`

**Need to see your data:**  
```bash
# View users
aws dynamodb scan --table-name bebco-borrower-users-jpl --region us-east-2 --max-items 5

# View accounts
aws dynamodb scan --table-name bebco-borrower-accounts-jpl --region us-east-2 --max-items 5
```

---

## **Full Documentation:**

Check `bebco-infra-cdk-v2/JASPAL-TESTING-GUIDE.md` for detailed instructions, AWS Console links, and monitoring tips.

---

**Your CloudWatch Dashboard:**  
https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards:name=bebco-jpl-overview

**Questions?** Drop them in Slack! Happy testing! 🎉

