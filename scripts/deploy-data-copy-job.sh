#!/bin/bash
# Deploy Lambda function for copying data from jpl to stv

set -e

REGION="us-east-2"
FUNCTION_NAME="bebco-data-copy-jpl-to-stv"
ROLE_NAME="bebco-data-copy-lambda-role"

echo "Creating IAM role for Lambda..."

# Create IAM role if it doesn't exist
aws iam get-role --role-name $ROLE_NAME --region $REGION 2>/dev/null || \
aws iam create-role --role-name $ROLE_NAME \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' --region $REGION

echo "Attaching policies to role..."

# Attach basic Lambda execution policy
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach DynamoDB access policy
POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='bebco-data-copy-dynamodb-access'].Arn" --output text)

if [ -z "$POLICY_ARN" ]; then
  echo "Creating DynamoDB access policy..."
  POLICY_ARN=$(aws iam create-policy --policy-name bebco-data-copy-dynamodb-access \
    --policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "dynamodb:Scan",
            "dynamodb:GetItem",
            "dynamodb:Query",
            "dynamodb:BatchGetItem"
          ],
          "Resource": "arn:aws:dynamodb:us-east-2:303555290462:table/*-jpl"
        },
        {
          "Effect": "Allow",
          "Action": [
            "dynamodb:PutItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:UpdateItem"
          ],
          "Resource": "arn:aws:dynamodb:us-east-2:303555290462:table/*-stv"
        }
      ]
    }' --query 'Policy.Arn' --output text)
fi

aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN

echo "Waiting for role to propagate..."
sleep 10

echo "Creating Lambda deployment package..."
cd "$(dirname "$0")"
mkdir -p /tmp/lambda-deploy
cp copy-table-data.py /tmp/lambda-deploy/lambda_function.py
cd /tmp/lambda-deploy
zip -q lambda-function.zip lambda_function.py

echo "Deploying Lambda function..."

# Check if function exists
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null && UPDATE=true || UPDATE=false

ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)

if [ "$UPDATE" = "true" ]; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lambda-function.zip \
    --region $REGION
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime python3.11 \
    --role $ROLE_ARN \
    --handler lambda_function.lambda_handler \
    --zip-file fileb://lambda-function.zip \
    --timeout 900 \
    --memory-size 512 \
    --region $REGION \
    --description "Copy DynamoDB data from jpl to stv environment"
fi

echo ""
echo "✅ Lambda function deployed: $FUNCTION_NAME"
echo "Function ARN: $(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)"

# Clean up
rm -rf /tmp/lambda-deploy

echo ""
echo "To invoke the function, use:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --payload '{\"source_table\":\"bebco-borrower-banks-jpl\",\"dest_table\":\"bebco-borrower-banks-stv\"}' /tmp/output.json --region $REGION"




