#!/bin/bash
# Fix API Gateway permissions for all -stv Lambda functions

REGION="us-east-2"
API_ID="ga6ahst9qi"

echo "Fixing API Gateway permissions for all -stv Lambda functions..."

# Get all Lambda functions with -stv suffix
FUNCTIONS=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName,'stv')].FunctionName" --output text)

COUNT=0
for FUNC in $FUNCTIONS; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT] Adding prod stage permission to $FUNC..."
  
  aws lambda add-permission \
    --function-name $FUNC \
    --statement-id ApiGatewayInvokeProdWildcard \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:303555290462:$API_ID/prod/*/*" \
    --region $REGION 2>&1 | grep -q "ResourceConflictException" && echo "  Already exists" || echo "  ✅ Added"
done

echo ""
echo "✅ Complete! Updated $COUNT Lambda functions"
