# Migration Fixes Session - October 31, 2025

## Overview
This document memorializes the critical fixes applied during the us-east-1 to us-east-2 CDK migration for the BEBCO Admin Portal. All issues stemmed from hardcoded table names, incorrect environment variable usage, and schema mismatches between the legacy and migrated environments.

---

## 1. Payment Creation Errors

### Issue
- Payment creation failed with 500 Internal Server Error
- `AccessDeniedException` when trying to access companies and loans tables

### Root Cause
- `bebco-dev-payments-create-stv` Lambda had hardcoded table name `bebco-borrower-staging-companies`
- Lambda lacked DynamoDB read permissions on companies, invoices, and monthly reportings tables
- Lambda lacked write permissions on loan-loc table

### Fixes Implemented
**Backend (Lambda)**:
- Updated `BorrowerPortal/lambda_functions/payments/create_payments.py`:
  - Added environment variable reads: `PAYMENTS_TABLE`, `COMPANIES_TABLE`, `LOANS_TABLE`, `INVOICES_TABLE`
  - Removed all hardcoded `bebco-borrower-staging-*` table names
  - Added validation to require environment variables

**Backend (Shared Module)**:
- Updated `BorrowerPortal/lambda_functions/shared/dynamodb_client.py`:
  - Modified `__init__` to require `DYNAMODB_TABLE` env var (no fallback to staging)
  - Raises `ValueError` if environment variable not set

**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`:
  - Added `LOANS_TABLE`, `INVOICES_TABLE`, `BANKS_TABLE`, `ACH_BATCHES_TABLE`, `DOCUMENTS_S3_BUCKET` to `commonEnv`
  - Granted `readWriteDataWithQuery` on `payments` and `loans` tables
  - Granted `readDataWithQuery` on `companies`, `invoices`, `monthlyReportings` tables
  - Granted S3 read/write on documents bucket

**Deployment**:
- ✅ `BebcoPaymentsStack-stv`

---

## 2. Mark Payment as Failed

### Issue
- Clicking "Mark as Failed" on payments returned 404 Not Found

### Root Cause
- API Gateway routing `/admin/payments/{paymentId}` PUT to wrong Lambda
- Lambda function index shifted after adding `bebco-dev-invoices-update` to the array
- `admin_payments_paymentId` was calling `fn8` (allocations Lambda) instead of `fn34` (ACH batches Lambda which handles status updates)

### Fixes Implemented
**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/api/admin-api-stack-generated.ts`:
  - Added `bebco-dev-invoices-update` to Lambda names array
  - Fixed index mapping: `admin_payments_paymentId.addMethod('PUT', fn34)` (was `fn33`, became `fn34` after shift)
  - Updated ALL subsequent function indexes to account for the shift

**Deployment**:
- ✅ `BebcoAdminApiStack-stv`

---

## 3. Mark Payment as Failed - Permissions

### Issue
- After fixing routing, Lambda returned `AccessDeniedException` on DynamoDB tables

### Root Cause
- `bebco-dev-payments-ach-batches-stv` Lambda had hardcoded table names
- Lambda lacked DynamoDB permissions on payments, invoices, banks, loans tables

### Fixes Implemented
**Backend**:
- Updated `AdminPortal/lambda_functions/payments/process_batch_payments.py`:
  - Changed hardcoded table names to read from environment variables
  - Added validation to require: `PAYMENTS_TABLE`, `BANKS_TABLE`, `INVOICES_TABLE`, `LOANS_TABLE`, `DOCUMENTS_S3_BUCKET`

**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`:
  - Granted `readWriteDataWithQuery` on `payments`, `invoices`, `achBatches` tables
  - Granted `readDataWithQuery` on `companies`, `banks`, `loans` tables  
  - Granted S3 `readWrite` on documents bucket

**Deployment**:
- ✅ `BebcoPaymentsStack-stv`

---

## 4. Payment Sorting

### Issue
- Failed payments not visible in "All" tab
- Payments not sorted by priority (New, Failed, Processed)

### Root Cause
- Frontend sort logic prioritized: New > Processed > Failed
- User expected: New > Failed > Processed

### Fixes Implemented
**Frontend**:
- Updated `AdminPortal/src/app/payments/page.tsx`:
  - Changed `statusRank` function from `(New: 0, Processed: 1, Failed: 2)` to `(New: 0, Failed: 1, Processed: 2)`

---

## 5. Invoice Display - Wrong Table

### Issue
- Invoices not displaying
- Invoices being written to separate `bebco-borrower-invoices-stv` table

### Root Cause
- During CDK migration, invoices were incorrectly configured to use a separate `invoices` table
- **Invoices are actually stored in the `loan-loc` table** with `PK=COMPANY#{company_id}` and `SK=INVOICE#{invoice_id}` pattern

### Fixes Implemented
**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/domains/invoices-stack.ts`:
  - Changed `INVOICES_TABLE` env var from `tables.invoices.tableName` to `tables.loanLoc.tableName`
  - Updated `DYNAMODB_TABLE` backcompat vars to point to `loanLoc`
  - Granted all invoice Lambdas permissions on `loanLoc` table instead of `invoices` table

**Backend**:
- Updated `AdminPortal/lambda_functions/invoices/list_invoices.py`:
  - Added validation to require `INVOICES_TABLE` environment variable
  - Removed hardcoded `bebco-borrower-staging-invoices` fallback

- Updated `AdminPortal/lambda_functions/invoices/create_invoices.py`:
  - Added validation to require `INVOICES_TABLE` environment variable

**Deployment**:
- ✅ `BebcoInvoicesStack-stv`

---

## 6. Mark Invoice as Paid - Schema Mismatch

### Issue
- Marking invoices as paid failed with 400 Bad Request
- $0 invoices failed validation in waive Lambda

### Root Cause
- Waive Lambda used legacy `PK/SK` schema pattern
- **loan-loc table uses `id` as primary key**, not `PK/SK`
- Waive Lambda rejected $0 amounts as invalid

### Fixes Implemented
**Database Schema**:
- Added `MonthlyReportIndex` GSI to `loan-loc` table:
  - Partition key: `monthly_report_id`
  - Allows lookup of invoices by their associated monthly report

**Backend**:
- Updated `AdminPortal/lambda-functions/admin-payments-waive/app.py`:
  - Changed all DynamoDB operations from `Key={'PK': ..., 'SK': ...}` to `Key={'id': invoice_id}`
  - Added security check: `ConditionExpression='attribute_exists(id) AND company_id = :company_id'`
  - Added special handling for $0 invoices (mark as paid without waiving)

**Frontend**:
- Updated `AdminPortal/src/services/api.ts`:
  - Added `updateInvoice()` method for direct invoice updates
  - Modified `markInvoiceAsPaid()` to detect invoice type (loan payment vs service fee/late fee)
  - Service fees/late fees update directly without monthly report
  - Loan payments use waive flow with monthly report

- Updated `AdminPortal/src/app/invoices/page.tsx`:
  - Calculate `remainingAmount = totalAmount - paidAmount` before sending to API
  - Send remaining unpaid amount instead of total amount

**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/data-stack.ts`:
  - Added `MonthlyReportIndex` GSI to loan-loc table

- Updated `bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`:
  - Set `INVOICES_TABLE` to `loanLoc` table for waive Lambda
  - Granted read/write on `loanLoc` and `monthlyReportings` tables

- Updated `bebco-infra-cdk-v2/lib/stacks/api/admin-api-stack-generated.ts`:
  - Added `PUT /admin/invoices/{invoiceId}` endpoint resource
  - Mapped to invoices-update Lambda

**Deployment**:
- ✅ `BebcoDataStack-stv` (MonthlyReportIndex GSI)
- ✅ `BebcoPaymentsStack-stv` (waive Lambda)
- ✅ `BebcoAdminApiStack-stv` (invoice update endpoint)

---

## 7. Accounts - All Showing as "Unknown Company"

### Issue
- All 314 accounts displayed under "Unknown Company"
- Accounts have valid `company_id` but no `company_name` populated

### Root Cause
- Accounts list Lambda had hardcoded `'bebco-borrower-staging-companies'` table name for company lookup
- This table doesn't exist in the steven environment
- Company name lookup failed, defaulting all to "Unknown Company"

### Fixes Implemented
**Backend**:
- Updated `AdminPortal/lambda_functions/accounts/list_accounts.py`:
  - Changed hardcoded table name to `os.environ.get('COMPANIES_TABLE')`
  - Added logging to show how many companies were found

- Updated packaged Lambda in `dist/lambda-packages/tmp-accounts-list/list_accounts.py` with same fix

**Deployment**:
- ✅ `BebcoAccountsStack-stv`

---

## 8. Admin Users Page - CORS Errors

### Issue
- Users page failed to load with CORS errors
- Requests to `/admin/users` blocked

### Root Cause
- When `bebco-dev-invoices-update` was added to Lambda array at position 33, all subsequent function indexes shifted by 1
- `admin_users` GET/POST were calling `fn36` (plaid-transactions-sync) instead of `fn37` (users-create)

### Fixes Implemented
**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/api/admin-api-stack-generated.ts`:
  - Added `bebco-dev-invoices-update` at correct position in array
  - Updated `admin_users.addMethod('GET', fn37)` (was `fn36`)
  - Updated `admin_users.addMethod('POST', fn37)` (was `fn36`)
  - Fixed ALL other endpoint mappings that shifted (auth endpoints, plaid sync, etc.)

**Deployment**:
- ✅ `BebcoAdminApiStack-stv`

---

## 9. Settings Page - Add/Edit Fund/Bank Errors

### Issues
1. Adding fund failed with CORS errors
2. Editing bank failed with CORS errors
3. Creating fund succeeded but didn't show in list
4. Banks disappeared after creating new fund

### Root Causes
**Issue 1 & 2**: Wrong API URL
- `AddEntityModal.tsx` and `EditEntityModal.tsx` were using `NEXT_PUBLIC_ADMIN_API_URL` 
- Should use `NEXT_PUBLIC_BANKS_API_URL` (secondary admin API)
- Main admin API doesn't have `/admin/banks` endpoint

**Issue 3 & 4**: Schema Mismatch
- Banks-create Lambda used `PK/SK` schema but banks table uses `id` primary key
- Banks-list Lambda looked for `EntityType` (mixed case) field
- New records saved as `entity_type` (lowercase)
- List Lambda couldn't read new records OR old records (depending on which field name was checked)

**Issue 5**: Missing Dependencies
- When repackaging banks-list Lambda, PyJWT and other dependencies were missing
- Lambda failed with `ImportModuleError: No module named 'jwt'`

**Issue 6**: CORS on Error Responses
- Secondary Admin API lacked CORS headers on 4xx/5xx responses
- Preflight worked but actual error responses blocked by CORS

**Issue 7**: Update Lambda Schema
- Banks-update Lambda used `PK/SK` schema instead of `id`

### Fixes Implemented
**Frontend**:
- Updated `AdminPortal/src/components/AddEntityModal.tsx`:
  - Changed `API_BASE_URL` from `NEXT_PUBLIC_ADMIN_API_URL` to `NEXT_PUBLIC_BANKS_API_URL`

- Updated `AdminPortal/src/components/EditEntityModal.tsx`:
  - Changed `API_BASE_URL` from `NEXT_PUBLIC_ADMIN_API_URL` to `NEXT_PUBLIC_BANKS_API_URL`

**Backend**:
- Updated `AdminPortal/lambda_functions/banks/create_bank.py`:
  - Changed from `{'PK': ..., 'SK': ..., 'EntityType': ...}` to `{'id': entity_id, 'entity_type': ...}`

- Updated `AdminPortal/lambda_functions/banks/list_banks.py`:
  - Added backwards compatibility: `entity_type_value = item.get('entity_type') or item.get('EntityType')`
  - Reads both old (EntityType) and new (entity_type) field names
  - Re-downloaded working package from us-east-1 with all dependencies (PyJWT, etc.)
  - Applied code fixes to working package

- Updated `AdminPortal/lambda_functions/banks/update_bank.py`:
  - Changed get_item from `{'PK': pk, 'SK': sk}` to `{'id': entity_id}`
  - Changed updated item schema to use `id` and `entity_type` (lowercase)

**CDK**:
- Updated `bebco-infra-cdk-v2/lib/stacks/api/admin-secondary-api-stack-generated.ts`:
  - Added Gateway Response configurations for 4xx and 5xx errors with CORS headers:
    ```typescript
    this.api.addGatewayResponse('Default4xxGatewayResponse', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    ```

**Environment**:
- Restarted AdminPortal dev server to clear Next.js build cache
- Deleted `.next` directory and rebuilt to pick up correct environment variables

**Deployment**:
- ✅ `BebcoBanksStack-stv` (banks create, list, update Lambdas)
- ✅ `BebcoAdminSecondaryApiStack-stv` (CORS headers)

---

## Key Patterns & Lessons Learned

### 1. Table Schema Differences
**Legacy (us-east-1)**: Some tables used `PK/SK` composite key pattern  
**Migrated (us-east-2)**: Tables use `id` as primary key

**Tables Affected**:
- `loan-loc` - Primary key is `id`, not `PK/SK`
- `banks` - Primary key is `id`, not `PK/SK`  
- `cases` - Primary key is `id`, not `PK/SK`
- `invoices` (in loan-loc table) - Access via `id`, not `PK/SK`

**Solution**: Update all Lambda operations to use `Key={'id': item_id}` and add security check: `ConditionExpression='attribute_exists(id) AND company_id = :company_id'`

### 2. Environment Variable Cascading Failures
**Pattern**: Lambda has hardcoded table name → reads wrong table → gets AccessDeniedException → frontend shows 500 error

**Solution**:
- Remove ALL hardcoded table names (search for `bebco-borrower-staging-*`)
- Use `os.environ.get('TABLE_NAME')` with NO fallback
- Raise errors immediately if environment variables not set
- Configure environment variables in CDK stack's `commonEnv`

### 3. DynamoDB Permissions
**Pattern**: Lambda has correct table name but lacks IAM permissions

**Solution**:
- Use helper functions: `grantReadDataWithQuery`, `grantReadWriteDataWithQuery`
- Grant permissions on ALL tables the Lambda accesses (companies, loans, invoices, etc.)
- For cross-table operations (e.g., payments needing company info), grant read on related tables

### 4. API Gateway Lambda Mapping
**Pattern**: Adding new Lambda to array shifts all subsequent function indexes

**Solution**:
- When adding Lambda to array, update ALL endpoint mappings that use functions after the insertion point
- Verify with: `aws apigateway get-integration --rest-api-id {id} --resource-id {resource} --http-method {method}`

### 5. Field Name Case Sensitivity
**Pattern**: Old records use `EntityType`, new records use `entity_type`

**Solution**: Check BOTH field names:
```python
entity_type_value = item.get('entity_type') or item.get('EntityType')
```

### 6. CORS on API Gateway
**Issue**: CORS headers present on success responses but missing on error responses (401, 403, 500)

**Solution**: Add Gateway Response configurations:
```typescript
this.api.addGatewayResponse('Default4xxGatewayResponse', {
  type: apigateway.ResponseType.DEFAULT_4XX,
  responseHeaders: corsHeaders,
});
```

### 7. Next.js Environment Variables
**Issue**: Environment variables cached in build, not updated on restart

**Solution**:
1. Delete `.next` directory
2. Kill dev server process
3. Restart dev server
4. Verify correct URLs are being called in browser network tab

---

## Summary of CDK Stacks Deployed

| Stack | Deployment Count | Key Changes |
|-------|-----------------|-------------|
| `BebcoPaymentsStack-stv` | 5 | Environment-driven table names, DynamoDB permissions, waive Lambda schema fix |
| `BebcoInvoicesStack-stv` | 1 | Point to loan-loc table, grant permissions |
| `BebcoDataStack-stv` | 1 | Add MonthlyReportIndex GSI to loan-loc |
| `BebcoAdminApiStack-stv` | 3 | Fix Lambda mappings, add invoice endpoint |
| `BebcoAccountsStack-stv` | 1 | Fix companies table lookup |
| `BebcoBanksStack-stv` | 4 | Fix schema (id vs PK/SK), backwards compat, dependencies |
| `BebcoAdminSecondaryApiStack-stv` | 1 | Add CORS headers to error responses |

**Total Deployments**: 16

---

## Testing Checklist (All Passing ✅)

- [✅] Create payment
- [✅] Mark payment as failed
- [✅] Mark payment as new (retry)
- [✅] View payment details
- [✅] List invoices (from loan-loc table)
- [✅] Mark invoice as paid ($0 invoices)
- [✅] Mark invoice as paid (loan payment invoices via waive)
- [✅] Mark invoice as paid (service fee/late fee invoices direct)
- [✅] View accounts grouped by correct company names
- [✅] List admin users
- [✅] Create fund
- [✅] Create bank
- [✅] Edit bank
- [✅] Edit fund
- [✅] List banks and funds with backwards compatibility

---

## Database Schema Documentation

### loan-loc Table (bebco-borrower-loan-loc-stv)
**Primary Key**: `id` (STRING)

**Global Secondary Indexes**:
- `CompanyIndex`: partition key `company_id`
- `GSI2`: partition key `GSI2PK`, sort key `GSI2SK`
- `KeyCasesIndex`: partition key `KeyCasesPK`, sort key `KeyCasesSK`
- `MonthlyReportIndex`: partition key `monthly_report_id` (added during migration)

**Entity Types Stored**:
- Cases (EntityType = CASE)
- Invoices (EntityType = INVOICE)
- Other loan-related entities

**Access Pattern for Invoices**:
- Query: Not via PK/SK (legacy pattern from us-east-1)
- Get by ID: `Key={'id': invoice_id}`
- Security: Verify `company_id` matches in ConditionExpression

---

## Critical Migration Principles

1. **No Hardcoded Table Names**: Every table reference MUST use environment variables
2. **No Fallback Values**: Fail fast if environment not configured (prevents silent failures)
3. **Schema Verification**: us-east-2 tables may have different primary key schema than us-east-1
4. **Backwards Compatibility**: Support both old and new field names during transition
5. **Permission Grants**: Explicitly grant DynamoDB permissions in CDK (don't rely on wildcards)
6. **CORS on Errors**: API Gateway needs CORS headers on ALL responses, not just 200s
7. **Testing After Each Fix**: Verify in browser, check CloudWatch logs, confirm database writes

---

## Files Modified

### CDK Configuration
- `bebco-infra-cdk-v2/lib/stacks/domains/payments-stack.ts`
- `bebco-infra-cdk-v2/lib/stacks/domains/invoices-stack.ts`
- `bebco-infra-cdk-v2/lib/stacks/domains/accounts-stack.ts`
- `bebco-infra-cdk-v2/lib/stacks/data-stack.ts`
- `bebco-infra-cdk-v2/lib/stacks/api/admin-api-stack-generated.ts`
- `bebco-infra-cdk-v2/lib/stacks/api/admin-secondary-api-stack-generated.ts`

### Backend Lambda Functions
- `BorrowerPortal/lambda_functions/payments/create_payments.py`
- `BorrowerPortal/lambda_functions/shared/dynamodb_client.py`
- `AdminPortal/lambda_functions/payments/process_batch_payments.py`
- `AdminPortal/lambda_functions/invoices/list_invoices.py`
- `AdminPortal/lambda_functions/invoices/create_invoices.py`
- `AdminPortal/lambda_functions/accounts/list_accounts.py`
- `AdminPortal/lambda-functions/admin-payments-waive/app.py`
- `AdminPortal/lambda_functions/banks/create_bank.py`
- `AdminPortal/lambda_functions/banks/list_banks.py`
- `AdminPortal/lambda_functions/banks/update_bank.py`

### Frontend Components
- `AdminPortal/src/app/payments/page.tsx`
- `AdminPortal/src/app/invoices/page.tsx`
- `AdminPortal/src/services/api.ts`
- `AdminPortal/src/components/AddEntityModal.tsx`
- `AdminPortal/src/components/EditEntityModal.tsx`
- `AdminPortal/src/services/borrowerPaymentBridge.ts` (earlier session)

---

## Environment Variables Configured

### Required for All Payment Lambdas:
```bash
PAYMENTS_TABLE=bebco-borrower-payments-stv
COMPANIES_TABLE=bebco-borrower-companies-stv
LOANS_TABLE=bebco-borrower-loans-stv
INVOICES_TABLE=bebco-borrower-loan-loc-stv  # Invoices in loan-loc!
BANKS_TABLE=bebco-borrower-banks-stv
MONTHLY_REPORTINGS_TABLE=bebco-borrower-monthly-reportings-stv
DOCUMENTS_S3_BUCKET=bebco-borrower-documents-stv
ACH_BATCHES_TABLE=bebco-borrower-ach-batches-stv
```

### Required for Invoice Lambdas:
```bash
INVOICES_TABLE=bebco-borrower-loan-loc-stv  # Critical: NOT a separate invoices table
COMPANIES_TABLE=bebco-borrower-companies-stv
```

### Required for Accounts Lambdas:
```bash
ACCOUNTS_TABLE=bebco-borrower-accounts-stv
COMPANIES_TABLE=bebco-borrower-companies-stv  # For company name lookup
```

---

## Known Remaining Issues

None at this time. All critical functionality tested and working.

---

## Next Steps / Recommendations

1. **Data Migration**: Standardize all existing records to use lowercase field names (`entity_type` instead of `EntityType`)
2. **Remove PK/SK Fields**: Clean up any remaining PK/SK fields in loan-loc table records
3. **Monitor CloudWatch**: Watch for any remaining hardcoded table name references in other Lambdas
4. **Schema Documentation**: Document all table schemas and access patterns for the team
5. **Integration Tests**: Create automated tests for critical paths (payment creation, invoice marking, etc.)

---

**Session Date**: October 31, 2025  
**Environment**: steven (us-east-2)  
**Migration From**: us-east-1 (staging/production)  
**Status**: ✅ All Critical Issues Resolved

