#!/bin/bash
set -euo pipefail

REGION="us-east-2"
TABLE_NAME="bebco-borrower-transactions-stv"

echo "⚠️  WARNING: This will DELETE the existing transactions table!"
echo "Table: $TABLE_NAME"
echo "Region: $REGION"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "📊 Checking current table status..."
TABLE_EXISTS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

if [ "$TABLE_EXISTS" != "NOT_FOUND" ]; then
    ITEM_COUNT=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.ItemCount' --output text 2>/dev/null || echo "0")
    echo "Current table has $ITEM_COUNT items"
    echo ""
    read -p "This will DELETE all $ITEM_COUNT items. Continue? (yes/no): " confirm2
    
    if [ "$confirm2" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    echo "🗑️  Deleting existing table..."
    aws dynamodb delete-table --table-name "$TABLE_NAME" --region "$REGION" > /dev/null 2>&1 || true
    
    echo "⏳ Waiting for table deletion to complete..."
    aws dynamodb wait table-not-exists --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null || echo "Table deleted (wait timeout OK)"
    echo "✅ Table deleted"
fi

echo ""
echo "📝 Creating new table with correct schema (matching jpl table)..."
echo "Primary Key: account_id (HASH) + posted_date_tx_id (RANGE)"
echo "GSIs: CompanyIndex, LoanNumberIndex, PlaidTxIndex"

aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --attribute-definitions \
        AttributeName=account_id,AttributeType=S \
        AttributeName=posted_date_tx_id,AttributeType=S \
        AttributeName=company_id,AttributeType=S \
        AttributeName=posted_date_account_id,AttributeType=S \
        AttributeName=loan_no,AttributeType=N \
        AttributeName=date,AttributeType=S \
        AttributeName=plaid_transaction_id,AttributeType=S \
    --key-schema \
        AttributeName=account_id,KeyType=HASH \
        AttributeName=posted_date_tx_id,KeyType=RANGE \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"CompanyIndex\",
                \"KeySchema\": [
                    {\"AttributeName\": \"company_id\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"posted_date_account_id\", \"KeyType\": \"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\": \"ALL\"}
            },
            {
                \"IndexName\": \"LoanNumberIndex\",
                \"KeySchema\": [
                    {\"AttributeName\": \"loan_no\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"date\", \"KeyType\": \"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\": \"ALL\"}
            },
            {
                \"IndexName\": \"PlaidTxIndex\",
                \"KeySchema\": [
                    {\"AttributeName\": \"plaid_transaction_id\", \"KeyType\": \"HASH\"}
                ],
                \"Projection\": {\"ProjectionType\": \"ALL\"}
            }
        ]" \
    --billing-mode PAY_PER_REQUEST \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES > /dev/null

# Enable point-in-time recovery separately (if supported)
aws dynamodb update-continuous-backups \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true > /dev/null 2>&1 || true

echo "⏳ Waiting for table to become active..."
aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"

# Wait a bit more for GSIs to be active
echo "⏳ Waiting for Global Secondary Indexes to become active..."
sleep 10

# Check GSI status
GSI_STATUS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.GlobalSecondaryIndexes[*].IndexStatus' --output text 2>/dev/null || echo "")
while [[ "$GSI_STATUS" == *"CREATING"* ]]; do
    echo "   Still creating GSIs... waiting..."
    sleep 5
    GSI_STATUS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.GlobalSecondaryIndexes[*].IndexStatus' --output text 2>/dev/null || echo "")
done

echo "✅ Table created successfully!"
echo ""
echo "Table details:"
aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount,GSIs:GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}}' --output json | jq '.'

echo ""
echo "🎯 Next step: Run the migration job to copy data from jpl table"
echo "   Use: aws lambda invoke --function-name bebco-dev-migrate-transactions-stv ..."

