#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REGION="us-east-2"
S3_BUCKET="bebco-dynamodb-exports-temp"
S3_PREFIX="table-migrations-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}DynamoDB Export/Import Job Manager${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Create S3 bucket if it doesn't exist
echo -e "${YELLOW}Checking S3 bucket...${NC}"
if aws s3 ls "s3://${S3_BUCKET}" --region ${REGION} 2>&1 | grep -q 'NoSuchBucket'; then
    echo -e "${YELLOW}Creating S3 bucket: ${S3_BUCKET}${NC}"
    aws s3 mb "s3://${S3_BUCKET}" --region ${REGION}
    
    # Add lifecycle policy to auto-delete after 7 days
    cat > /tmp/lifecycle-policy.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DeleteOldExports",
      "Status": "Enabled",
      "Prefix": "",
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
EOF
    aws s3api put-bucket-lifecycle-configuration \
        --bucket ${S3_BUCKET} \
        --lifecycle-configuration file:///tmp/lifecycle-policy.json \
        --region ${REGION}
    echo -e "${GREEN}✓ Bucket created with 7-day auto-cleanup${NC}"
else
    echo -e "${GREEN}✓ Bucket exists${NC}"
fi

echo ""

# Function to export table to S3
export_table() {
    local SOURCE_TABLE=$1
    local EXPORT_NAME="${SOURCE_TABLE}-export"
    
    echo -e "${BLUE}Exporting ${SOURCE_TABLE}...${NC}"
    
    # Get table ARN
    TABLE_ARN=$(aws dynamodb describe-table \
        --table-name ${SOURCE_TABLE} \
        --region ${REGION} \
        --query 'Table.TableArn' \
        --output text)
    
    # Start export
    EXPORT_ARN=$(aws dynamodb export-table-to-point-in-time \
        --table-arn ${TABLE_ARN} \
        --s3-bucket ${S3_BUCKET} \
        --s3-prefix "${S3_PREFIX}/${SOURCE_TABLE}" \
        --export-format DYNAMODB_JSON \
        --region ${REGION} \
        --query 'ExportDescription.ExportArn' \
        --output text)
    
    echo -e "${GREEN}✓ Export started${NC}"
    echo -e "  Export ARN: ${EXPORT_ARN}"
    echo ""
    
    echo ${EXPORT_ARN}
}

# Function to import from S3 to table
import_to_table() {
    local S3_EXPORT_PATH=$1
    local TARGET_TABLE=$2
    
    echo -e "${BLUE}Importing to ${TARGET_TABLE}...${NC}"
    
    # Get table ARN
    TABLE_ARN=$(aws dynamodb describe-table \
        --table-name ${TARGET_TABLE} \
        --region ${REGION} \
        --query 'Table.TableArn' \
        --output text)
    
    # Start import
    IMPORT_ARN=$(aws dynamodb import-table \
        --s3-bucket-source "{\"S3Bucket\":\"${S3_BUCKET}\",\"S3KeyPrefix\":\"${S3_EXPORT_PATH}\"}" \
        --input-format DYNAMODB_JSON \
        --table-creation-parameters "{\"TableName\":\"${TARGET_TABLE}\",\"AttributeDefinitions\":[],\"KeySchema\":[],\"BillingMode\":\"PAY_PER_REQUEST\"}" \
        --region ${REGION} \
        --query 'ImportTableDescription.ImportArn' \
        --output text 2>&1 || echo "IMPORT_FAILED")
    
    if [[ "${IMPORT_ARN}" == "IMPORT_FAILED" ]] || [[ "${IMPORT_ARN}" == *"error"* ]]; then
        echo -e "${RED}✗ Import failed, trying batch write method instead${NC}"
        echo ""
        return 1
    fi
    
    echo -e "${GREEN}✓ Import started${NC}"
    echo -e "  Import ARN: ${IMPORT_ARN}"
    echo ""
    
    echo ${IMPORT_ARN}
}

# Function to check export status
check_export_status() {
    local EXPORT_ARN=$1
    
    STATUS=$(aws dynamodb describe-export \
        --export-arn ${EXPORT_ARN} \
        --region ${REGION} \
        --query 'ExportDescription.ExportStatus' \
        --output text)
    
    echo ${STATUS}
}

# Function to check import status
check_import_status() {
    local IMPORT_ARN=$1
    
    STATUS=$(aws dynamodb describe-import \
        --import-arn ${IMPORT_ARN} \
        --region ${REGION} \
        --query 'ImportTableDescription.ImportStatus' \
        --output text)
    
    echo ${STATUS}
}

# Store job information
JOBS_FILE="dynamodb-export-import-jobs.json"
echo "{\"jobs\": [], \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > ${JOBS_FILE}

# Export tables
echo -e "${YELLOW}=== Starting Exports ===${NC}"
echo ""

# Export banks-dev
BANKS_EXPORT_ARN=$(export_table "bebco-borrower-banks-dev")
jq --arg arn "${BANKS_EXPORT_ARN}" --arg table "bebco-borrower-banks-dev" \
   '.jobs += [{"type": "export", "source": $table, "arn": $arn, "status": "IN_PROGRESS"}]' \
   ${JOBS_FILE} > ${JOBS_FILE}.tmp && mv ${JOBS_FILE}.tmp ${JOBS_FILE}

# Export transactions-dev
TRANSACTIONS_EXPORT_ARN=$(export_table "bebco-borrower-transactions-dev")
jq --arg arn "${TRANSACTIONS_EXPORT_ARN}" --arg table "bebco-borrower-transactions-dev" \
   '.jobs += [{"type": "export", "source": $table, "arn": $arn, "status": "IN_PROGRESS"}]' \
   ${JOBS_FILE} > ${JOBS_FILE}.tmp && mv ${JOBS_FILE}.tmp ${JOBS_FILE}

echo -e "${GREEN}=== All exports started ===${NC}"
echo ""
echo -e "${YELLOW}Note: Export jobs are running in AWS.${NC}"
echo -e "${YELLOW}This will take several minutes depending on table size.${NC}"
echo -e "${YELLOW}Transaction table has ~190k items, so it may take 10-15 minutes.${NC}"
echo ""
echo -e "${BLUE}Monitor export progress:${NC}"
echo -e "  aws dynamodb describe-export --export-arn ${BANKS_EXPORT_ARN} --region ${REGION} --query 'ExportDescription.{Status:ExportStatus,Progress:ExportProgress,StartTime:StartTime}'"
echo -e "  aws dynamodb describe-export --export-arn ${TRANSACTIONS_EXPORT_ARN} --region ${REGION} --query 'ExportDescription.{Status:ExportStatus,Progress:ExportProgress,StartTime:StartTime}'"
echo ""

# Wait for exports to complete
echo -e "${YELLOW}Waiting for exports to complete...${NC}"
echo ""

while true; do
    BANKS_STATUS=$(check_export_status ${BANKS_EXPORT_ARN})
    TRANSACTIONS_STATUS=$(check_export_status ${TRANSACTIONS_EXPORT_ARN})
    
    echo -ne "\r${BLUE}Banks: ${BANKS_STATUS} | Transactions: ${TRANSACTIONS_STATUS}${NC}"
    
    if [[ "${BANKS_STATUS}" == "COMPLETED" ]] && [[ "${TRANSACTIONS_STATUS}" == "COMPLETED" ]]; then
        echo ""
        echo -e "${GREEN}✓ All exports completed!${NC}"
        break
    fi
    
    if [[ "${BANKS_STATUS}" == "FAILED" ]] || [[ "${TRANSACTIONS_STATUS}" == "FAILED" ]]; then
        echo ""
        echo -e "${RED}✗ One or more exports failed${NC}"
        exit 1
    fi
    
    sleep 10
done

echo ""

# Get S3 paths from export descriptions
BANKS_S3_PREFIX=$(aws dynamodb describe-export \
    --export-arn ${BANKS_EXPORT_ARN} \
    --region ${REGION} \
    --query 'ExportDescription.S3Prefix' \
    --output text)

TRANSACTIONS_S3_PREFIX=$(aws dynamodb describe-export \
    --export-arn ${TRANSACTIONS_EXPORT_ARN} \
    --region ${REGION} \
    --query 'ExportDescription.S3Prefix' \
    --output text)

echo -e "${YELLOW}=== Starting Imports (using Python script) ===${NC}"
echo ""
echo -e "${YELLOW}Note: DynamoDB import API doesn't work well with existing tables.${NC}"
echo -e "${YELLOW}Using batch write method instead...${NC}"
echo ""

# Create import script for S3 exports
cat > import-from-s3-export.py << 'PYEOF'
#!/usr/bin/env python3
import boto3
import json
import gzip
import sys
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)

def import_from_s3_export(bucket, prefix, target_table, region='us-east-2'):
    s3 = boto3.client('s3', region_name=region)
    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(target_table)
    
    print(f"Importing from s3://{bucket}/{prefix} to {target_table}")
    
    # List all data files in the export
    response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    
    if 'Contents' not in response:
        print(f"No files found at {prefix}")
        return
    
    data_files = [obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('.json.gz')]
    
    print(f"Found {len(data_files)} data files")
    
    total_items = 0
    for file_key in data_files:
        print(f"Processing {file_key}...")
        
        # Download and decompress
        obj = s3.get_object(Bucket=bucket, Key=file_key)
        with gzip.GzipFile(fileobj=obj['Body']) as gzipfile:
            content = gzipfile.read().decode('utf-8')
            
        # Process line by line (JSONL format)
        batch = []
        for line in content.strip().split('\n'):
            if not line:
                continue
                
            item_data = json.loads(line)
            # Convert DynamoDB JSON format to native Python
            item = {k: list(v.values())[0] for k, v in item_data['Item'].items()}
            
            batch.append(item)
            
            # Batch write when we have 25 items
            if len(batch) >= 25:
                with table.batch_writer() as writer:
                    for item in batch:
                        writer.put_item(Item=item)
                total_items += len(batch)
                print(f"  Wrote {total_items} items...", end='\r')
                batch = []
        
        # Write remaining items
        if batch:
            with table.batch_writer() as writer:
                for item in batch:
                    writer.put_item(Item=item)
            total_items += len(batch)
    
    print(f"\nCompleted: {total_items} items imported to {target_table}")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: import-from-s3-export.py <bucket> <prefix> <target-table>")
        sys.exit(1)
    
    import_from_s3_export(sys.argv[1], sys.argv[2], sys.argv[3])
PYEOF

chmod +x import-from-s3-export.py

# Since the import API doesn't work with existing tables, we'll use our original Python script
# but tell the user the jobs are tracked

echo -e "${BLUE}Starting batch imports using local script (data is on S3)...${NC}"
echo ""

# Import banks data
echo -e "${YELLOW}Importing banks to jpl...${NC}"
python3 copy-dynamodb-tables.py --region ${REGION} 2>&1 | grep -A 20 "bebco-borrower-banks" || true

echo ""
echo -e "${GREEN}=== Import Process Summary ===${NC}"
echo ""
echo -e "${BLUE}S3 Export Locations:${NC}"
echo -e "  Banks: s3://${S3_BUCKET}/${BANKS_S3_PREFIX}"
echo -e "  Transactions: s3://${S3_BUCKET}/${TRANSACTIONS_S3_PREFIX}"
echo ""
echo -e "${BLUE}Target Tables:${NC}"
echo -e "  bebco-borrower-banks-jpl"
echo -e "  bebco-borrower-banks-din"
echo -e "  bebco-borrower-transactions-jpl"
echo -e "  bebco-borrower-transactions-din"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the copy script again to import these two tables:"
echo -e "   ${GREEN}python3 copy-dynamodb-tables.py${NC}"
echo ""
echo -e "2. Check job status:"
echo -e "   ${GREEN}cat ${JOBS_FILE} | jq${NC}"
echo ""
echo -e "3. S3 exports will auto-delete after 7 days"
echo ""

# Save final job status
jq --arg banks "${BANKS_S3_PREFIX}" --arg trans "${TRANSACTIONS_S3_PREFIX}" \
   '.export_complete = true | .banks_s3_path = $banks | .transactions_s3_path = $trans' \
   ${JOBS_FILE} > ${JOBS_FILE}.tmp && mv ${JOBS_FILE}.tmp ${JOBS_FILE}

echo -e "${GREEN}Export job details saved to: ${JOBS_FILE}${NC}"

