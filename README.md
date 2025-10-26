# Bebco Infrastructure CDK v2

**Fresh AWS CDK v2 project for multi-region Bebco serverless infrastructure deployment.**

---

## 🎯 Project Overview

This is a complete rewrite of the Bebco infrastructure using AWS CDK v2, designed to:
- Replicate all production resources from us-east-1 to us-east-2
- Support multi-region deployment (dev, qa, prod)
- Use clean naming conventions ("dev" instead of "staging")
- Avoid issues from the previous CDK implementation

## ⚠️ Critical Constraint

**us-east-1 is READ ONLY**
- All export scripts perform read-only operations
- No modifications, migrations, or transitions to us-east-1
- All new resources are created in us-east-2 only

## 📊 Current Status

✅ **Phase 1-3 Complete:**
- Fresh CDK v2 project initialized
- All 130 Lambda packages downloaded from us-east-1
- Lambda layers replicated to us-east-2
- All configurations exported (tables, APIs, Cognito)
- Foundation stacks implemented (Auth, Storage)
- CDK synth successful

🚧 **In Progress:**
- Data Stack (31 DynamoDB tables)
- Queues Stack (SQS, SNS, EventBridge)
- Domain Lambda stacks (organizing 130 functions)

See [PROGRESS-REPORT.md](./PROGRESS-REPORT.md) for detailed status.

---

## 🏗️ Architecture

### Resource Inventory
- **Lambda Functions:** 130 (112 Python 3.9, 7 Python 3.11, 3 Python 3.12, 6 Node.js 18.x, 2 Node.js 20.x)
- **Lambda Layers:** 2 (DocuSign, Python deps)
- **DynamoDB Tables:** 31
- **API Gateways:** 3 REST APIs
- **AppSync APIs:** 2 GraphQL APIs
- **S3 Buckets:** 14
- **SQS Queues:** 5 (3 standard, 2 FIFO)
- **SNS Topics:** 2
- **EventBridge Rules:** 7
- **Cognito:** 1 User Pool + 1 Identity Pool

### Stack Organization

```
Foundation Stacks:
├── AuthStack         - Cognito User Pool & Identity Pool
├── StorageStack      - S3 buckets (documents, statements, deployments)
├── DataStack         - 31 DynamoDB tables
├── QueuesStack       - SQS, SNS, EventBridge
└── MonitoringStack   - CloudWatch dashboards & alarms

Domain Lambda Stacks:
├── AuthLambdasStack      - 13 auth functions
├── BorrowersStack        - ~20 borrower management functions
├── LoansStack            - ~15 loan management functions
├── PaymentsStack         - ~10 payment processing functions
├── PlaidStack            - 11 Plaid integration functions
├── ReportingStack        - Monthly/Annual report functions
├── CasesStack            - Legal case management functions
├── DrawsStack            - 7 draw request functions
├── ExpensesStack         - 4 expense functions
├── UsersStack            - 12 user management functions
├── BanksStack            - 3 bank management functions
├── SharePointStack       - 3 SharePoint sync functions
├── InvoicesStack         - 5 invoice functions
├── StatementsStack       - Statement generation
├── DocuSignStack         - 6 DocuSign functions
└── IntegrationsStack     - OCR, Textract, misc

API Stacks:
├── ApiGatewayStack   - 3 REST APIs
└── AppSyncStack      - 2 GraphQL APIs
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured with credentials
- Access to AWS account 303555290462
- Permissions for us-east-1 (read) and us-east-2 (read/write)

### Installation

```bash
cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2
npm install
```

### Configuration

Environment configs are in `config/environments/`:
- `dev-us-east-2.json` - Dev environment in us-east-2 (current)
- Add more as needed (qa-us-west-2.json, prod-us-east-1.json)

### Build & Synth

```bash
# Build TypeScript
npm run build

# Synthesize CloudFormation templates
npx cdk synth --context environment=dev --context region=us-east-2 --all
```

### Deploy

```bash
# Bootstrap CDK (first time only)
npx cdk bootstrap aws://303555290462/us-east-2

# Deploy all foundation stacks
npx cdk deploy BebcoAuthStack BebcoStorageStack \
  --context environment=dev --context region=us-east-2

# Deploy specific stack
npx cdk deploy BebcoAuthStack \
  --context environment=dev --context region=us-east-2

# Deploy all stacks (when ready)
npx cdk deploy --all \
  --context environment=dev --context region=us-east-2
```

---

## 📜 Scripts

### Export & Download (us-east-1 READ ONLY)

```bash
# Export all configurations from us-east-1 (READ ONLY)
./scripts/export-us-east-1-configs.sh

# Download all Lambda packages from us-east-1 (READ ONLY)
./scripts/download-lambda-packages-parallel.sh

# Replicate Lambda layers to us-east-2
./scripts/replicate-lambda-layers.sh

# Analyze Lambda functions
./scripts/analyze-lambda-functions.sh
```

### Data Migration

```bash
# Export DynamoDB data from us-east-1 (READ ONLY)
./scripts/export-dynamodb-data.sh

# Import DynamoDB data to us-east-2
./scripts/import-dynamodb-data.sh
```

---

## 📁 Project Structure

```
bebco-infra-cdk-v2/
├── bin/
│   └── bebco-infra-cdk-v2.ts        # Main CDK app entry point
├── lib/
│   ├── stacks/                      # CDK stack definitions
│   │   ├── auth-stack.ts
│   │   ├── storage-stack.ts
│   │   ├── data-stack.ts
│   │   ├── queues-stack.ts
│   │   ├── monitoring-stack.ts
│   │   ├── api-gateway-stack.ts
│   │   ├── appsync-stack.ts
│   │   └── domains/                 # Domain-specific Lambda stacks
│   ├── constructs/                  # Reusable CDK constructs
│   │   └── bebco-lambda.ts         # Smart Lambda wrapper
│   └── config/                      # Configuration helpers
│       ├── environment-config.ts    # Multi-region config loader
│       ├── resource-names.ts        # Naming convention helper
│       └── lambda-config.ts         # Lambda manifest loader
├── config/
│   ├── environments/                # Environment-specific configs
│   │   └── dev-us-east-2.json
│   └── lambda-packages.json         # Generated Lambda manifest
├── scripts/                         # Automation scripts
│   ├── export-us-east-1-configs.sh
│   ├── replicate-lambda-layers.sh
│   ├── download-lambda-packages-parallel.sh
│   ├── analyze-lambda-functions.sh
│   ├── export-dynamodb-data.sh
│   └── import-dynamodb-data.sh
├── dist/                            # Build artifacts (gitignored)
│   ├── lambda-packages/             # Downloaded Lambda ZIPs (130 functions)
│   └── layers/                      # Lambda layer ZIPs (2 layers)
├── exports/                         # Exported configs (gitignored)
│   ├── lambda-configs/              # Lambda function details
│   ├── dynamodb-schemas/            # Table schemas
│   ├── api-gateway-exports/         # API Gateway configs
│   ├── appsync-schemas/             # AppSync schemas
│   └── cognito-config/              # Cognito pool config
├── cdk.json                         # CDK configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── PROGRESS-REPORT.md               # Detailed progress tracker
└── README.md                        # This file
```

---

## 🔧 Development

### Adding a New Lambda Function

```typescript
import { BebcoLambda } from '../constructs/bebco-lambda';

// In your stack:
const myFunction = new BebcoLambda(this, 'MyFunction', {
  sourceFunctionName: 'bebco-staging-my-function',  // Original us-east-1 name
  resourceNames: resourceNames,
  environment: {
    // Override/add environment variables
    TABLE_NAME: dataStack.tables.myTable.tableName,
  },
  layers: [pythonDepsLayer],  // Optional layer override
});

// Grant permissions
dataStack.tables.myTable.grantReadWriteData(myFunction.function);
```

### Adding a New Stack

1. Create stack file in `lib/stacks/` or `lib/stacks/domains/`
2. Import and instantiate in `bin/bebco-infra-cdk-v2.ts`
3. Set up dependencies (pass tables, buckets, etc. as props)
4. Build and test: `npm run build && npx cdk synth`

---

## 🔍 Naming Conventions

**Lambda Functions:**
- Old: `bebco-staging-plaid-sync-manual`
- New: `bebco-dev-plaid-sync-manual`

**DynamoDB Tables:**
- Old: `bebco-borrower-staging-accounts`
- New: `bebco-borrower-accounts-dev`

**S3 Buckets:**
- Format: `bebco-<purpose>-dev-us-east-2-303555290462`
- Example: `bebco-borrower-documents-dev-us-east-2-303555290462`

**SQS Queues:**
- Standard: `bebco-dev-<domain>-<purpose>`
- FIFO: `bebco-dev-<domain>-<purpose>.fifo`

**APIs:**
- API Gateway: `bebco-<domain>-dev-api`
- AppSync: `bebco-<api-name>-dev`

**Cognito:**
- User Pool: `bebco-borrower-portal-dev`
- Identity Pool: `bebco-borrower-identity-dev`

---

## ✅ Validation

### Pre-Deployment Checks

```bash
# 1. Verify all Lambda packages downloaded
ls dist/lambda-packages/*.zip | wc -l  # Should be 130

# 2. Verify Lambda layers in us-east-2
aws lambda list-layer-versions \
  --layer-name bebco-docusign-layer \
  --region us-east-2

aws lambda list-layer-versions \
  --layer-name bebco-python-deps \
  --region us-east-2

# 3. Test CDK synth
npx cdk synth --context environment=dev --context region=us-east-2 --all

# 4. List stacks to deploy
npx cdk list --context environment=dev --context region=us-east-2
```

### Post-Deployment Validation

```bash
# Verify Lambda functions
aws lambda list-functions --region us-east-2 \
  --query 'Functions[?starts_with(FunctionName, `bebco-dev`)].FunctionName' \
  | jq 'length'  # Should be 130

# Verify DynamoDB tables
aws dynamodb list-tables --region us-east-2 \
  | jq '.TableNames | map(select(contains("bebco-borrower") and endswith("-dev"))) | length'  # Should be 31

# Test endpoints
curl https://api.dev.bebco.com/health
```

---

## 🐛 Troubleshooting

### Lambda package not found
```
Error: Lambda package not found: dist/lambda-packages/bebco-staging-X.zip
```
**Solution:** Run `./scripts/download-lambda-packages-parallel.sh`

### CDK synth fails with missing config
```
Error: Configuration file not found: config/environments/dev-us-east-2.json
```
**Solution:** Ensure config file exists and context parameters are passed: `--context environment=dev --context region=us-east-2`

### Layer ARN not found
```
Error: Layer arn:aws:lambda:us-east-2:... does not exist
```
**Solution:** Run `./scripts/replicate-lambda-layers.sh` to copy layers to us-east-2

---

## 📝 Notes

- **Lambda Package Strategy:** Downloaded exact production packages from us-east-1 for guaranteed 1:1 match
- **us-east-1 Safety:** All scripts that touch us-east-1 are read-only
- **Multi-Region Ready:** Architecture supports deployment to any region by creating new config files
- **CDK Version:** 2.1031.0
- **No Data Loss Risk:** us-east-1 remains untouched; us-east-2 is completely independent

---

## 📚 Additional Documentation

- [PROGRESS-REPORT.md](./PROGRESS-REPORT.md) - Detailed progress and next steps
- [LAMBDA-DEPLOYMENT-PATTERNS.md](../bebco-infra-cdk/LAMBDA-DEPLOYMENT-PATTERNS.md) - Analysis of Lambda deployment patterns

---

## 🤝 Contributing

When adding new infrastructure:
1. Follow existing naming conventions
2. Use reusable constructs (`BebcoLambda`, etc.)
3. Update relevant documentation
4. Test with `cdk synth` before deploying
5. Tag all resources appropriately

---

## 📄 License

Internal Bebco project - All rights reserved
