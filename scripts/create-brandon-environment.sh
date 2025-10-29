#!/bin/bash
set -e

# Brandon Environment Setup Script
# Creates all -bdn tables with correct schemas and copies data from -dev

REGION="us-east-2"
SOURCE_ENV="dev"
TARGET_ENV="bdn"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/brandon-setup-logs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Brandon Environment Setup${NC}"
echo -e "${BLUE}Creating -bdn tables and copying data${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Region: ${REGION}"
echo "Source: -${SOURCE_ENV} tables"
echo "Target: -${TARGET_ENV} tables"
echo "Log Directory: ${LOG_DIR}"
echo ""

# Create log directory
mkdir -p ${LOG_DIR}

# Get list of all -dev tables
echo -e "${YELLOW}Fetching list of source tables...${NC}"
SOURCE_TABLES=$(aws dynamodb list-tables --region ${REGION} --output json | jq -r '.TableNames[] | select(endswith("-'${SOURCE_ENV}'"))' | sort)

TABLE_COUNT=$(echo "${SOURCE_TABLES}" | wc -l | xargs)
echo -e "${GREEN}Found ${TABLE_COUNT} source tables${NC}"
echo ""

# Function to get table schema
get_table_schema() {
    local TABLE_NAME=$1
    local OUTPUT_FILE=$2
    
    aws dynamodb describe-table \
        --table-name ${TABLE_NAME} \
        --region ${REGION} \
        --query 'Table.{KeySchema:KeySchema,AttributeDefinitions:AttributeDefinitions,GlobalSecondaryIndexes:GlobalSecondaryIndexes,LocalSecondaryIndexes:LocalSecondaryIndexes,StreamSpecification:StreamSpecification}' \
        --output json > ${OUTPUT_FILE}
}

# Function to create table from schema
create_table_from_schema() {
    local SOURCE_TABLE=$1
    local TARGET_TABLE=$2
    local SCHEMA_FILE="${LOG_DIR}/schema-${SOURCE_TABLE}.json"
    
    echo -e "${BLUE}Creating: ${TARGET_TABLE}${NC}"
    
    # Get source schema
    get_table_schema ${SOURCE_TABLE} ${SCHEMA_FILE}
    
    # Extract schema components
    KEY_SCHEMA=$(jq -c '.KeySchema' ${SCHEMA_FILE})
    ATTRIBUTES=$(jq -c '.AttributeDefinitions' ${SCHEMA_FILE})
    GSI=$(jq -c '.GlobalSecondaryIndexes // []' ${SCHEMA_FILE})
    LSI=$(jq -c '.LocalSecondaryIndexes // []' ${SCHEMA_FILE})
    STREAM_SPEC=$(jq -c '.StreamSpecification // {"StreamEnabled": true, "StreamViewType": "NEW_AND_OLD_IMAGES"}' ${SCHEMA_FILE})
    
    # Build create-table command
    CREATE_CMD="aws dynamodb create-table \
        --table-name ${TARGET_TABLE} \
        --key-schema '${KEY_SCHEMA}' \
        --attribute-definitions '${ATTRIBUTES}' \
        --billing-mode PAY_PER_REQUEST \
        --stream-specification '${STREAM_SPEC}' \
        --region ${REGION}"
    
    # Add GSI if present
    if [ "${GSI}" != "[]" ] && [ "${GSI}" != "null" ]; then
        # Remove provisioned throughput from GSI spec
        GSI_CLEANED=$(echo ${GSI} | jq '[.[] | {IndexName, KeySchema, Projection}]')
        CREATE_CMD="${CREATE_CMD} --global-secondary-indexes '${GSI_CLEANED}'"
    fi
    
    # Add LSI if present
    if [ "${LSI}" != "[]" ] && [ "${LSI}" != "null" ]; then
        CREATE_CMD="${CREATE_CMD} --local-secondary-indexes '${LSI}'"
    fi
    
    # Execute create command
    eval ${CREATE_CMD} > ${LOG_DIR}/create-${TARGET_TABLE}.json 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Table created${NC}"
        return 0
    else
        echo -e "${RED}  ✗ Failed to create table${NC}"
        cat ${LOG_DIR}/create-${TARGET_TABLE}.json
        return 1
    fi
}

# Create status tracking file
STATUS_FILE="${LOG_DIR}/setup-status.json"
cat > ${STATUS_FILE} << EOF
{
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "region": "${REGION}",
  "source_env": "${SOURCE_ENV}",
  "target_env": "${TARGET_ENV}",
  "total_tables": ${TABLE_COUNT},
  "tables_created": 0,
  "tables_failed": [],
  "copy_jobs_started": 0,
  "status": "CREATING_TABLES"
}
EOF

echo -e "${YELLOW}Phase 1: Creating Tables${NC}"
echo -e "${YELLOW}========================${NC}"
echo ""

CREATED_COUNT=0
FAILED_TABLES=()

# Create all tables
for SOURCE_TABLE in ${SOURCE_TABLES}; do
    # Generate target table name
    BASE_NAME=${SOURCE_TABLE%-${SOURCE_ENV}}
    TARGET_TABLE="${BASE_NAME}-${TARGET_ENV}"
    
    echo "[$((CREATED_COUNT + 1))/${TABLE_COUNT}] ${SOURCE_TABLE} → ${TARGET_TABLE}"
    
    # Check if table already exists
    if aws dynamodb describe-table --table-name ${TARGET_TABLE} --region ${REGION} >/dev/null 2>&1; then
        echo -e "${YELLOW}  ⚠ Table already exists, skipping...${NC}"
        CREATED_COUNT=$((CREATED_COUNT + 1))
        continue
    fi
    
    # Create the table
    if create_table_from_schema ${SOURCE_TABLE} ${TARGET_TABLE}; then
        CREATED_COUNT=$((CREATED_COUNT + 1))
    else
        FAILED_TABLES+=("${TARGET_TABLE}")
    fi
    
    # Small delay to avoid API throttling
    sleep 1
    echo ""
done

# Update status
python3 << EOF
import json
with open('${STATUS_FILE}', 'r') as f:
    status = json.load(f)
status['tables_created'] = ${CREATED_COUNT}
status['tables_failed'] = $(python3 -c "import json; print(json.dumps([$(IFS=,; echo \"${FAILED_TABLES[*]}\") ]))")
status['table_creation_complete'] = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
with open('${STATUS_FILE}', 'w') as f:
    json.dump(status, f, indent=2)
EOF

echo ""
echo -e "${GREEN}Table Creation Complete: ${CREATED_COUNT}/${TABLE_COUNT} tables created${NC}"

if [ ${#FAILED_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}Failed tables: ${FAILED_TABLES[@]}${NC}"
fi

echo ""
echo -e "${YELLOW}Waiting for all tables to become ACTIVE...${NC}"

# Wait for all tables to be active
WAIT_COUNT=0
MAX_WAIT=300  # 5 minutes

while [ ${WAIT_COUNT} -lt ${MAX_WAIT} ]; do
    ALL_ACTIVE=true
    
    for SOURCE_TABLE in ${SOURCE_TABLES}; do
        BASE_NAME=${SOURCE_TABLE%-${SOURCE_ENV}}
        TARGET_TABLE="${BASE_NAME}-${TARGET_ENV}"
        
        STATUS=$(aws dynamodb describe-table --table-name ${TARGET_TABLE} --region ${REGION} --query 'Table.TableStatus' --output text 2>/dev/null || echo "MISSING")
        
        if [ "${STATUS}" != "ACTIVE" ]; then
            ALL_ACTIVE=false
            break
        fi
    done
    
    if [ "${ALL_ACTIVE}" = true ]; then
        echo -e "${GREEN}✓ All tables are ACTIVE!${NC}"
        break
    fi
    
    echo -ne "\rWaiting for tables to become active... ${WAIT_COUNT}s"
    sleep 5
    WAIT_COUNT=$((WAIT_COUNT + 5))
done

echo ""
echo ""
echo -e "${YELLOW}Phase 2: Starting Data Copy Jobs${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

# Update status
python3 << EOF
import json
with open('${STATUS_FILE}', 'r') as f:
    status = json.load(f)
status['status'] = 'COPYING_DATA'
status['copy_start_time'] = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
with open('${STATUS_FILE}', 'w') as f:
    json.dump(status, f, indent=2)
EOF

# Create copy jobs directory
mkdir -p ${LOG_DIR}/copy-jobs

JOB_COUNT=0

# Start copy jobs for all tables
for SOURCE_TABLE in ${SOURCE_TABLES}; do
    BASE_NAME=${SOURCE_TABLE%-${SOURCE_ENV}}
    TARGET_TABLE="${BASE_NAME}-${TARGET_ENV}"
    
    JOB_NAME="${SOURCE_TABLE}-to-${TARGET_TABLE}"
    LOG_FILE="${LOG_DIR}/copy-jobs/${JOB_NAME}.log"
    PID_FILE="${LOG_DIR}/copy-jobs/${JOB_NAME}.pid"
    JOB_STATUS_FILE="${LOG_DIR}/copy-jobs/${JOB_NAME}.status.json"
    
    echo "Starting copy job: ${SOURCE_TABLE} → ${TARGET_TABLE}"
    
    # Create initial status
    cat > ${JOB_STATUS_FILE} << JOBEOF
{
  "source": "${SOURCE_TABLE}",
  "target": "${TARGET_TABLE}",
  "status": "STARTING",
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "items_copied": 0,
  "progress": "0%"
}
JOBEOF
    
    # Start copy job in background
    nohup python3 ${SCRIPT_DIR}/copy-single-table.py \
        --source ${SOURCE_TABLE} \
        --target ${TARGET_TABLE} \
        --region ${REGION} \
        --status-file ${JOB_STATUS_FILE} \
        > ${LOG_FILE} 2>&1 &
    
    PID=$!
    echo ${PID} > ${PID_FILE}
    
    # Update status with PID
    python3 -c "import json; f=open('${JOB_STATUS_FILE}','r+'); d=json.load(f); d['pid']=${PID}; d['status']='RUNNING'; f.seek(0); json.dump(d,f,indent=2); f.truncate()"
    
    echo "  ✓ Started (PID: ${PID})"
    
    JOB_COUNT=$((JOB_COUNT + 1))
done

# Final status update
python3 << EOF
import json
with open('${STATUS_FILE}', 'r') as f:
    status = json.load(f)
status['copy_jobs_started'] = ${JOB_COUNT}
status['status'] = 'RUNNING'
with open('${STATUS_FILE}', 'w') as f:
    json.dump(status, f, indent=2)
EOF

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Brandon Environment Setup Started!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Tables created: ${CREATED_COUNT}/${TABLE_COUNT}"
echo "  Copy jobs started: ${JOB_COUNT}"
echo "  All jobs running in background with nohup"
echo ""
echo -e "${YELLOW}Monitor Progress:${NC}"
echo "  ./check-brandon-status.sh"
echo ""
echo -e "${YELLOW}View Logs:${NC}"
echo "  tail -f ${LOG_DIR}/copy-jobs/*.log"
echo ""
echo -e "${YELLOW}Status File:${NC}"
echo "  cat ${STATUS_FILE} | jq"
echo ""
echo -e "${YELLOW}Estimated Completion Time:${NC}"
echo "  Small tables: ~5 minutes"
echo "  Large tables (transactions, loans): ~20-30 minutes"
echo ""


