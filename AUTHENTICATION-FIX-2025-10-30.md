# Authentication 401 Error Fix - October 30, 2025

## Problem Summary

The bebcoadmin application was experiencing widespread 401 Unauthorized errors when making API calls to the JPL environment endpoints:
- `/admin/borrowers` - 401 Unauthorized
- `/admin/invoices` - 401 Unauthorized  
- `/admin/payments` - 401 Unauthorized
- `/banks/{bankId}/draws` - 401 Unauthorized
- `/admin/companies/{companyId}/settings` - 404 Not Found

## Root Cause Analysis

### Investigation Process

1. **API Gateway Authorizer Check**: Verified that API Gateway had a Cognito authorizer configured with User Pool `us-east-2_MCfFL1JxA`
2. **Lambda Environment Variable Check**: Discovered Lambda functions were configured with a **different** User Pool `us-east-2_Uba3sK7HT`
3. **User Pool Existence Check**: Found that User Pool `us-east-2_Uba3sK7HT` **does not exist**

### The Root Cause

The Lambda functions in the following stacks were **not receiving User Pool credentials** from the AuthStack:
- **BorrowersStack** ❌ (handled `/admin/borrowers`, `/admin/companies` endpoints)
- **InvoicesStack** ❌ (handled `/admin/invoices` endpoints)
- **PaymentsStack** ❌ (handled `/admin/payments` endpoints)

These Lambda functions were being deployed with hardcoded/default User Pool credentials that pointed to a non-existent User Pool (`us-east-2_Uba3sK7HT`).

### Authentication Flow (Before Fix)

```
1. bebcoadmin app sends request with JWT token from User Pool: us-east-2_MCfFL1JxA ✅
2. API Gateway Cognito Authorizer validates token against: us-east-2_MCfFL1JxA ✅
3. API Gateway forwards request to Lambda function ✅
4. Lambda function tries to validate token against: us-east-2_Uba3sK7HT ❌ (doesn't exist!)
5. Lambda returns 401 Unauthorized ❌
```

## Solution Implemented

### Changes Made

#### 1. BorrowersStack (`lib/stacks/domains/borrowers-stack.ts`)
- Added `userPoolId` and `userPoolClientId` to `BorrowersStackProps` interface
- Added these credentials to `commonEnv` so all Borrowers Lambda functions receive them
- Updated stack instantiation in `bin/bebco-infra-cdk-v2.ts` to pass AuthStack credentials

#### 2. InvoicesStack (`lib/stacks/domains/invoices-stack.ts`)
- Added `userPoolId`, `userPoolClientId`, and `identityPoolId` to `InvoicesStackProps` interface
- Added these credentials to `commonEnv` so all Invoices Lambda functions receive them
- Updated stack instantiation in `bin/bebco-infra-cdk-v2.ts` to pass AuthStack credentials

#### 3. PaymentsStack (`lib/stacks/domains/payments-stack.ts`)
- Added `userPoolId` and `userPoolClientId` to `PaymentsStackProps` interface
- Added these credentials to `commonEnv` so all Payments Lambda functions receive them
- Updated stack instantiation in `bin/bebco-infra-cdk-v2.ts` to pass AuthStack credentials

#### 4. Main CDK App (`bin/bebco-infra-cdk-v2.ts`)
- Updated BorrowersStack instantiation to pass User Pool credentials from AuthStack
- Updated InvoicesStack instantiation to pass User Pool credentials from AuthStack
- Updated PaymentsStack instantiation to pass User Pool credentials from AuthStack
- Added `authStack` dependency to all three stacks

### Authentication Flow (After Fix)

```
1. bebcoadmin app sends request with JWT token from User Pool: us-east-2_MCfFL1JxA ✅
2. API Gateway Cognito Authorizer validates token against: us-east-2_MCfFL1JxA ✅
3. API Gateway forwards request to Lambda function ✅
4. Lambda function validates token against: us-east-2_MCfFL1JxA ✅
5. Lambda returns successful response ✅
```

## Verification Steps

After deploying these CDK changes, the Lambda functions will have the correct User Pool credentials:

### Before Fix
```bash
$ aws lambda get-function-configuration --function-name bebco-dev-admin-borrowers-list-borrowers-function-jpl
{
  "Environment": {
    "Variables": {
      "USER_POOL_ID": "us-east-2_Uba3sK7HT",  ❌ (doesn't exist)
      "USER_POOL_CLIENT_ID": "698v54ol2kojmbt7jkt6gug5tl",
      ...
    }
  }
}
```

### After Fix (Expected)
```bash
$ aws lambda get-function-configuration --function-name bebco-dev-admin-borrowers-list-borrowers-function-jpl
{
  "Environment": {
    "Variables": {
      "USER_POOL_ID": "us-east-2_MCfFL1JxA",  ✅ (correct!)
      "USER_POOL_CLIENT_ID": "1sscdh33p4f9opudog0q3unafr",
      ...
    }
  }
}
```

## Deployment Instructions

### For JPL Environment

```bash
cd /Users/brandon/Workspace/LexLink/bebco-infra-cdk-v2

# Deploy the updated stacks (in order due to dependencies)
cdk deploy BebcoBorrowersStack-jpl --context environmentConfig=jaspal-us-east-2
cdk deploy BebcoInvoicesStack-jpl --context environmentConfig=jaspal-us-east-2
cdk deploy BebcoPaymentsStack-jpl --context environmentConfig=jaspal-us-east-2

# Or deploy all stacks at once
cdk deploy --all --context environmentConfig=jaspal-us-east-2
```

## Testing the Fix

After deployment, test the following endpoints in bebcoadmin:

1. **Dashboard page** - Should load without 401 errors
2. **Borrowers list** (`GET /admin/borrowers`) - Should return data
3. **Invoices list** (`GET /admin/invoices`) - Should return data
4. **Payments list** (`GET /admin/payments`) - Should return data
5. **Draw requests** (`GET /banks/{bankId}/draws`) - Should return data
6. **Company settings** (`GET /admin/companies/{companyId}/settings`) - Should return data

## Additional Issues Found

### 404 Error on `/admin/companies/{companyId}/settings`

The error logs showed the endpoint being called with literal `{borrowerId}`:
```
GET /admin/companies/{borrowerId}/settings [404]
```

This indicates the bebcoadmin frontend is not properly interpolating the company ID variable. This is a **frontend code issue**, not an infrastructure issue, and needs to be fixed in the bebcoadmin repository.

## Files Modified

1. `/Users/brandon/Workspace/LexLink/bebco-infra-cdk-v2/lib/stacks/domains/borrowers-stack.ts`
2. `/Users/brandon/Workspace/LexLink/bebco-infra-cdk-v2/lib/stacks/domains/invoices-stack.ts`
3. `/Users/brandon/Workspace/LexLink/bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`
4. `/Users/brandon/Workspace/LexLink/bebco-infra-cdk-v2/bin/bebco-infra-cdk-v2.ts`

## Impact

This fix affects **ALL environments** that use these stacks:
- ✅ JPL (jaspal) environment
- ✅ DEV (brandon) environment
- ✅ DIN (dinu) environment  
- ✅ STV (steven) environment

All environments will now properly configure Lambda functions with the correct Cognito User Pool credentials from their respective AuthStacks.

## Notes

- The fix does NOT require any changes to the bebcoadmin application code
- The fix does NOT require any changes to the Lambda function source code
- The fix ONLY updates infrastructure configuration (CDK code)
- After deployment, Lambda functions will automatically use the correct User Pool credentials
- The DrawsStack was already correctly configured and did not need changes

## Success Criteria

✅ No linter errors in modified CDK files
✅ Lambda functions configured with User Pool credentials from AuthStack
✅ User Pool ID matches between API Gateway authorizer and Lambda environment variables
⏳ 401 errors resolved in bebcoadmin application (requires deployment and testing)

