#!/usr/bin/env python3
"""
Import data from S3 exports into existing DynamoDB tables in us-east-2
Uses batch-write to load data from exported JSON files
"""

import boto3
import json
import gzip
from decimal import Decimal
from boto3.dynamodb.types import TypeDeserializer

S3_BUCKET = 'bebco-dynamodb-migration-temp-303555290462'
TARGET_REGION = 'us-east-2'

s3 = boto3.client('s3', region_name=TARGET_REGION)
dynamodb = boto3.resource('dynamodb', region_name=TARGET_REGION)
deserializer = TypeDeserializer()

tables_to_import = [
    ("bebco-borrower-staging-accounts", "bebco-borrower-accounts-dev"),
    ("bebco-borrower-staging-ach-batches", "bebco-borrower-ach-batches-dev"),
    ("bebco-borrower-staging-annual-reportings", "bebco-borrower-annual-reportings-dev"),
    ("bebco-borrower-staging-approvals", "bebco-borrower-approvals-dev"),
    ("bebco-borrower-staging-banks", "bebco-borrower-banks-dev"),
    ("bebco-borrower-staging-companies", "bebco-borrower-companies-dev"),
    ("bebco-borrower-staging-files", "bebco-borrower-files-dev"),
    ("bebco-borrower-staging-ledger-entries", "bebco-borrower-ledger-entries-dev"),
    ("bebco-borrower-staging-lines-of-credit", "bebco-borrower-lines-of-credit-dev"),
    ("bebco-borrower-staging-loan-loc", "bebco-borrower-loan-loc-dev"),
    ("bebco-borrower-staging-loans", "bebco-borrower-loans-dev"),
    ("bebco-borrower-staging-monthly-reportings", "bebco-borrower-monthly-reportings-dev"),
    ("bebco-borrower-staging-notifications", "bebco-borrower-notifications-dev"),
    ("bebco-borrower-staging-otp-codes", "bebco-borrower-otp-codes-dev"),
    ("bebco-borrower-staging-payments", "bebco-borrower-payments-dev"),
    ("bebco-borrower-staging-plaid-items", "bebco-borrower-plaid-items-dev"),
    ("bebco-borrower-staging-statements", "bebco-borrower-statements-dev"),
    ("bebco-borrower-staging-transactions", "bebco-borrower-transactions-dev"),
    ("bebco-borrower-staging-users", "bebco-borrower-users-dev"),
]

def find_export_data_files(s3_prefix):
    """Find all .gz data files in the export"""
    try:
        # List all objects under the export prefix
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=S3_BUCKET, Prefix=f"{s3_prefix}/AWSDynamoDB/")
        
        data_files = []
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    if obj['Key'].endswith('.gz') and '/data/' in obj['Key']:
                        data_files.append(obj['Key'])
        
        return data_files
    except Exception as e:
        print(f"  Error finding data files: {e}")
        return []

def import_table_data(source_table, target_table):
    """Import data from S3 export into existing DynamoDB table"""
    s3_prefix = f"exports/{source_table}"
    
    print(f"\n{'='*70}")
    print(f"Importing: {source_table}")
    print(f"Target: {target_table}")
    print(f"{'='*70}")
    
    # Find data files
    print("  Finding export data files...")
    data_files = find_export_data_files(s3_prefix)
    
    if not data_files:
        print(f"  ⚠️  No data files found (table may be empty)")
        return 0
    
    print(f"  Found {len(data_files)} data file(s)")
    
    # Get table resource
    table = dynamodb.Table(target_table)
    
    total_items = 0
    
    for i, data_file in enumerate(data_files, 1):
        print(f"  Processing file {i}/{len(data_files)}: {data_file.split('/')[-1]}")
        
        try:
            # Download and decompress file
            response = s3.get_object(Bucket=S3_BUCKET, Key=data_file)
            compressed_data = response['Body'].read()
            json_data = gzip.decompress(compressed_data).decode('utf-8')
            
            # Parse items
            items = []
            for line in json_data.strip().split('\n'):
                if line:
                    item_data = json.loads(line)
                    # Convert Item wrapper format to regular Python format
                    if 'Item' in item_data:
                        dynamodb_item = item_data['Item']
                        # Deserialize DynamoDB JSON to Python types
                        python_item = {k: deserializer.deserialize(v) for k, v in dynamodb_item.items()}
                        items.append(python_item)
            
            # Batch write items
            if items:
                with table.batch_writer() as batch:
                    for item in items:
                        batch.put_item(Item=item)
                
                total_items += len(items)
                print(f"    ✓ Wrote {len(items)} items")
        
        except Exception as e:
            print(f"    ✗ Error: {str(e)[:60]}")
    
    print(f"  ✅ Total items imported: {total_items}")
    return total_items

# Main execution
print("="*70)
print("DynamoDB Data Import from S3 to Existing Tables")
print("="*70)
print()
print(f"Source: s3://{S3_BUCKET}/exports/")
print(f"Target: DynamoDB tables in {TARGET_REGION}")
print()
print(f"Importing {len(tables_to_import)} tables...")

total_imported = 0

for source_table, target_table in tables_to_import:
    try:
        items_imported = import_table_data(source_table, target_table)
        total_imported += items_imported
    except Exception as e:
        print(f"\n✗ Failed to import {source_table}: {str(e)[:80]}\n")

print()
print("="*70)
print(f"✅ Import Complete!")
print("="*70)
print()
print(f"Total items imported: {total_imported:,}")
print()

