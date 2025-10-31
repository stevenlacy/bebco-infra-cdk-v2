#!/bin/bash
# Analyze table sizes for jpl environment

REGION="us-east-2"
ENV_SUFFIX="jpl"

echo "Analyzing table sizes for -jpl environment..."
echo "Table,ItemCount" > /tmp/jpl-table-sizes.csv

# Get all tables with -jpl suffix
TABLES=$(aws dynamodb list-tables --region $REGION | jq -r '.TableNames[] | select(contains("-jpl"))')

for TABLE in $TABLES; do
  echo "Checking $TABLE..."
  COUNT=$(aws dynamodb scan --table-name "$TABLE" --select "COUNT" --region $REGION | jq -r '.Count')
  echo "$TABLE,$COUNT" >> /tmp/jpl-table-sizes.csv
done

# Sort by count (smallest to largest)
echo ""
echo "Tables sorted by size (smallest to largest):"
tail -n +2 /tmp/jpl-table-sizes.csv | sort -t, -k2 -n

echo ""
echo "Full report saved to: /tmp/jpl-table-sizes.csv"
