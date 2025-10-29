#!/bin/bash

# Check status of all running copy jobs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/copy-job-logs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "DynamoDB Copy Jobs Status"
echo -e "======================================${NC}"
echo ""

if [ ! -d "${LOG_DIR}" ]; then
    echo -e "${YELLOW}No copy jobs found.${NC}"
    echo "Start jobs with: ./start-table-copy-jobs.sh"
    exit 0
fi

# Check each status file
for status_file in ${LOG_DIR}/*.status.json; do
    if [ -f "${status_file}" ]; then
        echo -e "${BLUE}$(basename ${status_file} .status.json)${NC}"
        
        # Parse JSON and display
        python3 << EOF
import json
import os
import sys

with open('${status_file}') as f:
    data = json.load(f)

# Check if process is still running
pid = data.get('pid')
if pid:
    try:
        os.kill(int(pid), 0)  # Check if process exists
        running = True
    except:
        running = False
        if data['status'] == 'RUNNING':
            data['status'] = 'FAILED (process died)'
else:
    running = False

status = data['status']
source = data['source']
target = data['target']
items = data.get('items_copied', 0)
failed = data.get('items_failed', 0)
progress = data.get('progress', '0%')
start = data.get('start_time', 'N/A')

# Color code status
if status == 'COMPLETED':
    color = '\033[0;32m'  # Green
elif status == 'RUNNING':
    color = '\033[1;33m'  # Yellow
elif status == 'FAILED' or 'FAILED' in status:
    color = '\033[0;31m'  # Red
else:
    color = '\033[0;34m'  # Blue

print(f"  Source: {source}")
print(f"  Target: {target}")
print(f"  Status: {color}{status}\033[0m")
print(f"  Progress: {progress}")
print(f"  Items Copied: {items:,}")
if failed > 0:
    print(f"  Items Failed: \033[0;31m{failed}\033[0m")
print(f"  Started: {start}")
if pid:
    print(f"  PID: {pid} {'(running)' if running else '(stopped)'}")

EOF
        echo ""
    fi
done

# Show summary
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Commands:"
echo -e "  View logs: ${GREEN}tail -f ${LOG_DIR}/*.log${NC}"
echo -e "  Live monitor: ${GREEN}watch -n 5 ./check-copy-status.sh${NC}"
echo -e "  Stop all jobs: ${RED}pkill -f copy-single-table.py${NC}"
echo ""

# Check DynamoDB table counts
echo -e "${BLUE}Current Table Item Counts:${NC}"
aws dynamodb describe-table --table-name bebco-borrower-banks-jpl --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}' --output table 2>/dev/null
aws dynamodb describe-table --table-name bebco-borrower-banks-din --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}' --output table 2>/dev/null
aws dynamodb describe-table --table-name bebco-borrower-transactions-jpl --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}' --output table 2>/dev/null
aws dynamodb describe-table --table-name bebco-borrower-transactions-din --region us-east-2 --query 'Table.{Name:TableName,Items:ItemCount}' --output table 2>/dev/null

