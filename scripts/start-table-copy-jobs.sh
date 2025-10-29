#!/bin/bash
set -e

# This script starts background copy jobs using nohup so they continue running
# even after you close the terminal. You can monitor progress with the check script.

REGION="us-east-2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/copy-job-logs"

# Create log directory
mkdir -p ${LOG_DIR}

echo "======================================"
echo "Starting DynamoDB Copy Background Jobs"
echo "======================================"
echo ""
echo "Region: ${REGION}"
echo "Log Directory: ${LOG_DIR}"
echo ""

# Function to start a copy job in background
start_copy_job() {
    local SOURCE_TABLE=$1
    local TARGET_TABLE=$2
    local JOB_NAME="${SOURCE_TABLE}-to-${TARGET_TABLE}"
    local LOG_FILE="${LOG_DIR}/${JOB_NAME}.log"
    local PID_FILE="${LOG_DIR}/${JOB_NAME}.pid"
    local STATUS_FILE="${LOG_DIR}/${JOB_NAME}.status.json"
    
    echo "Starting: ${SOURCE_TABLE} → ${TARGET_TABLE}"
    
    # Create initial status file
    cat > ${STATUS_FILE} << EOF
{
  "source": "${SOURCE_TABLE}",
  "target": "${TARGET_TABLE}",
  "status": "STARTING",
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "items_copied": 0,
  "progress": "0%",
  "pid": null
}
EOF
    
    # Start the copy job in background using Python script
    nohup python3 ${SCRIPT_DIR}/copy-single-table.py \
        --source ${SOURCE_TABLE} \
        --target ${TARGET_TABLE} \
        --region ${REGION} \
        --status-file ${STATUS_FILE} \
        > ${LOG_FILE} 2>&1 &
    
    local PID=$!
    echo ${PID} > ${PID_FILE}
    
    # Update status with PID
    python3 -c "import json; f=open('${STATUS_FILE}','r+'); d=json.load(f); d['pid']=${PID}; d['status']='RUNNING'; f.seek(0); json.dump(d,f,indent=2); f.truncate()"
    
    echo "  ✓ Started (PID: ${PID})"
    echo "  Log: ${LOG_FILE}"
    echo ""
}

# Start all copy jobs
start_copy_job "bebco-borrower-banks-dev" "bebco-borrower-banks-jpl"
start_copy_job "bebco-borrower-banks-dev" "bebco-borrower-banks-din"
start_copy_job "bebco-borrower-transactions-dev" "bebco-borrower-transactions-jpl"
start_copy_job "bebco-borrower-transactions-dev" "bebco-borrower-transactions-din"

echo "======================================"
echo "All background jobs started!"
echo "======================================"
echo ""
echo "To monitor progress, run:"
echo "  ./check-copy-status.sh"
echo ""
echo "To view logs:"
echo "  tail -f ${LOG_DIR}/*.log"
echo ""
echo "Job details are in: ${LOG_DIR}/"
echo ""

