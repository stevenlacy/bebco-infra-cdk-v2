#!/bin/bash
# Simple batch export - no fancy error handling, just get it done

TABLES=(
  "bebco-borrower-staging-companies"
  "bebco-borrower-staging-case-counsel-relationships"
  "bebco-borrower-staging-case-financials-current"
  "bebco-borrower-staging-case-underwritings"
  "bebco-borrower-staging-cases"
  "bebco-borrower-staging-discount-rate-matrix"
  "bebco-borrower-staging-docket-review-case-details"
  "bebco-borrower-staging-files"
  "bebco-borrower-staging-ledger-entries"
  "bebco-borrower-staging-lines-of-credit"
  "bebco-borrower-staging-loan-loc"
  "bebco-borrower-staging-loans"
  "bebco-borrower-staging-mass-tort-general"
  "bebco-borrower-staging-mass-tort-plaintiffs"
  "bebco-borrower-staging-monthly-reportings"
  "bebco-borrower-staging-notifications"
  "bebco-borrower-staging-otp-codes"
  "bebco-borrower-staging-payments"
  "bebco-borrower-staging-plaid-items"
  "bebco-borrower-staging-settlement-success-tracking"
  "bebco-borrower-staging-statements"
  "bebco-borrower-staging-transactions"
  "bebco-borrower-staging-users"
  "bebco-borrower-staging-valuations-summary"
  "bebco-borrower-staging-variance-tracking"
  "bebco-borrower-staging-borrower-value-config-settings"
)

for table in "${TABLES[@]}"; do
  echo "Exporting: $table"
  aws dynamodb export-table-to-point-in-time \
    --table-arn "arn:aws:dynamodb:us-east-1:303555290462:table/${table}" \
    --s3-bucket "bebco-dynamodb-migration-temp-303555290462" \
    --s3-prefix "exports/${table}" \
    --export-format DYNAMODB_JSON \
    --region us-east-1 \
    --output json 2>&1 | jq -r '"✓ " + .ExportDescription.ExportArn + "|" + "'$table'"' >> export-arns.txt || echo "Failed: $table"
  sleep 1
done
