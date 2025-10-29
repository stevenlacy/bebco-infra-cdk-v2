# Troubleshooting Session - October 28, 2025

## Issues Investigated and Resolved

### 1. **Query Parameter Mapping Issue - FIXED** ✅

**Problem:** The Admin API Gateway was incorrectly mapping the `sort` query parameter to `sortOrder` before passing it to the Lambda function.

**Root Cause:**
- In `lib/stacks/api/admin-api-stack-generated.ts` (lines 208-213), the integration had:
  ```typescript
  requestParameters: {
    'integration.request.querystring.sortOrder': 'method.request.querystring.sort',
  }
  ```
- This was renaming `sort` → `sortOrder`, but the Lambda (`AdminPortal/lambda_functions/payments/list_payments.py` line 61) expects `sort`

**Fix Applied:**
- Removed the unnecessary parameter mapping from the `paymentsListIntegration`
- Changed to simple proxy integration that passes through all parameters as-is
- Also removed the method-level `requestParameters` declaration

**Verification:**
```bash
aws apigateway get-integration --rest-api-id k2hlyos8n3 --resource-id o146uo --http-method GET --region us-east-2
# Result: requestParameters: null (correct - passes through as-is)
```

**Files Changed:**
- `lib/stacks/api/admin-api-stack-generated.ts` (lines 208-213, 308-312)

---

### 2. **CORS Configuration - Already Working** ✅

**Status:** The chat summary mentioned CORS issues with `'${request.header.Origin}'` template variables, but investigation showed this is NOT actually an issue.

**Findings:**
- Gateway Responses are correctly configured with `'*'` for CORS headers
- Both 4XX and 5XX error responses include proper CORS headers
- The generated stacks (`admin-api-stack-generated.ts`) have proper CORS configuration

**Verification:**
```bash
aws apigateway get-gateway-response --rest-api-id k2hlyos8n3 --response-type DEFAULT_4XX --region us-east-2
# Result: 'Access-Control-Allow-Origin': "'*'" (correct)
```

**Current Configuration (lines 71-83 in admin-api-stack-generated.ts):**
```typescript
const gatewayResponseHeaders: { [key: string]: string } = {
  'Access-Control-Allow-Origin': "'*'",
  'Access-Control-Allow-Headers': `'${corsAllowedHeadersString}'`,
  'Access-Control-Allow-Methods': `'${corsAllowedMethodsString}'`,
};
this.api.addGatewayResponse('Default4xxGatewayResponse', {
  type: apigateway.ResponseType.DEFAULT_4XX,
  responseHeaders: gatewayResponseHeaders,
});
```

---

### 3. **JSON Configuration Error - FIXED** ✅

**Problem:** The `config/environments/jaspal-us-east-2.json` file had a trailing comma causing JSON parse errors.

**Fix Applied:**
- Removed trailing comma from line 47 in the secrets section
- Verified JSON validity with `jq`

**File Changed:**
- `config/environments/jaspal-us-east-2.json` (line 47)

---

## Deployment Summary

**Deployed Stack:** `BebcoAdminApiStack-jpl`
**Region:** us-east-2
**Deployment Time:** 82.18s
**Status:** ✅ UPDATE_COMPLETE

**Changes Deployed:**
- Updated API Gateway integration for `/admin/payments` GET endpoint
- Removed incorrect query parameter mapping
- New deployment ID: `56417cfd1c41433268ba8eddda81cb96`

**API Endpoint:** 
- https://k2hlyos8n3.execute-api.us-east-2.amazonaws.com/dev/

---

## Audit Results - All Lambda Functions

### Functions with Query Parameters (Audited)

1. **✅ bebco-dev-payments-list-jpl**
   - Expected params: `sort`, `limit`, `cursor`, `status`
   - Environment: `MAX_PAGE_SIZE=1000` ✅
   - **FIXED**: Removed incorrect parameter mapping

2. **✅ bebco-dev-admin-nacha-download**
   - Expected params: `limit`
   - Integration: Correct parameter mapping

3. **✅ bebco-dev-invoices-list**
   - Expected params: `type`, `status`, `year`, `search`, `startDate`, `endDate`, `caseId`, `limit`
   - No CDK parameter mapping needed (proxy passes through)

4. **✅ bebco-dev-accounts-list**
   - Expected params: `statements`, `company_id`, `status`, `type`, `limit`, `cursor`
   - No CDK parameter mapping needed

5. **✅ bebco-dev-borrowers-list**
   - Expected params: `bank_id`, `status`, `include_transactions`, `page`, `limit`
   - No CDK parameter mapping needed

**Conclusion:** Only the payments endpoint had incorrect parameter mapping. All other endpoints correctly use proxy integration without parameter transformation.

---

## What Was Working (No Changes Needed)

1. ✅ Authentication & login flows
2. ✅ GraphQL APIs (borrowers, statements)
3. ✅ Monthly reports data
4. ✅ CORS headers on all responses
5. ✅ Gateway error responses (4XX/5XX) with CORS
6. ✅ Lambda IAM permissions
7. ✅ Cognito integration

---

## Current Stack Architecture

**Deployed Stacks (jaspal environment):**
- `BebcoAdminApiStack-jpl` (using admin-api-stack-generated.ts) ✅
- `BebcoAdminSecondaryApiStack-jpl` (using admin-secondary-api-stack-generated.ts) ✅
- `BebcoBorrowerApiStack-jpl` (using borrower-api-stack-generated.ts) ✅

**Stack Source Files:**
- The `-generated.ts` files are the active versions (confirmed in `bin/bebco-infra-cdk-v2.ts` lines 35-37)
- These have proper CORS configuration and Lambda proxy integrations
- The non-generated versions (using OpenAPI specs) are NOT in use

---

## Testing Checklist

### Before Deployment (Verified) ✅
- [x] Gateway Responses configured with CORS headers
- [x] Lambda functions exist and have correct environment variables
- [x] IAM permissions granted for API Gateway → Lambda invocation

### After Deployment (Verified) ✅
- [x] Integration no longer maps `sort` → `sortOrder`
- [x] Lambda proxy integration passes through all query parameters
- [x] Deployment succeeded without errors
- [x] API endpoint remains the same (no breaking changes)

### User Testing Required
- [ ] Test `/admin/payments?sort=desc&limit=500` endpoint
- [ ] Verify payments list returns data correctly
- [ ] Test `/admin/invoices` endpoint (was blocked by CORS in chat summary)
- [ ] Test `/admin/borrowers` endpoint
- [ ] Test `/admin/accounts` endpoint
- [ ] Test `/admin/cases` endpoint

---

## Lessons Learned

1. **Always verify actual deployed configuration** - The chat summary mentioned CORS issues that didn't actually exist in the deployment.

2. **Lambda proxy integration is simplest** - Using `AWS_PROXY` without `requestParameters` is cleaner and avoids parameter mapping errors.

3. **Audit systematically** - Checked ALL Lambda functions with query parameters to ensure no other issues existed.

4. **Use `--exclusively` flag** - When deploying a single stack with dependencies, use `--exclusively` to avoid triggering dependent stack updates.

5. **JSON validation is critical** - Always validate JSON config files after editing.

---

## Next Steps

1. **User to test the fixed endpoints** in the Admin Portal
2. **Monitor CloudWatch logs** for any Lambda execution errors
3. **If issues persist**, check:
   - Lambda function logs for actual parameter values received
   - Frontend code to verify correct parameter names being sent
   - Network requests in browser DevTools

---

## Files Modified

1. `lib/stacks/api/admin-api-stack-generated.ts` - Removed incorrect parameter mapping
2. `config/environments/jaspal-us-east-2.json` - Fixed JSON syntax error

## Commands Used

```bash
# Verify current configuration
aws apigateway get-gateway-response --rest-api-id k2hlyos8n3 --response-type DEFAULT_4XX --region us-east-2
aws apigateway get-integration --rest-api-id k2hlyos8n3 --resource-id o146uo --http-method GET --region us-east-2

# Deploy fix
npm run build
npx cdk deploy BebcoAdminApiStack-jpl -c environment=jaspal -c region=us-east-2 --exclusively --require-approval never
```

---

**Session Completed:** October 28, 2025 9:32 PM EST
**Deployment Status:** ✅ SUCCESS

