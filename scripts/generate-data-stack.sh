#!/bin/bash
set -e

SCHEMAS_DIR="exports/dynamodb-schemas"
OUTPUT_FILE="lib/stacks/data-stack-generated.ts"

echo "Generating Data Stack from exported DynamoDB schemas..."

cat > $OUTPUT_FILE << 'EOF'
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceNames } from '../config/resource-names';

export interface DataStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
}

export class DataStack extends cdk.Stack {
  public readonly tables: { [key: string]: dynamodb.ITable } = {};
  
  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    
    const { resourceNames } = props;
    
EOF

# Process each table schema
for schema_file in $SCHEMAS_DIR/*.json; do
  table_name=$(basename "$schema_file" .json)
  # Remove bebco-borrower-staging- prefix to get logical name
  logical_name=$(echo "$table_name" | sed 's/bebco-borrower-staging-//')
  
  # Get partition key
  partition_key=$(jq -r '.Table.KeySchema[] | select(.KeyType == "HASH") | .AttributeName' "$schema_file")
  partition_key_type=$(jq -r ".Table.AttributeDefinitions[] | select(.AttributeName == \"$partition_key\") | .AttributeType" "$schema_file")
  
  # Check for sort key
  sort_key=$(jq -r '.Table.KeySchema[] | select(.KeyType == "RANGE") | .AttributeName' "$schema_file")
  
  # Convert to camelCase for TypeScript
  camel_name=$(echo "$logical_name" | perl -pe 's/(^|-)(.)/\U$2/g')
  
  echo "Processing: $table_name -> $camel_name"
  
  # Generate table definition
  cat >> $OUTPUT_FILE << EOF
    // Table: $table_name
    this.tables.$logical_name = new dynamodb.Table(this, '${camel_name}Table', {
      tableName: resourceNames.table('borrower', '$logical_name'),
      partitionKey: { name: '$partition_key', type: dynamodb.AttributeType.${partition_key_type} },
EOF

  # Add sort key if exists
  if [ -n "$sort_key" ] && [ "$sort_key" != "null" ]; then
    sort_key_type=$(jq -r ".Table.AttributeDefinitions[] | select(.AttributeName == \"$sort_key\") | .AttributeType" "$schema_file")
    cat >> $OUTPUT_FILE << EOF
      sortKey: { name: '$sort_key', type: dynamodb.AttributeType.${sort_key_type} },
EOF
  fi

  cat >> $OUTPUT_FILE << EOF
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });
    
EOF

  # Add GSIs if they exist
  gsi_count=$(jq '.Table.GlobalSecondaryIndexes | length' "$schema_file")
  if [ "$gsi_count" != "null" ] && [ "$gsi_count" -gt 0 ]; then
    jq -r '.Table.GlobalSecondaryIndexes[] | @json' "$schema_file" | while read gsi; do
      gsi_name=$(echo "$gsi" | jq -r '.IndexName')
      gsi_pk=$(echo "$gsi" | jq -r '.KeySchema[] | select(.KeyType == "HASH") | .AttributeName')
      gsi_pk_type=$(jq -r ".Table.AttributeDefinitions[] | select(.AttributeName == \"$gsi_pk\") | .AttributeType" "$schema_file")
      gsi_sk=$(echo "$gsi" | jq -r '.KeySchema[] | select(.KeyType == "RANGE") | .AttributeName')
      
      cat >> $OUTPUT_FILE << EOF
    this.tables.$logical_name.addGlobalSecondaryIndex({
      indexName: '$gsi_name',
      partitionKey: { name: '$gsi_pk', type: dynamodb.AttributeType.${gsi_pk_type} },
EOF
      
      if [ -n "$gsi_sk" ] && [ "$gsi_sk" != "null" ]; then
        gsi_sk_type=$(jq -r ".Table.AttributeDefinitions[] | select(.AttributeName == \"$gsi_sk\") | .AttributeType" "$schema_file")
        cat >> $OUTPUT_FILE << EOF
      sortKey: { name: '$gsi_sk', type: dynamodb.AttributeType.${gsi_sk_type} },
EOF
      fi
      
      cat >> $OUTPUT_FILE << EOF
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
EOF
    done
  fi
done

# Close the class
cat >> $OUTPUT_FILE << 'EOF'
  }
}
EOF

echo "Generated: $OUTPUT_FILE"
echo "Total tables processed: $(ls -1 $SCHEMAS_DIR/*.json | wc -l | tr -d ' ')"

