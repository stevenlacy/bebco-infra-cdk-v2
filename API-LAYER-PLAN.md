# API Layer Implementation Plan

**Date**: October 25, 2025  
**Phase**: 2 - API Layer  
**Status**: 🚧 In Progress

---

## 📋 Overview

After successfully deploying all 130 Lambda functions, we now need to deploy the API layer that allows client applications (BorrowerPortal, AdminPortal) to interact with these functions.

---

## 🎯 APIs to Deploy

### REST APIs (3)

1. **bebco-borrower-staging-api** → **bebco-borrower-dev-api**
   - **Purpose**: Borrower Portal API
   - **Resources**: 62 endpoints
   - **Auth**: Cognito User Pools
   - **Key Endpoints**:
     - `/banks/{bankId}/borrowers/{borrowerId}/*` - Borrower operations
     - `/auth/*` - Authentication endpoints
     - `/analyze-documents` - Document processing
     - User management, accounts, draws, monthly reports, invoices

2. **bebco-staging-admin** → **bebco-dev-admin**
   - **Purpose**: Admin Portal API (primary)
   - **Resources**: 79 endpoints
   - **Auth**: Cognito User Pools (Admin pool)
   - **Key Endpoints**:
     - `/admin/users` - User management
     - `/admin/borrowers` - Borrower management
     - `/admin/companies` - Company management
     - `/admin/monthly-reports` - Report management
     - `/admin/accounts` - Account operations

3. **bebco-admin-api**
   - **Purpose**: Admin Portal API (secondary/simplified)
   - **Resources**: 9 endpoints
   - **Auth**: Cognito User Pools
   - **Key Endpoints**:
     - `/admin/banks` - Bank management
     - `/admin/monthly-reports` - Reports
     - `/admin/accounts` - Accounts
     - Draw operations

### GraphQL APIs (2)

4. **bebco-borrowers-api**
   - **Purpose**: Borrower data queries
   - **Auth**: API Key
   - **Resolvers**: Lambda functions for borrower operations
   - **Key Operations**:
     - `listBorrowers`
     - `getFinancialOverview`
     - `batchGetFinancialOverviews`

5. **bebco-statements-events**
   - **Purpose**: Statement event streaming
   - **Auth**: Cognito User Pools
   - **Resolvers**: Statement stream publisher
   - **Key Operations**:
     - Statement events subscription
     - Real-time updates

---

## 🏗️ Implementation Strategy

### Phase 2A: REST API Foundations (Priority 1)

**Goal**: Create CDK stacks for all 3 REST APIs

1. **BorrowerApiStack**
   - Create API Gateway REST API
   - Define 62 resources and methods
   - Wire Lambda integrations
   - Configure Cognito authorizer
   - Set up CORS

2. **AdminPrimaryApiStack** (bebco-staging-admin)
   - Create API Gateway REST API
   - Define 79 resources and methods
   - Wire Lambda integrations
   - Configure Cognito authorizer (admin pool)
   - Set up CORS

3. **AdminSecondaryApiStack** (bebco-admin-api)
   - Create API Gateway REST API
   - Define 9 resources and methods
   - Wire Lambda integrations
   - Configure Cognito authorizer
   - Set up CORS

### Phase 2B: GraphQL APIs (Priority 2)

**Goal**: Deploy AppSync GraphQL APIs

4. **BorrowersGraphQLStack**
   - Create AppSync API
   - Define GraphQL schema
   - Create Lambda data sources
   - Wire resolvers
   - Configure API Key auth

5. **StatementsGraphQLStack**
   - Create AppSync API
   - Define GraphQL schema for subscriptions
   - Create Lambda data sources
   - Wire resolvers
   - Configure Cognito auth

---

## ⚡ Quick Start Approach

Given the complexity of 150+ API endpoints, we have two options:

### Option A: Manual Definition (High Effort, High Control)
- Manually define every route and integration
- Full control over each endpoint
- **Estimated Time**: 8-12 hours
- **Pros**: Perfect customization
- **Cons**: Very time-consuming, error-prone

### Option B: Import & Adapt (Recommended)
- Export existing API definitions from us-east-1
- Use CDK to import and adapt
- **Estimated Time**: 2-4 hours
- **Pros**: Faster, maintains existing structure
- **Cons**: May need manual adjustments

**Recommendation**: Start with Option B for speed, then refine as needed.

---

## 🔧 Technical Approach

### Using API Gateway Import

```typescript
// Example approach
const api = apigateway.SpecRestApi.fromApiDefinition(this, 'BorrowerApi', 
  apigateway.AssetApiDefinition.fromAsset('path/to/openapi.json'), {
    restApiName: resourceNames.apiGateway('borrower-api'),
    deploy: true,
    deployOptions: {
      stageName: 'dev',
    },
  }
);
```

### Manual Resource Definition

```typescript
// Example for critical endpoints
const api = new apigateway.RestApi(this, 'BorrowerApi', {
  restApiName: resourceNames.apiGateway('borrower-api'),
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

const banks = api.root.addResource('banks');
const bank = banks.addResource('{bankId}');
const borrowers = bank.addResource('borrowers');
// ... etc
```

---

## 📊 Complexity Analysis

### REST API Endpoints by Category

**Borrower API (62 endpoints)**:
- Authentication: 5 endpoints
- Users: 8 endpoints
- Accounts: 12 endpoints
- Monthly Reports: 10 endpoints
- Draws: 8 endpoints
- Invoices: 6 endpoints
- Documents: 5 endpoints
- Misc: 8 endpoints

**Admin API Primary (79 endpoints)**:
- Users: 15 endpoints
- Borrowers: 20 endpoints
- Companies: 12 endpoints
- Reports: 15 endpoints
- Draws: 10 endpoints
- Misc: 7 endpoints

**Admin API Secondary (9 endpoints)**:
- Banks: 3 endpoints
- Reports: 2 endpoints
- Accounts: 2 endpoints
- Draws: 2 endpoints

**Total**: 150 REST API endpoints

---

## 🎯 Deployment Priority

### High Priority (MVP)
1. ✅ BorrowerApiStack - Core borrower operations
2. ✅ AdminPrimaryApiStack - Core admin operations
3. ⏳ BorrowersGraphQLStack - Data queries

### Medium Priority
4. ⏳ AdminSecondaryApiStack - Additional admin features
5. ⏳ StatementsGraphQLStack - Real-time updates

### Post-MVP
- API usage plans and keys
- Custom domain names
- WAF integration
- Advanced monitoring

---

## 🚀 Next Steps

1. **Export OpenAPI Definitions** from us-east-1
2. **Create First API Stack** (BorrowerApiStack)
3. **Test Endpoints** with sample requests
4. **Iterate** on remaining APIs
5. **Update Portal Configs** to point to new APIs

---

## 📝 Notes

- All APIs will use Cognito for authentication
- CORS must be configured for web portals
- Lambda proxy integrations preferred for flexibility
- Consider API Gateway caching for frequently accessed endpoints
- Enable CloudWatch logging for all APIs
- Set up X-Ray tracing for debugging

---

**Status**: Planning complete, ready to implement  
**Est. Time to Complete**: 4-6 hours for all 5 APIs

