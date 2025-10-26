#!/usr/bin/env python3
"""Import a single table from S3 to us-east-2"""

import boto3
import json
import gzip
import sys
import time
from boto3.dynamodb.types import TypeDeserializer

if len(sys.argv) != 3:
    print("Usage: python3 import-single-table.py <source-table> <target-table>")
    sys.exit(1)

source_table = sys.argv[1]
target_table = sys.argv[2]

S3_BUCKET = 'bebco-dynamodb-migration-temp-303555290462'
s3 = boto3.client('s3', region_name='us-east-2')
dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
deserializer = TypeDeserializer()

print("=" * 70)
print(f"Importing: {source_table}")
print(f"Target:    {target_table}")
print(f"Region:    us-east-2 ONLY (us-east-1 READ ONLY)")
print("=" * 70)
print()

# Find data files
print("Finding export files in S3...", flush=True)
s3_prefix = f"exports/{source_table}"
paginator = s3.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=S3_BUCKET, Prefix=f"{s3_prefix}/AWSDynamoDB/")

data_files = []
for page in pages:
    if 'Contents' in page:
        for obj in page['Contents']:
            if obj['Key'].endswith('.gz') and '/data/' in obj['Key']:
                data_files.append(obj['Key'])

if not data_files:
    print("⚠️  No data files found (table is empty)")
    sys.exit(0)

print(f"✓ Found {len(data_files)} data files\n")

# Get table resource
table = dynamodb.Table(target_table)

# Import data
total_items = 0
start_time = time.time()

for i, data_file in enumerate(data_files, 1):
    print(f"File {i}/{len(data_files)}: ", end="", flush=True)
    
    try:
        # Download and decompress
        response = s3.get_object(Bucket=S3_BUCKET, Key=data_file)
        json_data = gzip.decompress(response['Body'].read()).decode('utf-8')
        
        # Parse items
        items = []
        for line in json_data.strip().split('\n'):
            if line:
                item_data = json.loads(line)
                if 'Item' in item_data:
                    dynamodb_item = item_data['Item']
                    python_item = {k: deserializer.deserialize(v) for k, v in dynamodb_item.items()}
                    items.append(python_item)
        
        if items:
            # Batch write
            with table.batch_writer() as batch:
                for item in items:
                    batch.put_item(Item=item)
            
            total_items += len(items)
            elapsed = time.time() - start_time
            rate = total_items / elapsed if elapsed > 0 else 0
            print(f"✓ {len(items)} items ({total_items:,} total, {rate:.0f} items/sec)")
        else:
            print("empty")
    
    except Exception as e:
        print(f"✗ Error: {str(e)[:60]}")

elapsed_time = time.time() - start_time
print()
print("=" * 70)
print(f"✅ IMPORT COMPLETE!")
print("=" * 70)
print(f"Table:          {target_table}")
print(f"Items imported: {total_items:,}")
print(f"Time taken:     {elapsed_time:.1f} seconds")
print(f"Average rate:   {total_items/elapsed_time:.0f} items/sec" if elapsed_time > 0 else "")
print("=" * 70)

