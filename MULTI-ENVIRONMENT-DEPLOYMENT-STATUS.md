# 👥 Multi-Environment Deployment Status

## 🎯 Objective
Deploy complete, isolated infrastructure for 4 developers (Jaspal, Dinu, Brandon, Steven) in us-east-2.

---

## 🔧 Issues Encountered & Fixed

### 1. **CloudFormation Stack ID Conflicts** ❌ → ✅
**Problem:** Stack names were hardcoded without environment suffix (e.g., `'BebcoAuthStack'`)
- This caused conflicts when deploying multiple environments
- Existing `dev` stacks used names like `BebcoAuthStack`
- New `jaspal` stacks tried to use same names

**Solution:**
- Added `getStackId()` helper function in `bin/bebco-infra-cdk-v2.ts`
- All stacks now include environment suffix: `BebcoAuthStack-jaspal`, `BebcoStorageStack-dinu`, etc.
- Each environment gets unique stack names

```typescript
const getStackId = (baseName: string) => `Bebco${baseName}Stack-${config.naming.environmentSuffix}`;

const authStack = new AuthStack(app, getStackId('Auth'), { ... });
const storageStack = new StorageStack(app, getStackId('Storage'), { ... });
```

### 2. **CloudFormation Export Name Conflicts** ❌ → ✅
**Problem:** CloudFormation exports had duplicate names across environments
- `bebco-jaspal-user-pool-client-id` conflicted with `bebco-dev-user-pool-client-id`
- CloudFormation doesn't allow duplicate export names in same account/region

**Solution:**
- Removed all `exportName` properties from CFN outputs
- Exports are unnecessary since CDK passes values directly via props
- Fixed in:
  - `lib/stacks/auth-stack.ts`
  - `lib/stacks/queues-stack.ts`
  - All API stacks (`lib/stacks/api/*.ts`)

```typescript
// Before
new cdk.CfnOutput(this, 'UserPoolId', {
  value: this.userPool.userPoolId,
  description: 'Cognito User Pool ID',
  exportName: `${config.naming.prefix}-${config.naming.environmentSuffix}-user-pool-id`,  // ❌ Causes conflicts
});

// After
new cdk.CfnOutput(this, 'UserPoolId', {
  value: this.userPool.userPoolId,
  description: 'Cognito User Pool ID',
  // ✅ No exportName needed - values passed via props
});
```

### 3. **S3 Bucket Name Conflicts** ❌ → ✅
**Problem:** S3 buckets from previous failed deployments still existed
- `bebco-borrower-documents-jaspal-us-east-2-303555290462` already existed
- CloudFormation failed to create new stacks

**Solution:**
- Deleted existing S3 buckets from failed deployments
- Deleted ROLLBACK_COMPLETE stacks
- Clean slate for new deployment

```bash
# Deleted buckets
aws s3 rb s3://bebco-borrower-documents-jaspal-us-east-2-303555290462 --force
aws s3 rb s3://bebco-borrower-statements-jaspal-us-east-2-303555290462 --force
aws s3 rb s3://bebco-change-tracking-jaspal-us-east-2-303555290462 --force
aws s3 rb s3://bebco-lambda-deployments-jaspal-us-east-2-303555290462 --force

# Deleted failed stacks
aws cloudformation delete-stack --stack-name BebcoStorageStack-jaspal
aws cloudformation delete-stack --stack-name BebcoAuthStack-jaspal
```

---

## 📊 Deployment Status

### Jaspal's Environment (`jaspal-us-east-2`)
- **Status:** 🟡 Deploying
- **Started:** October 26, 2025 11:43 AM
- **Est. Completion:** ~12:00 PM (15-20 minutes)
- **Stacks:** 27 total
  - 3 Foundation (Auth, Storage, Data)
  - 17 Lambda domain stacks
  - 5 API stacks
  - 2 Infrastructure (Queues, Monitoring)

### Dinu's Environment (`dinu-us-east-2`)
- **Status:** ⏳ Pending
- **Est. Start:** After Jaspal completes
- **Est. Duration:** 15-20 minutes

### Brandon's Environment (`brandon-us-east-2`)
- **Status:** ⏳ Pending
- **Est. Start:** After Dinu completes
- **Est. Duration:** 15-20 minutes

### Steven's Environment (`steven-us-east-2`)
- **Status:** ⏳ Pending
- **Est. Start:** After Brandon completes
- **Est. Duration:** 15-20 minutes

---

## ⏱️ Timeline

| Time | Event |
|------|-------|
| 11:30 AM | Started Jaspal deployment (attempt 1) - **FAILED** (Stack ID conflicts) |
| 11:34 AM | Fixed stack IDs, restarted - **FAILED** (Export name conflicts) |
| 11:39 AM | Removed exports, restarted - **FAILED** (S3 bucket conflicts) |
| 11:42 AM | Cleaned up resources, restarting - **IN PROGRESS** ✅ |
| 12:00 PM | Jaspal complete (estimated) |
| 12:20 PM | Dinu complete (estimated) |
| 12:40 PM | Brandon complete (estimated) |
| 1:00 PM | Steven complete (estimated) |
| **1:00 PM** | **ALL 4 ENVIRONMENTS COMPLETE** 🎉 |

---

## 📦 What Each Developer Gets

### Infrastructure (27 CloudFormation Stacks)

#### Foundation (3 stacks)
- **BebcoAuthStack-{env}**
  - 1 Cognito User Pool
  - 1 User Pool Client
  - 1 Identity Pool

- **BebcoStorageStack-{env}**
  - 5 S3 Buckets (documents, statements, deployments, change-tracking, dynamodb-exports)

- **BebcoDataStack-{env}**
  - 31 DynamoDB Tables (empty, ready for test data)

#### Lambda Functions (17 stacks, 130 functions)
- **BebcoPlaidStack-{env}** (9 functions)
- **BebcoAccountsStack-{env}** (9 functions)
- **BebcoUsersStack-{env}** (21 functions)
- **BebcoDrawsStack-{env}** (7 functions)
- **BebcoReportingStack-{env}** (15 functions)
- **BebcoLoansStack-{env}** (3 functions)
- **BebcoPaymentsStack-{env}** (7 functions)
- **BebcoCasesStack-{env}** (6 functions)
- **BebcoAuthLambdasStack-{env}** (6 functions)
- **BebcoDocuSignStack-{env}** (6 functions)
- **BebcoBorrowersStack-{env}** (10 functions)
- **BebcoExpensesStack-{env}** (4 functions)
- **BebcoInvoicesStack-{env}** (5 functions)
- **BebcoBanksStack-{env}** (3 functions)
- **BebcoStatementsStack-{env}** (5 functions)
- **BebcoIntegrationsStack-{env}** (8 functions)
- **BebcoMiscStack-{env}** (16 functions)

#### API Layer (5 stacks)
- **BebcoBorrowerApiStack-{env}**
  - REST API with 49 endpoints
  - Cognito authorizer

- **BebcoAdminApiStack-{env}**
  - REST API with 79 endpoints
  - Cognito authorizer

- **BebcoAdminSecondaryApiStack-{env}**
  - REST API with 9 endpoints
  - Cognito authorizer

- **BebcoBorrowersGraphQLStack-{env}**
  - GraphQL API for borrower management

- **BebcoBorrowerStatementsGraphQLStack-{env}**
  - GraphQL API for statements

#### Infrastructure (2 stacks)
- **BebcoQueuesStack-{env}**
  - 5 SQS Queues (including FIFO & DLQs)
  - 2 SNS Topics
  - 7 EventBridge Scheduled Rules

- **BebcoMonitoringStack-{env}**
  - CloudWatch Alarms
  - CloudWatch Dashboard

---

## 💰 Cost Estimate

### Per Developer (Active)
- **Lambda:** $10-20/month (depending on usage)
- **API Gateway:** $3-5/month
- **DynamoDB:** $15-30/month (empty tables, minimal cost)
- **S3:** $5-10/month
- **CloudWatch:** $5-10/month
- **Cognito:** $0-5/month
- **Other Services:** $2-5/month
- **Total per developer:** $50-90/month

### All 4 Developers
- **Monthly:** $200-360
- **Annually:** $2,400-4,320

### Cost Savings Tips
- Destroy environments when not actively developing
- Can rebuild from scratch in 15-20 minutes
- Only pay for what's actively deployed
- Consider rotating which developers have active environments

---

## 🎯 Next Steps

### Immediate
1. ✅ Complete Jaspal's deployment
2. ⏳ Deploy Dinu's environment
3. ⏳ Deploy Brandon's environment
4. ⏳ Deploy Steven's environment

### After All Deployments Complete
1. Verify all resources created successfully
2. Test Cognito authentication in each environment
3. Test API endpoints in each environment
4. Update `DEVELOPER-SETUP-GUIDE.md` with actual deployment results
5. Create sample test data import script

### Developer Onboarding
1. Each developer sets: `export DEV_ENV=<their-name>`
2. Developers can use `./scripts/update-lambda-quick.sh` for fast Lambda updates
3. Developers create feature branches: `<name>/feature/xyz`
4. PRs merge to `develop` → auto-deploy to shared `dev`

---

## 📝 Lessons Learned

### CDK Best Practices for Multi-Environment
1. **Always make stack IDs environment-specific**
   - Use environment suffix in stack constructor ID
   - Prevents CloudFormation naming conflicts

2. **Avoid CloudFormation exports unless necessary**
   - Use direct prop passing via CDK instead
   - Exports create tight coupling and naming conflicts

3. **Clean up failed stacks before redeploying**
   - S3 buckets must be deleted manually
   - ROLLBACK_COMPLETE stacks must be deleted

4. **CDK deployments can't run in parallel**
   - All use same `cdk.out/` directory for synthesis
   - Must deploy sequentially

5. **Test deployment in one environment first**
   - Find all issues before scaling to multiple environments
   - Fixes apply to all subsequent deployments

---

## 🔍 Verification Checklist

After each environment deploys:

### CloudFormation
- [ ] All 27 stacks show `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- [ ] No stacks in `ROLLBACK` or `FAILED` state

### S3 Buckets
- [ ] 5 buckets exist with correct naming convention
- [ ] Buckets are in us-east-2 region
- [ ] Lambda deployment bucket contains ZIP files

### DynamoDB
- [ ] 31 tables exist with correct naming convention
- [ ] Tables have correct key schemas (PK, SK)
- [ ] GSIs created where needed
- [ ] All tables are empty (0 items)

### Lambda Functions
- [ ] 130 functions exist with correct naming
- [ ] All functions use Python 3.9, 3.11, 3.12, or Node.js 18.x, 20.x
- [ ] Environment variables correctly set
- [ ] Lambda layer attached where needed

### APIs
- [ ] 3 REST APIs exist and are accessible
- [ ] 2 GraphQL APIs exist
- [ ] Cognito authorizers configured correctly
- [ ] Test OPTIONS request returns CORS headers

### Cognito
- [ ] User Pool exists with correct configuration
- [ ] User Pool Client exists
- [ ] Identity Pool exists
- [ ] Test user can be created

### Queues & Topics
- [ ] 5 SQS queues exist
- [ ] 2 SNS topics exist
- [ ] EventBridge rules exist with Lambda targets

### Monitoring
- [ ] CloudWatch alarms exist
- [ ] CloudWatch dashboard exists
- [ ] Log groups created for Lambda functions

---

## 📞 Support

If deployment fails:
1. Check CloudFormation console for detailed error messages
2. Review deployment logs: `deployment-logs/<env>-deployment.log`
3. Check CDK synthesis: `npx cdk synth -c environment=<env> -c region=us-east-2`
4. Validate configuration: `cat config/environments/<env>-us-east-2.json`

---

**Last Updated:** October 26, 2025 11:45 AM
**Status:** 🟡 Jaspal deployment in progress
**Next Update:** After Jaspal completes

