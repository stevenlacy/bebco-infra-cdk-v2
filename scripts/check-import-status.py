#!/usr/bin/env python3
"""Check status of all DynamoDB imports"""

import boto3
import sys
import os

TARGET_REGION = 'us-east-2'
dynamodb = boto3.client('dynamodb', region_name=TARGET_REGION)

# Read import ARNs
if not os.path.exists('import-arns.txt'):
    print("Error: No import-arns.txt found. Run start-all-dynamodb-imports.py first.")
    sys.exit(1)

with open('import-arns.txt', 'r') as f:
    imports = [line.strip().split('|') for line in f if line.strip()]

print("=" * 60)
print("DynamoDB Import Status Check (us-east-2)")
print("=" * 60)
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
            print(f"   Imported: {imported_items:,} items | {processed_mb:.2f} MB")
            completed += 1
        elif status == 'IN_PROGRESS':
            processed_items = import_desc.get('ProcessedItemCount', 0)
            print(f"⏳ {table_name}: IN_PROGRESS")
            if processed_items > 0:
                print(f"   Processed: {processed_items:,} items so far...")
            in_progress += 1
        elif status == 'FAILED':
            failure_code = import_desc.get('FailureCode', 'UNKNOWN')
            failure_msg = import_desc.get('FailureMessage', 'No message')
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
print("=" * 60)
print(f"Summary: {completed}/{total} completed")
print("=" * 60)
print()
print(f"Completed:    {completed}")
print(f"In Progress:  {in_progress}")
print(f"Failed:       {failed}")
print()

if completed == total:
    print("🎉 All imports complete! Tables ready in us-east-2.")
    print()
    print("Next: Validate data and test endpoints")
elif in_progress > 0:
    print("⏳ Still processing... Check back in a few minutes.")
    print(f"   Run: python3 {os.path.basename(__file__)}")
elif failed > 0:
    print("⚠️  Some imports failed. Review errors above.")

print()

