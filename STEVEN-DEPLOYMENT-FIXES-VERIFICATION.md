# Steven Environment Deployment Fixes - CDK Verification

This document summarizes all issues fixed during the Steven environment deployment and verifies that CDK is updated to prevent these issues in future deployments.

## Issues Fixed and CDK Verification

### 1. ✅ Cognito Groups Missing - "Access denied. Admin privileges required"

**Issue**: Cognito user created before groups existed, causing authorization failures.

**Fix Applied**:
- Created Cognito groups manually: `AdminUsers`, `SuperAdmins`, `BEBCOAdmins`
- Added user to `AdminUsers` group

**CDK Update**: ✅ **SAVED**
- File: `bebco-infra-cdk-v2/lib/stacks/auth-stack.ts`
- Lines 64-80: Automatically creates all three Cognito groups on deployment
- Future deployments will automatically create these groups

**Verification**:
```typescript
// Lines 64-80 in auth-stack.ts
new cognito.CfnUserPoolGroup(this, 'AdminUsersGroup', {
  userPoolId: this.userPool.userPoolId,
  groupName: 'AdminUsers',
  description: 'Admin Users',
});
// ... SuperAdmins and BEBCOAdmins groups also created
```

---

### 2. ✅ CORS Policy Errors

**Issue**: API Gateway CORS configuration missing `Access-Control-Allow-Methods` header.

**Fix Applied**:
- Fixed syntax error in `gatewayResponseHeaders` object
- Added missing `Access-Control-Allow-Methods` header

**CDK Update**: ✅ **SAVED**
- File: `bebco-infra-cdk-v2/lib/stacks/api/admin-api-stack-generated.ts`
- Lines 71-75: Correct CORS headers configured with all required methods

**Verification**:
```typescript
// Lines 71-75 in admin-api-stack-generated.ts
const gatewayResponseHeaders: { [key: string]: string } = {
  'Access-Control-Allow-Origin': "'*'",
  'Access-Control-Allow-Headers': `'${corsAllowedHeadersString}'`,
  'Access-Control-Allow-Methods': `'${corsAllowedMethodsString}'`,
};
```

---

### 3. ✅ Monthly Reports Dashboard Showing "0" Data

**Issue**: 
- Missing `MONTHLY_REPORTINGS_TABLE` environment variable
- Missing GSIs: `StatusIndex` and `CompanyMonthIndex`
- Missing GSI query permissions

**Fix Applied**:
- Added `MONTHLY_REPORTINGS_TABLE` and `COMPANIES_TABLE` environment variables
- Added GSIs to `monthlyReportings` table
- Added `dynamodb:Query` permissions on GSIs

**CDK Updates**: ✅ **SAVED**

**Reporting Stack** (`bebco-infra-cdk-v2/lib/stacks/domains/reporting-stack.ts`):
- Lines 27-31: `commonEnv` includes `MONTHLY_REPORTINGS_TABLE` and `COMPANIES_TABLE`
- Lines 43-46, 58-61, 73-78, 90-93, 223-226: GSI query permissions for all monthly reports functions

**Data Stack** (`bebco-infra-cdk-v2/lib/stacks/data-stack.ts`):
- Lines 145-156: `StatusIndex` and `CompanyMonthIndex` GSIs added to `monthlyReportings` table

**Verification**:
```typescript
// reporting-stack.ts lines 27-31
const commonEnv = {
  REGION: this.region,
  MONTHLY_REPORTINGS_TABLE: tables.monthlyReportings.tableName,
  COMPANIES_TABLE: tables.companies.tableName,
};

// data-stack.ts lines 145-156
this.tables.monthlyReportings.addGlobalSecondaryIndex({
  indexName: 'StatusIndex',
  partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'month', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
this.tables.monthlyReportings.addGlobalSecondaryIndex({
  indexName: 'CompanyMonthIndex',
  partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'month', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

---

### 4. ✅ Borrowers Page Showing "0" Borrowers

**Issue**: 
- Missing `BANKS_TABLE` environment variable
- Missing DynamoDB permissions on `loans` and `banks` tables (including GSIs)

**Fix Applied**:
- Added `BANKS_TABLE` to `commonEnv`
- Added `grantReadDataWithQuery` permissions for `loans` and `banks` tables

**CDK Update**: ✅ **SAVED**
- File: `bebco-infra-cdk-v2/lib/stacks/domains/borrowers-stack.ts`
- Line 35: `BANKS_TABLE: tables.banks.tableName` added to `commonEnv`
- Line 67: `grantReadDataWithQuery(adminBorrowersList.function, tables.companies, tables.users, tables.loans, tables.banks)`

**Verification**:
```typescript
// borrowers-stack.ts lines 28-38
const commonEnv = {
  REGION: this.region,
  TABLE_NAME: tables.loans.tableName,
  COMPANIES_TABLE: tables.companies.tableName,
  USERS_TABLE: tables.users.tableName,
  ACCOUNTS_TABLE: tables.accounts.tableName,
  LOANS_TABLE: tables.loans.tableName,
  BANKS_TABLE: tables.banks.tableName,  // ✅ Added
  TRANSACTIONS_TABLE: tables.transactions.tableName,
  DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
};

// Line 67
grantReadDataWithQuery(adminBorrowersList.function, tables.companies, tables.users, tables.loans, tables.banks);
```

---

### 5. ✅ Cases Page Showing "0" Cases

**Issue**: 
- Lambda querying non-existent `PK`/`SK` attributes instead of using `CompanyIndex` GSI
- Missing `DYNAMODB_TABLE` environment variable
- Missing GSI query permissions

**Fix Applied**:
- Fixed Lambda source code to use `CompanyIndex` GSI
- Updated Lambda package in `dist/lambda-packages/bebco-staging-cases-list.zip`
- Added `DYNAMODB_TABLE` environment variable
- Added GSI query permissions

**CDK Updates**: ✅ **SAVED**

**Cases Stack** (`bebco-infra-cdk-v2/lib/stacks/domains/cases-stack.ts`):
- Lines 27-32: `commonEnv` includes `DYNAMODB_TABLE: tables.loanLoc.tableName`
- Lines 56-61: `grantReadDataWithQuery` and GSI query permissions

**Data Stack** (`bebco-infra-cdk-v2/lib/stacks/data-stack.ts`):
- Lines 277-284: `CompanyIndex` GSI added to `loan-loc` table

**Lambda Source Code** (`BorrowerPortal/lambda_functions/cases/list_cases.py`):
- Lines 317-343: `query_cases_by_company` uses `CompanyIndex` GSI
- Lambda package updated in `dist/lambda-packages/bebco-staging-cases-list.zip`

**Verification**:
```typescript
// cases-stack.ts lines 27-32
const commonEnv = {
  REGION: this.region,
  DYNAMODB_TABLE: tables.loanLoc.tableName,
  DYNAMODB_REGION: this.region,
};

// cases-stack.ts lines 56-61
grantReadDataWithQuery(casesList.function, tables.loanLoc);
casesList.function.addToRolePolicy(new iam.PolicyStatement({
  actions: ['dynamodb:Query'],
  resources: [`${tables.loanLoc.tableArn}/index/*`],
}));

// data-stack.ts lines 277-284
if (tableName === 'loan-loc') {
  table.addGlobalSecondaryIndex({
    indexName: 'CompanyIndex',
    partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });
}
```

---

### 6. ✅ Hardcoded "staging" Table Names/ARNs

**Issue**: Hardcoded references to staging tables and ARNs in Lambda packages and CDK.

**Fix Applied**: Replaced all hardcoded references with environment-specific table names/ARNs using CDK constructs.

**CDK Updates**: ✅ **SAVED**

**Payments Stack** (`bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`):
- Lines 62-67: Uses `grantReadDataWithQuery` and table references instead of hardcoded ARNs

**Invoices Stack** (`bebco-infra-cdk-v2/lib/stacks/domains/invoices-stack.ts`):
- Line 31: `LEDGER_ENTRIES_TABLE: tables.ledgerEntries.tableName` added
- Line 57: `tables.ledgerEntries.grantReadData(invoicesGet.function)` added
- Lines 70-72: Uses table references instead of hardcoded ARNs

**Borrowers Stack** (`bebco-infra-cdk-v2/lib/stacks/domains/borrowers-stack.ts`):
- Lines 146-149: Uses `tables.loans.tableArn` instead of hardcoded ARN

**Verification**:
```typescript
// invoices-stack.ts line 31
LEDGER_ENTRIES_TABLE: tables.ledgerEntries.tableName,

// invoices-stack.ts line 57
tables.ledgerEntries.grantReadData(invoicesGet.function);

// All stacks use grantReadDataWithQuery() and table references instead of hardcoded ARNs
```

---

## Summary

✅ **All fixes are saved in CDK** - Future deployments will include:
1. Automatic Cognito group creation
2. Correct CORS headers
3. Monthly reports GSIs, environment variables, and permissions
4. Borrowers list permissions and `BANKS_TABLE` environment variable
5. Cases query fixes using `CompanyIndex` GSI with proper permissions
6. No hardcoded table names/ARNs - all use CDK table references

✅ **Lambda packages updated**:
- `bebco-staging-cases-list.zip` contains fixed source code using `CompanyIndex` GSI
- Package located in `bebco-infra-cdk-v2/dist/lambda-packages/`

✅ **Source code fixes**:
- `BorrowerPortal/lambda_functions/cases/list_cases.py` uses `CompanyIndex` GSI
- `BorrowerPortal/lambda_functions/shared/dynamodb_client.py` reads `DYNAMODB_TABLE` from environment

## Verification Checklist

- [x] Auth stack creates Cognito groups automatically
- [x] Admin API stack has correct CORS headers
- [x] Reporting stack has monthly reports GSIs, env vars, and permissions
- [x] Borrowers stack has `BANKS_TABLE` and loan/bank permissions
- [x] Cases stack has `DYNAMODB_TABLE` and GSI permissions
- [x] Data stack has `CompanyIndex` GSI on `loan-loc` table
- [x] Data stack has `StatusIndex` and `CompanyMonthIndex` GSIs on `monthlyReportings` table
- [x] Payments stack uses table references, no hardcoded ARNs
- [x] Invoices stack has `LEDGER_ENTRIES_TABLE` and uses table references
- [x] Lambda package updated with fixed cases query code

All fixes are verified and saved in CDK for future deployments! 🎉


