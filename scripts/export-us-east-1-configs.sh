#!/bin/bash
set -e

SOURCE_REGION="us-east-1"
EXPORT_DIR="exports"

echo "========================================="
echo "Exporting us-east-1 Configurations"
echo "READ ONLY - No changes to us-east-1"
echo "========================================="

mkdir -p $EXPORT_DIR/{lambda-configs,dynamodb-schemas,api-gateway-exports,appsync-schemas,cognito-config}

# Export all 130 Lambda function configs
echo "Exporting Lambda function configurations..."
aws lambda list-functions --region $SOURCE_REGION \
  --output json | jq '[.Functions[] | select(.FunctionName | test("BEBCO|bebco"))]' \
  > $EXPORT_DIR/lambda-configs/all-functions.json

FUNCTION_COUNT=$(jq 'length' $EXPORT_DIR/lambda-configs/all-functions.json)
echo "Found $FUNCTION_COUNT Lambda functions"

# Export individual function details
jq -r '.[].FunctionName' $EXPORT_DIR/lambda-configs/all-functions.json | while read func; do
  echo "  Exporting: $func"
  aws lambda get-function --function-name "$func" --region $SOURCE_REGION \
    --output json > "$EXPORT_DIR/lambda-configs/${func}.json" 2>/dev/null || true
done

# Export DynamoDB table schemas
echo "Exporting DynamoDB table schemas..."
aws dynamodb list-tables --region $SOURCE_REGION --output json | \
  jq -r '.TableNames[] | select(contains("bebco-borrower-staging-"))' | \
  while read table; do
    echo "  Exporting schema: $table"
    aws dynamodb describe-table --table-name "$table" --region $SOURCE_REGION \
      --output json > "$EXPORT_DIR/dynamodb-schemas/${table}.json"
  done

# Export API Gateway configurations
echo "Exporting API Gateway configurations..."
for api_id in 24o2865t5h 3rrafjqruf ufgnvxq4y0; do
  echo "  Exporting API: $api_id"
  aws apigateway get-rest-api --rest-api-id $api_id --region $SOURCE_REGION \
    --output json > "$EXPORT_DIR/api-gateway-exports/${api_id}-api.json"
  
  aws apigateway get-resources --rest-api-id $api_id --region $SOURCE_REGION \
    --output json > "$EXPORT_DIR/api-gateway-exports/${api_id}-resources.json"
done

# Export AppSync schemas
echo "Exporting AppSync GraphQL schemas..."
aws appsync list-graphql-apis --region $SOURCE_REGION --output json | \
  jq -r '.graphqlApis[] | select(.name | contains("bebco")) | .apiId' | \
  while read api_id; do
    echo "  Exporting AppSync API: $api_id"
    aws appsync get-graphql-api --api-id $api_id --region $SOURCE_REGION \
      --output json > "$EXPORT_DIR/appsync-schemas/${api_id}.json"
    
    aws appsync get-introspection-schema --api-id $api_id --format SDL --region $SOURCE_REGION \
      "$EXPORT_DIR/appsync-schemas/${api_id}.graphql" 2>/dev/null || echo "  (Schema export failed for $api_id)"
  done

# Export Cognito User Pool configuration
echo "Exporting Cognito User Pool configuration..."
aws cognito-idp describe-user-pool --user-pool-id us-east-1_Uba3sK7HT --region $SOURCE_REGION \
  --output json > "$EXPORT_DIR/cognito-config/user-pool.json"

echo "========================================="
echo "Export complete! All configs in $EXPORT_DIR/"
echo "us-east-1 was NOT modified (read-only)"
echo "========================================="

