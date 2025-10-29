#!/bin/bash

# Check status of Brandon environment setup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/brandon-setup-logs"
STATUS_FILE="${LOG_DIR}/setup-status.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Brandon Environment Setup Status${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

if [ ! -f "${STATUS_FILE}" ]; then
    echo -e "${RED}No setup found. Run ./create-brandon-environment.sh first${NC}"
    exit 1
fi

# Display main status
echo -e "${YELLOW}Overall Status:${NC}"
cat ${STATUS_FILE} | python3 -c "
import json, sys
status = json.load(sys.stdin)
print(f\"  Started: {status['start_time']}\")
print(f\"  Status: {status['status']}\")
print(f\"  Tables Created: {status['tables_created']}/{status['total_tables']}\")
print(f\"  Copy Jobs: {status['copy_jobs_started']}\")
if status.get('tables_failed'):
    print(f\"\n  Failed Tables: {', '.join(status['tables_failed'])}\")
"

echo ""
echo -e "${YELLOW}Copy Job Progress:${NC}"
echo ""

# Check each copy job
COMPLETED=0
RUNNING=0
FAILED=0
TOTAL_ITEMS=0

for status_file in ${LOG_DIR}/copy-jobs/*.status.json; do
    if [ -f "${status_file}" ]; then
        cat "${status_file}" | python3 -c "
import json, os, sys
data = json.load(sys.stdin)
pid = data.get('pid')
if pid:
    try:
        os.kill(int(pid), 0)
        running = True
    except:
        running = False
        if data['status'] == 'RUNNING':
            data['status'] = 'FAILED (process died)'
else:
    running = False
status = data['status']
source = data['source']
items = data.get('items_copied', 0)
progress = data.get('progress', '0%')
table_name = source.split('-')[-2] if len(source.split('-')) > 2 else source
if status == 'COMPLETED':
    color = '\033[0;32m'
    symbol = '✓'
elif status == 'RUNNING':
    color = '\033[1;33m'
    symbol = '⏳'
elif 'FAILED' in status:
    color = '\033[0;31m'
    symbol = '✗'
else:
    color = '\033[0;34m'
    symbol = '◯'
print(f\"{symbol} {color}{status:12s}\033[0m {progress:>6s} {items:>8,} items  {table_name}\")
"

        # Count statuses
        STATUS=$(python3 -c "import json; print(json.load(open('${status_file}'))['status'])")
        ITEMS=$(python3 -c "import json; print(json.load(open('${status_file}'))['items_copied'])")
        
        if [ "${STATUS}" = "COMPLETED" ]; then
            COMPLETED=$((COMPLETED + 1))
        elif [ "${STATUS}" = "RUNNING" ]; then
            RUNNING=$((RUNNING + 1))
        else
            FAILED=$((FAILED + 1))
        fi
        
        TOTAL_ITEMS=$((TOTAL_ITEMS + ITEMS))
    fi
done

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Completed: ${COMPLETED}${NC}"
echo -e "${YELLOW}Running: ${RUNNING}${NC}"
if [ ${FAILED} -gt 0 ]; then
    echo -e "${RED}Failed: ${FAILED}${NC}"
fi
echo -e "${BLUE}Total Items Copied: ${TOTAL_ITEMS}${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check table counts in AWS
echo -e "${YELLOW}Verifying Table Counts in AWS:${NC}"
echo ""

# Sample a few key tables
KEY_TABLES=("bebco-borrower-banks-bdn" "bebco-borrower-transactions-bdn" "bebco-borrower-loans-bdn" "bebco-borrower-users-bdn")

for TABLE in "${KEY_TABLES[@]}"; do
    COUNT=$(aws dynamodb describe-table --table-name ${TABLE} --region us-east-2 --query 'Table.ItemCount' --output text 2>/dev/null || echo "N/A")
    if [ "${COUNT}" != "N/A" ]; then
        echo "  ${TABLE}: ${COUNT} items"
    fi
done

echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  Live monitor: ${GREEN}watch -n 5 ./check-brandon-status.sh${NC}"
echo "  View logs: ${GREEN}tail -f ${LOG_DIR}/copy-jobs/*.log${NC}"
echo "  Stop all: ${RED}pkill -f 'copy-single-table.py.*bdn'${NC}"
echo ""

# Show estimated completion
if [ ${RUNNING} -gt 0 ]; then
    echo -e "${YELLOW}Jobs still running. Check back in a few minutes.${NC}"
elif [ ${COMPLETED} -gt 0 ] && [ ${RUNNING} -eq 0 ] && [ ${FAILED} -eq 0 ]; then
    echo -e "${GREEN}✅ All jobs completed successfully!${NC}"
    echo ""
    echo "Run full verification:"
    echo "  ${GREEN}python3 get-all-table-counts.py${NC}"
fi

