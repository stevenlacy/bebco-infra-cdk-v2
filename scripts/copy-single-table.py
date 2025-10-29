#!/usr/bin/env python3
"""
Single table copy script with status updates
"""

import boto3
import json
import sys
import time
import argparse
from datetime import datetime
from decimal import Decimal
from pathlib import Path

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)

def update_status(status_file, updates):
    """Update the status file with new information"""
    if not status_file:
        return
    
    try:
        with open(status_file, 'r') as f:
            status = json.load(f)
        
        status.update(updates)
        status['last_update'] = datetime.now().isoformat()
        
        with open(status_file, 'w') as f:
            json.dump(status, f, indent=2, cls=DecimalEncoder)
    except Exception as e:
        print(f"Warning: Could not update status file: {e}")

def copy_table(source_table, target_table, region, status_file=None):
    """Copy all data from source to target table"""
    
    print(f"Starting copy: {source_table} → {target_table}")
    print(f"Region: {region}")
    print(f"Time: {datetime.now().isoformat()}")
    print("")
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    source = dynamodb.Table(source_table)
    target = dynamodb.Table(target_table)
    
    # Get source item count
    item_count = source.item_count
    print(f"Source table contains approximately {item_count} items")
    print("")
    
    update_status(status_file, {
        'status': 'RUNNING',
        'total_items_estimate': item_count
    })
    
    # Scan and copy
    items_copied = 0
    items_failed = 0
    batch_number = 0
    scan_kwargs = {}
    
    try:
        while True:
            response = source.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            batch_number += 1
            
            # Batch write to target
            with target.batch_writer() as batch:
                for item in items:
                    try:
                        batch.put_item(Item=item)
                        items_copied += 1
                    except Exception as e:
                        items_failed += 1
                        print(f"Error copying item: {e}")
            
            # Calculate progress
            progress = 0
            if item_count > 0:
                progress = round((items_copied / item_count) * 100, 1)
            
            # Progress update
            print(f"Batch {batch_number}: Copied {len(items)} items (Total: {items_copied}, Failed: {items_failed}, Progress: {progress}%)")
            
            # Update status file
            update_status(status_file, {
                'items_copied': items_copied,
                'items_failed': items_failed,
                'progress': f"{progress}%",
                'batch_number': batch_number
            })
            
            # Check if there are more items
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
            
            # Small delay to avoid throttling
            time.sleep(0.1)
        
        # Final status
        print("")
        print("=" * 60)
        print("COPY COMPLETE")
        print("=" * 60)
        print(f"Items copied: {items_copied}")
        print(f"Items failed: {items_failed}")
        print(f"End time: {datetime.now().isoformat()}")
        
        update_status(status_file, {
            'status': 'COMPLETED',
            'items_copied': items_copied,
            'items_failed': items_failed,
            'progress': '100%',
            'end_time': datetime.now().isoformat(),
            'success': items_failed == 0
        })
        
        return 0 if items_failed == 0 else 1
        
    except Exception as e:
        print(f"ERROR: {e}")
        update_status(status_file, {
            'status': 'FAILED',
            'error': str(e),
            'items_copied': items_copied,
            'items_failed': items_failed,
            'end_time': datetime.now().isoformat()
        })
        return 1

def main():
    parser = argparse.ArgumentParser(description='Copy data from one DynamoDB table to another')
    parser.add_argument('--source', required=True, help='Source table name')
    parser.add_argument('--target', required=True, help='Target table name')
    parser.add_argument('--region', default='us-east-2', help='AWS region')
    parser.add_argument('--status-file', help='JSON file to write status updates')
    
    args = parser.parse_args()
    
    exit_code = copy_table(args.source, args.target, args.region, args.status_file)
    sys.exit(exit_code)

if __name__ == '__main__':
    main()

