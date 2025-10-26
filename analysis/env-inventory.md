# Environment Dependency Inventory

Generated from `config/lambda-packages.json` to surface environment-specific references that still point at staging/us-east-1 resources.

## Env Var Keys

```
ACCOUNTS_TABLE
ADMIN_PORTAL_BASE_URL
ALLOWED_ORIGIN
ANNUAL_REPORTS_TABLE
ANTHROPIC_API_KEY
APPSYNC_API_ID
APPSYNC_URL
AWS_NODEJS_CONNECTION_REUSE_ENABLED
BANKS_TABLE
BUCKET_NAME
COMPANIES_TABLE
COMPANY_INDEX
DISABLE_SIGNATURE_VERIFICATION
DOCUMENTS_BUCKET
DOCUMENTS_S3_BUCKET
DOCUSIGN_HOST
DOCUSIGN_LEGACY_SECRET_NAME
DOCUSIGN_SECRET_NAME
DYNAMODB_DOCUSIGN_REQUESTS_TABLE
DYNAMODB_TABLE
DYNAMODB_TABLE_NAME
EAJF_BANK_ID
ENABLE_SES
FILES_TABLE
IDENTITY_POOL_ID
INVOICES_TABLE
LEDGER_TABLE
LOANS_BANK_COMPANY_INDEX
LOANS_TABLE
LOANS_TABLE_NAME
LOANS_TRANSACTION_INDEX
LOG_LEVEL
MONTHLY_REPORT_INDEX
MONTHLY_REPORTS_PK
MONTHLY_REPORTS_TABLE
NEW_WEBHOOK_URL
OCR_RESULTS_TOPIC_ARN
OTP_TABLE
OUTPUT_BUCKET
PAYMENTS_TABLE
PLAID_CLIENT_ID
PLAID_CLIENT_ID_SECRET_NAME
PLAID_ENVIRONMENT
PLAID_ITEMS_TABLE
PLAID_SECRET
PLAID_SECRET_SECRET_NAME
PLAID_WEBHOOK_SECRET
PORT_RECON_FILE_PATH
PRIMARY_KEY
PYTHONPATH
RETENTION_DAYS
S3_BUCKET
S3_STAGING_BUCKET
SEND2FA_FUNCTION
SendGrid_API_Key_ID
SendGrid_Secret
SES_FROM_ADDRESS
SHAREPOINT_CLIENT_ID
SHAREPOINT_CLIENT_SECRET
SHAREPOINT_DRIVE_NAME
SHAREPOINT_HOST
SHAREPOINT_S3_PREFIX
SHAREPOINT_SECRET_NAME
SHAREPOINT_SITE_PATH
SHAREPOINT_TENANT_ID
STAGE
STATEMENTS_TABLE
SYNC_WORKER_FUNCTION_NAME
TABLE_NAME
TEXTRACT_ROLE_ARN
TRANSACTIONS_SYNC_QUEUE_URL
TRANSACTIONS_TABLE
UNICOURT_CLIENT_ID
UNICOURT_CLIENT_SECRET
URL_EXPIRY_SECONDS
USER_POOL_CLIENT_ID
USER_POOL_ID
USERS_TABLE
VERIFY2FA_FUNCTION
WEBHOOK_BASE_URL
```

## Values Referencing Staging/us-east-1

```
ACCOUNTS_TABLE=bebco-borrower-staging-accounts
ANNUAL_REPORTS_TABLE=bebco-borrower-staging-annual-reportings
APPSYNC_URL=https://z4yaiyjpbvhk5gwsofqz5ozl2q.appsync-api.us-east-1.amazonaws.com/graphql
BANKS_TABLE=bebco-borrower-staging-banks
COMPANIES_TABLE=bebco-borrower-staging-companies
DOCUMENTS_BUCKET=bebco-borrower-staging-documents
DOCUMENTS_S3_BUCKET=bebco-borrower-staging-documents
DYNAMODB_TABLE_NAME=bebco-borrower-staging-loan-loc
DYNAMODB_TABLE=bebco-borrower-staging-annual-reportings
DYNAMODB_TABLE=bebco-borrower-staging-loan-loc
FILES_TABLE=bebco-borrower-staging-files
IDENTITY_POOL_ID=us-east-1:8082e68c-bc59-4a01-b2e0-5feed00028a2
INVOICES_TABLE=bebco-borrower-staging-loan-loc
LEDGER_TABLE=bebco-borrower-staging-ledger-entries
LOANS_TABLE_NAME=bebco-borrower-staging-loans
LOANS_TABLE=bebco-borrower-staging-loans
MONTHLY_REPORTS_TABLE=bebco-borrower-staging-monthly-reportings
NEW_WEBHOOK_URL=https://re0v1hyrdf.execute-api.us-east-1.amazonaws.com/prod/plaid/webhook
OCR_RESULTS_TOPIC_ARN=arn:aws:sns:us-east-1:303555290462:bebco-staging-textract-results
OTP_TABLE=bebco-borrower-staging-otp-codes
OUTPUT_BUCKET=bebco-borrower-staging-documents
PAYMENTS_TABLE=bebco-borrower-staging-payments
PLAID_ITEMS_TABLE=bebco-borrower-staging-plaid-items
S3_BUCKET=bebco-borrower-staging-documents
S3_STAGING_BUCKET=bebco-borrower-staging-documents
SEND2FA_FUNCTION=bebco-staging-users-send2fa
STAGE=staging
STATEMENTS_TABLE=bebco-borrower-staging-statements
SYNC_WORKER_FUNCTION_NAME=bebco-staging-plaid-transactions-sync
TABLE_NAME=bebco-borrower-staging-accounts
TABLE_NAME=bebco-borrower-staging-loans
TABLE_NAME=bebco-borrower-staging-monthly-reportings
TABLE_NAME=bebco-borrower-staging-statements
TEXTRACT_ROLE_ARN=arn:aws:iam::303555290462:role/bebco-staging-textract-sns-role
TRANSACTIONS_SYNC_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/303555290462/bebco-staging-plaid-transactions-sync
TRANSACTIONS_TABLE=bebco-borrower-staging-transactions
USER_POOL_ID=us-east-1_Uba3sK7HT
USERS_TABLE=bebco-borrower-staging-users
VERIFY2FA_FUNCTION=bebco-staging-users-verify2fa
WEBHOOK_BASE_URL=https://24o2865t5h.execute-api.us-east-1.amazonaws.com/staging/plaid/webhook
```

### Notes

- Secrets (`DOCUSIGN_SECRET_NAME`, `SHAREPOINT_SECRET_NAME`, `SendGrid_Secret`) rely on values that are already expressed in `config/environments/*.json` but Lambdas still lack Secrets Manager grants.
- Textract resources (role + SNS topic) remain hard-coded to staging/us-east-1 and need to be provisioned within CDK for each environment.
- Several function-to-function references (`SEND2FA_FUNCTION`, `VERIFY2FA_FUNCTION`, `SYNC_WORKER_FUNCTION_NAME`) still point to staging function names and require updates once new Lambdas are provisioned.
- API/AppSync URLs currently reference the us-east-1 staging deployments; confirm replacements when the us-east-2 equivalents exist.

