# 👥 Developer Environment Setup Guide

**Team:** Jaspal, Dinu, Brandon, Steven  
**Date:** October 26, 2025  
**Status:** Ready for Deployment

---

## 🎯 Overview

Each developer gets their own complete AWS environment in `us-east-2`:
- **Jaspal** → `jaspal` environment
- **Dinu** → `dinu` environment
- **Brandon** → `brandon` environment
- **Steven** → `steven` environment

---

## ✅ Pre-Deployment Checklist

### **Completed:**
- ✅ Environment config files created for all 4 developers
- ✅ Helper scripts created and made executable
- ✅ Team workflow guide documented
- ✅ Shared `dev` environment already deployed

### **Ready to Deploy:**
- 🚀 Personal environments for each developer

---

## 🚀 Deployment Options

### **Option A: Deploy All Environments Now (Recommended for Initial Setup)**

Deploy all 4 developer environments at once:

```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2

# Build CDK
npm run build

# Deploy all personal environments in parallel
./scripts/deploy-all-developer-envs.sh
```

**Time:** ~20-30 minutes per environment (can run in parallel)  
**Cost:** ~$200-400/month total for all 4 personal envs

---

### **Option B: Each Developer Deploys Their Own (Recommended for Flexibility)**

Each developer runs their setup script individually:

#### **Jaspal:**
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
./scripts/setup-developer-env.sh jaspal
```

#### **Dinu:**
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
./scripts/setup-developer-env.sh dinu
```

#### **Brandon:**
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
./scripts/setup-developer-env.sh brandon
```

#### **Steven:**
```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
./scripts/setup-developer-env.sh steven
```

**Time:** ~15-20 minutes per developer  
**Benefit:** Developers deploy when they're ready to start working

---

### **Option C: Deploy Foundation Only (Fastest Start)**

Deploy just the core infrastructure for quick testing:

```bash
# For each developer (example: Jaspal)
npx cdk deploy BebcoAuthStack BebcoStorageStack BebcoDataStack \
  -c environment=jaspal \
  -c region=us-east-2 \
  --require-approval never

# Deploy Lambda stacks as needed later
```

**Time:** ~5 minutes per developer  
**Benefit:** Minimal upfront deployment, add Lambdas as needed

---

## 📋 What Gets Deployed Per Developer

### **Foundation (Required):**
- 1 Cognito User Pool + Identity Pool
- 5 S3 Buckets
- 31 DynamoDB Tables (empty, ready for test data)

### **Lambda Functions (Optional but Recommended):**
- 130 Lambda Functions across 17 domain stacks
- 1 Lambda Layer

### **APIs (Optional but Recommended):**
- 3 REST APIs (158 endpoints)
- 2 GraphQL APIs

### **Infrastructure:**
- 5 SQS Queues
- 2 SNS Topics
- 7 EventBridge Rules
- 2 CloudWatch Alarms
- 1 CloudWatch Dashboard

---

## 🎨 Resource Naming Convention

### **Examples for Each Developer:**

#### **Jaspal's Resources:**
- Lambda: `bebco-jaspal-plaid-link-token-create`
- DynamoDB: `bebco-borrower-users-jaspal`
- API: `bebco-borrower-api-jaspal`
- S3: `bebco-borrower-documents-jaspal-us-east-2-303555290462`

#### **Dinu's Resources:**
- Lambda: `bebco-dinu-plaid-link-token-create`
- DynamoDB: `bebco-borrower-users-dinu`
- API: `bebco-borrower-api-dinu`
- S3: `bebco-borrower-documents-dinu-us-east-2-303555290462`

#### **Brandon's Resources:**
- Lambda: `bebco-brandon-plaid-link-token-create`
- DynamoDB: `bebco-borrower-users-brandon`
- API: `bebco-borrower-api-brandon`
- S3: `bebco-borrower-documents-brandon-us-east-2-303555290462`

#### **Steven's Resources:**
- Lambda: `bebco-steven-plaid-link-token-create`
- DynamoDB: `bebco-borrower-users-steven`
- API: `bebco-borrower-api-steven`
- S3: `bebco-borrower-documents-steven-us-east-2-303555290462`

---

## 🔧 Post-Deployment Setup

### **1. Set Environment Variable**

Each developer should add to their shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Jaspal
export DEV_ENV=jaspal

# Dinu
export DEV_ENV=dinu

# Brandon
export DEV_ENV=brandon

# Steven
export DEV_ENV=steven
```

Then reload:
```bash
source ~/.zshrc  # or ~/.bashrc
```

---

### **2. Get Your API Endpoints**

After deployment, get your personal API endpoints:

```bash
# Replace 'jaspal' with your name
aws apigateway get-rest-apis \
  --region us-east-2 \
  --query "items[?contains(name,'jaspal')].{Name:name,ID:id,Endpoint:join('',[id,'.execute-api.us-east-2.amazonaws.com'])}" \
  --output table
```

---

### **3. Test Your Environment**

```bash
# List your Lambda functions
aws lambda list-functions \
  --region us-east-2 \
  --query "Functions[?contains(FunctionName,'$DEV_ENV')].FunctionName" \
  --output table

# List your DynamoDB tables
aws dynamodb list-tables \
  --region us-east-2 \
  --output json | jq -r ".TableNames[] | select(contains(\"$DEV_ENV\"))"

# Get Cognito User Pool ID
aws cognito-idp list-user-pools \
  --region us-east-2 \
  --max-results 60 \
  --query "UserPools[?contains(Name,'$DEV_ENV')].{Name:Name,Id:Id}" \
  --output table
```

---

## 💻 Daily Development Workflow

### **Quick Lambda Update (5-10 seconds):**

```bash
# Update a single Lambda function
./scripts/update-lambda-quick.sh plaid-link-token-create /path/to/source $DEV_ENV

# Example: Jaspal updates plaid webhook handler
./scripts/update-lambda-quick.sh plaid-webhook-handler ./lambda/plaid jaspal
```

### **Full CDK Deploy (2-3 minutes):**

```bash
# Deploy a specific stack
npx cdk deploy BebcoPlaidStack \
  -c environment=$DEV_ENV \
  -c region=us-east-2

# Example: Dinu deploys users stack
npx cdk deploy BebcoUsersStack \
  -c environment=dinu \
  -c region=us-east-2
```

---

## 🔀 Git Workflow

### **Feature Branch Naming:**

Use your name prefix to avoid branch conflicts:

```bash
# Jaspal working on Plaid integration
git checkout -b jaspal/feature/plaid-webhook-handler

# Dinu working on user authentication
git checkout -b dinu/feature/user-mfa

# Brandon working on reporting
git checkout -b brandon/feature/monthly-reports

# Steven working on payments
git checkout -b steven/feature/payment-processing
```

### **Branch Lifecycle:**

```
1. Create feature branch: jaspal/feature/plaid-webhook-handler
2. Develop in personal environment (jaspal)
3. Test thoroughly
4. Create PR to 'develop'
5. Team reviews
6. Merge → Auto-deploys to shared 'dev'
7. Team tests integration
8. Promote to staging
9. Promote to production
```

---

## 📊 Cost Management

### **Per Developer Environment:**

| Resource | Monthly Cost |
|----------|--------------|
| Lambda Functions (low usage) | $20-30 |
| DynamoDB (empty/test data) | $10-20 |
| API Gateway (dev usage) | $5-10 |
| S3 Buckets | $5-10 |
| Cognito | $0-5 |
| Other (CloudWatch, etc.) | $10-15 |
| **Total per developer** | **$50-90/month** |

### **All 4 Developers:**
- **Total:** $200-360/month
- **Plus Shared Dev:** $100-200/month
- **Grand Total:** $300-560/month for all dev environments

### **Cost Optimization Tips:**

```bash
# Destroy your environment when not actively developing
npx cdk destroy --all -c environment=$DEV_ENV -c region=us-east-2

# Rebuild when you need it (15-20 minutes)
./scripts/setup-developer-env.sh $DEV_ENV
```

---

## 🚨 Troubleshooting

### **Issue: "Stack already exists"**

If you previously deployed and want to start fresh:

```bash
# List existing stacks
aws cloudformation list-stacks \
  --region us-east-2 \
  --query "StackSummaries[?contains(StackName,'Bebco') && StackStatus!='DELETE_COMPLETE'].StackName" \
  --output table

# Delete all stacks for your environment
npx cdk destroy --all -c environment=$DEV_ENV -c region=us-east-2 --force
```

### **Issue: "Config file not found"**

Make sure you're using the correct environment name:

```bash
# Valid names:
jaspal, dinu, brandon, steven

# Check if config exists:
ls -la config/environments/$DEV_ENV-us-east-2.json
```

### **Issue: "Lambda function not found"**

The Lambda might not be deployed yet:

```bash
# Deploy the Lambda stack containing that function
npx cdk deploy BebcoPlaidStack -c environment=$DEV_ENV -c region=us-east-2
```

---

## ✅ Deployment Verification

After deployment, verify everything is working:

```bash
# 1. Check CloudFormation stacks
aws cloudformation list-stacks \
  --region us-east-2 \
  --query "StackSummaries[?contains(StackName,'Bebco') && contains(StackName,'$DEV_ENV')].{Name:StackName,Status:StackStatus}" \
  --output table

# 2. Count Lambda functions
aws lambda list-functions \
  --region us-east-2 \
  --query "length(Functions[?contains(FunctionName,'$DEV_ENV')])"

# 3. Count DynamoDB tables
aws dynamodb list-tables \
  --region us-east-2 \
  --output json | jq -r "[.TableNames[] | select(contains(\"$DEV_ENV\"))] | length"

# 4. Get API endpoint
aws apigateway get-rest-apis \
  --region us-east-2 \
  --query "items[?contains(name,'$DEV_ENV')].{Name:name,Endpoint:join('',[id,'.execute-api.us-east-2.amazonaws.com'])}" \
  --output table
```

---

## 📞 Team Communication

### **Slack Channels (Recommended Setup):**

- `#bebco-dev` - Daily development chat
- `#bebco-deployments` - Deployment notifications
- `#bebco-prs` - Pull request reviews
- `#bebco-incidents` - Issues and troubleshooting

### **Daily Standup Format:**

```markdown
**Jaspal:**
- Working on: Plaid webhook handler (jaspal/feature/plaid-webhook)
- Environment: jaspal
- Status: Testing in personal env
- Merging to develop: Tomorrow
- Blockers: None

**Dinu:**
- Working on: User MFA (dinu/feature/user-mfa)
- Environment: dinu
- Status: Ready for PR
- Merging to develop: Today
- Blockers: Waiting for review

**Brandon:**
- Working on: Monthly reports (brandon/feature/monthly-reports)
- Environment: brandon
- Status: Deployed to personal env, testing
- Merging to develop: This week
- Blockers: Need sample data

**Steven:**
- Working on: Payment processing (steven/feature/payment-processing)
- Environment: steven
- Status: PR merged to develop
- Merging to develop: Complete
- Blockers: None
```

---

## 🎓 Onboarding New Developers

To add a 5th developer in the future:

```bash
# 1. Create config file
cp config/environments/jaspal-us-east-2.json config/environments/newdev-us-east-2.json

# 2. Update all instances of "jaspal" to "newdev"
sed -i '' 's/jaspal/newdev/g' config/environments/newdev-us-east-2.json

# 3. Deploy environment
./scripts/setup-developer-env.sh newdev
```

---

## 📚 Additional Resources

- **Full Team Workflow:** `TEAM-WORKFLOW-GUIDE.md`
- **Infrastructure Details:** `FINAL-DEPLOYMENT-COMPLETE.md`
- **API Documentation:** `API-DEPLOYMENT-COMPLETE.md`
- **Data Migration:** `DYNAMODB-MIGRATION-COMPLETE.md`

---

## 🎉 Summary

### **Environments Created:**
- ✅ **jaspal** - Jaspal's personal dev environment
- ✅ **dinu** - Dinu's personal dev environment
- ✅ **brandon** - Brandon's personal dev environment
- ✅ **steven** - Steven's personal dev environment
- ✅ **dev** - Shared team integration (already deployed)

### **Ready to Deploy:**
Each developer can now deploy their personal environment with:
```bash
./scripts/setup-developer-env.sh <your-name>
```

### **Next Steps:**
1. Each developer deploys their personal environment
2. Set `DEV_ENV` environment variable
3. Start developing on feature branches
4. Test in personal environment
5. Create PRs to `develop`
6. Team tests in shared `dev`
7. Promote to staging → production

---

**🚀 Ready to go! Let's deploy!**

*Last Updated: October 26, 2025*  
*Team: Jaspal, Dinu, Brandon, Steven*

