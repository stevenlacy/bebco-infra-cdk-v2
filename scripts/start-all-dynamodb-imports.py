#!/usr/bin/env python3
"""Start DynamoDB imports for all 19 exported tables"""

import boto3
import json
import os
import sys

# Target region
TARGET_REGION = 'us-east-2'
S3_BUCKET = 'bebco-dynamodb-migration-temp-303555290462'

dynamodb = boto3.client('dynamodb', region_name=TARGET_REGION)

tables_to_import = [
    "bebco-borrower-staging-accounts",
    "bebco-borrower-staging-ach-batches",
    "bebco-borrower-staging-annual-reportings",
    "bebco-borrower-staging-approvals",
    "bebco-borrower-staging-banks",
    "bebco-borrower-staging-companies",
    "bebco-borrower-staging-files",
    "bebco-borrower-staging-ledger-entries",
    "bebco-borrower-staging-lines-of-credit",
    "bebco-borrower-staging-loan-loc",
    "bebco-borrower-staging-loans",
    "bebco-borrower-staging-monthly-reportings",
    "bebco-borrower-staging-notifications",
    "bebco-borrower-staging-otp-codes",
    "bebco-borrower-staging-payments",
    "bebco-borrower-staging-plaid-items",
    "bebco-borrower-staging-statements",
    "bebco-borrower-staging-transactions",
    "bebco-borrower-staging-users",
]

print("=" * 70)
print("DynamoDB Import: S3 → us-east-2")
print("=" * 70)
print()
print(f"Target Region: {TARGET_REGION}")
print(f"Source S3: s3://{S3_BUCKET}/exports/")
print()
print(f"Starting imports for {len(tables_to_import)} tables...")
print()

import_arns = []
success_count = 0
failed_count = 0

for i, source_table in enumerate(tables_to_import, 1):
    # New table name (staging → dev)
    new_table_name = source_table.replace('bebco-borrower-staging-', 'bebco-borrower-') + '-dev'
    
    # S3 prefix for this table's export
    s3_prefix = f"exports/{source_table}"
    
    # Load table configuration
    config_file = f"table-import-configs/{source_table}.json"
    
    try:
        with open(config_file, 'r') as f:
            table_config = json.load(f)
        
        print(f"[{i}/{len(tables_to_import)}] Importing {source_table}")
        print(f"  → Creating as: {new_table_name}")
        
        # Start import
        response = dynamodb.import_table(
            S3BucketSource={
                'S3Bucket': S3_BUCKET,
                'S3KeyPrefix': s3_prefix
            },
            InputFormat='DYNAMODB_JSON',
            TableCreationParameters=table_config
        )
        
        import_arn = response['ImportTableDescription']['ImportArn']
        import_arns.append(f"{import_arn}|{new_table_name}")
        
        print(f"  ✓ Import started")
        print(f"  ARN: {import_arn.split('/')[-1]}")
        success_count += 1
        
    except dynamodb.exceptions.ResourceInUseException:
        print(f"  ⚠️  Table {new_table_name} already exists - skipping")
        success_count += 1
    except FileNotFoundError:
        print(f"  ✗ Config file not found: {config_file}")
        failed_count += 1
    except Exception as e:
        error_msg = str(e)
        if 'ResourceInUseException' in error_msg:
            print(f"  ⚠️  Table already exists or import in progress")
            success_count += 1
        else:
            print(f"  ✗ Failed: {error_msg[:80]}")
            failed_count += 1
    
    print()

# Save import ARNs
with open('import-arns.txt', 'w') as f:
    f.write('\n'.join(import_arns))

print("=" * 70)
print(f"✅ Import submission complete!")
print("=" * 70)
print()
print(f"Success: {success_count}/{len(tables_to_import)}")
print(f"Failed:  {failed_count}/{len(tables_to_import)}")
print()
print(f"Total imports started: {len(import_arns)}")
print()
print("Imports are running in AWS. You can:")
print("  - Close your laptop")
print("  - Check status with: python3 check-import-status.py")
print()
print("Import ARNs saved to: import-arns.txt")
print()

