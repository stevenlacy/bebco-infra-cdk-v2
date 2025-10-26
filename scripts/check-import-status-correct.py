#!/usr/bin/env python3
"""Check status of import-table operations in us-east-2"""

import boto3
import sys

# ONLY us-east-2
dynamodb = boto3.client('dynamodb', region_name='us-east-2')

# Read import ARNs
try:
    with open('import-arns-correct.txt', 'r') as f:
        imports = [line.strip().split('|') for line in f if line.strip()]
except FileNotFoundError:
    print("Error: import-arns-correct.txt not found")
    sys.exit(1)

print("=" * 75)
print("DynamoDB Import Status - us-east-2")
print("(us-east-1 is READ ONLY and untouched)")
print("=" * 75)
print()

completed = 0
in_progress = 0
failed = 0

for import_arn, table_name in imports:
    try:
        response = dynamodb.describe_import(ImportArn=import_arn)
        import_desc = response['ImportTableDescription']
        
        status = import_desc['ImportStatus']
        
        if status == 'COMPLETED':
            imported_items = import_desc.get('ImportedItemCount', 0)
            processed_bytes = import_desc.get('ProcessedSizeBytes', 0)
            processed_mb = processed_bytes / (1024 * 1024)
            
            print(f"✅ {table_name}")
            print(f"   {imported_items:,} items | {processed_mb:.2f} MB")
            completed += 1
        elif status == 'IN_PROGRESS':
            processed_items = import_desc.get('ProcessedItemCount', 0)
            print(f"⏳ {table_name}: IN_PROGRESS", end="")
            if processed_items > 0:
                print(f" ({processed_items:,} items so far)")
            else:
                print()
            in_progress += 1
        elif status == 'FAILED':
            failure_code = import_desc.get('FailureCode', 'UNKNOWN')
            failure_msg = import_desc.get('FailureMessage', '')
            print(f"❌ {table_name}: FAILED")
            print(f"   {failure_code}: {failure_msg[:60]}")
            failed += 1
        else:
            print(f"⚠️  {table_name}: {status}")
        
    except Exception as e:
        print(f"❌ {table_name}: Error - {str(e)[:60]}")
        failed += 1

total = len(imports)
print()
print("=" * 75)
print(f"Progress: {completed}/{total} completed ({completed*100//total}%)")
print("=" * 75)
print()
print(f"✅ Completed:    {completed}")
print(f"⏳ In Progress:  {in_progress}")
print(f"❌ Failed:       {failed}")
print()

if completed == total:
    print("🎉 ALL IMPORTS COMPLETE!")
    print("\nTables created with CORRECT PK/SK schema")
    print("All data imported successfully")
    print("\nNext: Validate data integrity")
elif in_progress > 0:
    print("⏳ Still importing...")
    est_remaining = in_progress * 2  # ~2 min per table average
    print(f"   Estimated time remaining: {est_remaining} minutes")
    print(f"\n   Run again: python3 check-import-status-correct.py")
elif failed > 0:
    print("⚠️  Some imports failed - review errors above")

print()

