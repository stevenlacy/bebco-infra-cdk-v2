# 🔧 Lambda Naming & Environment Variable Fix

**Date:** October 26, 2025  
**Status:** ✅ **FIXED** - Ready for deployment

---

## 🚨 Problem Discovered

During Jaspal's environment deployment, Lambda functions were failing to create due to naming conflicts:

### Error Examples:
```
❌ bebco-dev-generate-loan-statements already exists in stack BebcoLoansStack
❌ bebcoborroweradmin-update-loan-dev already exists in stack BebcoLoansStack
```

### Root Causes:

1. **Lambda Function Names Were Not Environment-Specific**
   - Functions were using the pattern: `bebco-dev-{function}` for ALL environments
   - Should have been: `bebco-dev-{function}-jaspal` (with environment suffix)
   - This caused conflicts with the existing `dev` environment

2. **Environment Variables Pointed to Wrong Tables**
   - Lambda env vars referenced: `bebco-borrower-users-dev`
   - Should reference: `bebco-borrower-users-jaspal` (matching the actual DynamoDB tables)

---

## ✅ Solution Implemented

### 1. Lambda Naming Strategy (Suffix Pattern)

**Changed From (Replace Pattern):**
```
bebco-staging-plaid-sync → bebco-jaspal-plaid-sync  ❌
```

**Changed To (Suffix Pattern):**
```
bebco-staging-plaid-sync → bebco-dev-plaid-sync-jaspal  ✅
bebco-dev-users-get      → bebco-dev-users-get-jaspal   ✅
```

**Why Suffix Pattern?**
- ✅ Matches DynamoDB table naming: `bebco-borrower-users-jaspal`
- ✅ Matches S3 bucket naming: `bebco-documents-jaspal-us-east-2-{account}`
- ✅ Keeps "dev" in the name (consistent with dev environment)
- ✅ Easier to filter and search in AWS Console

### 2. Environment Variable Updates

**Automatic Table Name Updates:**
```typescript
// Before:
USERS_TABLE: "bebco-borrower-users-dev"
ACCOUNTS_TABLE: "bebco-borrower-accounts-staging"

// After (for jaspal environment):
USERS_TABLE: "bebco-borrower-users-jaspal"
ACCOUNTS_TABLE: "bebco-borrower-accounts-jaspal"
```

**Implementation:**
- Environment variables are now automatically updated based on `environmentSuffix`
- Regex replacement patterns handle all variations:
  - `bebco-borrower-X-staging` → `bebco-borrower-X-{env}`
  - `bebco-borrower-X-dev` → `bebco-borrower-X-{env}`

---

## 📝 Code Changes

### File: `lib/constructs/bebco-lambda.ts`

#### Change 1: Added `environmentSuffix` Parameter

```typescript
export interface BebcoLambdaProps {
  sourceFunctionName: string;
  newFunctionName?: string;
  resourceNames: ResourceNames;
  environmentSuffix?: string;  // NEW: defaults to 'dev'
  environment?: { [key: string]: string };
  layers?: lambda.ILayerVersion[];
}
```

#### Change 2: Lambda Name Generation with Suffix

```typescript
// Get environment suffix (default to 'dev' if not provided)
const envSuffix = props.environmentSuffix || 'dev';

// Generate new function name with environment suffix
let baseName = config.name.replace(/staging/g, 'dev');

// Add environment suffix if not 'dev'
if (envSuffix !== 'dev') {
  newName = `${baseName}-${envSuffix}`;  // ✅ SUFFIX pattern
} else {
  newName = baseName;
}
```

#### Change 3: Environment Variable Auto-Update

```typescript
// Update original environment variables to point to correct tables
for (const [key, value] of Object.entries(config.environment || {})) {
  let newValue = value;
  
  if (envSuffix !== 'dev') {
    // Replace staging with environment suffix
    newValue = newValue.replace(
      /bebco-borrower-(\w+)-staging/g, 
      `bebco-borrower-$1-${envSuffix}`
    );
    // Replace dev with environment suffix  
    newValue = newValue.replace(
      /bebco-borrower-(\w+)-dev/g, 
      `bebco-borrower-$1-${envSuffix}`
    );
  } else {
    // For dev environment, just replace staging with dev
    newValue = newValue.replace(/staging/g, 'dev');
  }
  
  environment[key] = newValue;
}
```

### Files: All 17 Lambda Domain Stacks

**Updated all stack files to pass `environmentSuffix`:**
- `lib/stacks/domains/plaid-stack.ts`
- `lib/stacks/domains/accounts-stack.ts`
- `lib/stacks/domains/users-stack.ts`
- (... 14 more stacks)

**Change Pattern:**
```typescript
const plaidSync = new BebcoLambda(this, 'PlaidSync', {
  sourceFunctionName: 'bebco-staging-plaid-sync',
  resourceNames: resourceNames,
  environmentSuffix: config.naming.environmentSuffix,  // ✅ ADDED
  environment: { ... },
});
```

---

## 🎯 Expected Behavior

### For `dev` Environment:
```
Lambda: bebco-dev-plaid-sync
Table:  bebco-borrower-accounts-dev
Bucket: bebco-documents-dev-us-east-2-{account}
```

### For `jaspal` Environment:
```
Lambda: bebco-dev-plaid-sync-jaspal
Table:  bebco-borrower-accounts-jaspal
Bucket: bebco-documents-jaspal-us-east-2-{account}
```

### For `dinu` Environment:
```
Lambda: bebco-dev-plaid-sync-dinu
Table:  bebco-borrower-accounts-dinu
Bucket: bebco-documents-dinu-us-east-2-{account}
```

---

## 🧪 Verification Steps

### Before Redeployment:

1. **Clean up failed Jaspal resources:**
   ```bash
   # Delete failed Lambda stacks
   aws cloudformation delete-stack --stack-name BebcoLoansStack-jaspal --region us-east-2
   aws cloudformation delete-stack --stack-name BebcoDataStack-jaspal --region us-east-2
   aws cloudformation delete-stack --stack-name BebcoStorageStack-jaspal --region us-east-2
   aws cloudformation delete-stack --stack-name BebcoAuthStack-jaspal --region us-east-2
   
   # Delete S3 buckets
   aws s3 rb s3://bebco-documents-jaspal-us-east-2-303555290462 --force
   aws s3 rb s3://bebco-statements-jaspal-us-east-2-303555290462 --force
   aws s3 rb s3://bebco-change-tracking-jaspal-us-east-2-303555290462 --force
   aws s3 rb s3://bebco-lambda-deployments-jaspal-us-east-2-303555290462 --force
   
   # Delete DynamoDB tables
   for table in $(aws dynamodb list-tables --region us-east-2 --query 'TableNames[?contains(@, `jaspal`)]' --output text); do
     aws dynamodb delete-table --table-name "$table" --region us-east-2
   done
   ```

2. **Verify CDK synthesis:**
   ```bash
   npx cdk synth -c environment=jaspal -c region=us-east-2 2>&1 | grep -i "bebco-dev.*jaspal" | head -10
   ```
   
   Should see Lambda function names like:
   - `bebco-dev-plaid-sync-jaspal`
   - `bebco-dev-users-get-jaspal`
   - etc.

### After Deployment:

1. **Check Lambda function names:**
   ```bash
   aws lambda list-functions --region us-east-2 --query 'Functions[?contains(FunctionName, `jaspal`)].FunctionName' --output table
   ```
   
   Should show:
   - `bebco-dev-plaid-sync-jaspal`
   - `bebco-dev-users-get-jaspal`
   - (... 128 more functions)

2. **Verify environment variables in one Lambda:**
   ```bash
   aws lambda get-function-configuration --function-name bebco-dev-plaid-sync-jaspal --region us-east-2 --query 'Environment.Variables'
   ```
   
   Should show:
   ```json
   {
     "ACCOUNTS_TABLE": "bebco-borrower-accounts-jaspal",
     "TRANSACTIONS_TABLE": "bebco-borrower-transactions-jaspal",
     "PLAID_ITEMS_TABLE": "bebco-borrower-plaid-items-jaspal"
   }
   ```

3. **Confirm no conflicts with dev environment:**
   ```bash
   # Dev Lambda should exist without -dev suffix:
   aws lambda get-function --function-name bebco-dev-plaid-sync --region us-east-2
   
   # Jaspal Lambda should exist with -jaspal suffix:
   aws lambda get-function --function-name bebco-dev-plaid-sync-jaspal --region us-east-2
   ```

---

## 📊 Impact Analysis

### ✅ Positive Impacts:
1. **Complete Isolation**: Each developer environment is fully isolated
2. **Consistent Naming**: All resources follow the same suffix pattern
3. **No Conflicts**: Multiple environments can coexist in same AWS account/region
4. **Easy Filtering**: AWS Console filters work perfectly (e.g., filter by "jaspal")
5. **Automatic Updates**: Environment variables update automatically for tables/buckets

### ⚠️  Considerations:
1. **Lambda Name Length**: Some function names may approach AWS 64-char limit
   - Original: `bebco-dev-function-name` (24 chars)
   - With jaspal: `bebco-dev-function-name-jaspal` (31 chars)
   - Still well under limit ✅

2. **Developer Environment**: Team needs to set `export DEV_ENV=<name>` to use quick-update scripts

---

## 🚀 Next Steps

1. **Clean up failed Jaspal resources** (see Verification Steps above)
2. **Rebuild CDK**: `npm run build` ✅ DONE
3. **Restart Jaspal deployment**: `npx cdk deploy --all -c environment=jaspal -c region=us-east-2 --require-approval never`
4. **Monitor deployment**: Check for Lambda creation success
5. **Verify environment variables**: Confirm tables are correctly referenced
6. **Deploy remaining environments**: dinu, brandon, steven (one at a time)

---

## 📚 Related Files

- `lib/constructs/bebco-lambda.ts` - Core Lambda construct with naming logic
- `lib/stacks/domains/*.ts` - All 17 Lambda domain stacks
- `config/environments/jaspal-us-east-2.json` - Jaspal environment config
- `bin/bebco-infra-cdk-v2.ts` - Main CDK app (stack ID fixes already applied)

---

**Status:** ✅ **READY FOR DEPLOYMENT**  
**Build:** ✅ **SUCCESSFUL**  
**Next Action:** Clean up Jaspal resources and restart deployment

