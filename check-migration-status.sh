#!/bin/bash
# Quick status check for DynamoDB migration

cd "$(dirname "$0")/scripts"

echo "╔════════════════════════════════════════════╗"
echo "║  DynamoDB Migration Status                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Checking export progress..."
echo ""

python3 check-export-status-python.py

echo ""
echo "─────────────────────────────────────────────"
echo ""
echo "💡 TIP: Run this command anytime to check progress:"
echo "   ./check-migration-status.sh"
echo ""
echo "📖 Full details: DYNAMODB-EXPORT-STATUS.md"
echo ""

