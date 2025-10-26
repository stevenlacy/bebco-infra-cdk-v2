#!/usr/bin/env python3
"""Check status of all DynamoDB exports"""

import boto3
import sys
from datetime import datetime

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

# Read export ARNs
try:
    with open('export-arns-python.txt', 'r') as f:
        exports = [line.strip().split('|') for line in f if line.strip()]
except FileNotFoundError:
    print("Error: No export-arns-python.txt found")
    sys.exit(1)

print("=" * 50)
print("DynamoDB Export Status Check")
print("=" * 50)
print()

completed = 0
in_progress = 0
failed = 0

for export_arn, table_name in exports:
    try:
        response = dynamodb.describe_export(ExportArn=export_arn)
        status = response['ExportDescription']['ExportStatus']
        
        if status == 'COMPLETED':
            item_count = response['ExportDescription'].get('ItemCount', 0)
            billed_size = response['ExportDescription'].get('BilledSizeBytes', 0)
            size_mb = billed_size / (1024 * 1024)
            print(f"✅ {table_name}")
            print(f"   Items: {item_count:,} | Size: {size_mb:.2f} MB")
            completed += 1
        elif status == 'IN_PROGRESS':
            print(f"⏳ {table_name}: IN_PROGRESS...")
            in_progress += 1
        elif status == 'FAILED':
            failure_code = response['ExportDescription'].get('FailureCode', 'UNKNOWN')
            print(f"❌ {table_name}: FAILED - {failure_code}")
            failed += 1
        else:
            print(f"⚠️  {table_name}: {status}")
    except Exception as e:
        print(f"❌ {table_name}: Error - {str(e)[:60]}")
        failed += 1

total = len(exports)
print()
print("=" * 50)
print(f"Summary: {completed}/{total} completed")
print("=" * 50)
print()
print(f"Completed:    {completed}")
print(f"In Progress:  {in_progress}")
print(f"Failed:       {failed}")
print()

if completed == total:
    print("🎉 All exports complete! Ready for import.")
    print()
    print("Next step: Review tables without PITR and handle separately")
elif in_progress > 0:
    print("⏳ Still processing... Check back in a few minutes.")
    print(f"   Run: python3 {sys.argv[0]}")
elif failed > 0:
    print("⚠️  Some exports failed. Review errors above.")

print()

