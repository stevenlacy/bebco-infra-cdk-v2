#!/usr/bin/env python3
"""
Lambda function to migrate transactions from bebco-borrower-transactions-jpl to bebco-borrower-transactions-stv
Handles schema transformation: jpl uses (account_id, posted_date_tx_id) as key, stv uses id with GSIs
"""
import boto3
import json
import os
import uuid
from decimal import Decimal
from typing import Dict, List, Any
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
dynamodb_client = boto3.client('dynamodb', region_name='us-east-2')

SOURCE_TABLE = os.environ.get('SOURCE_TABLE', 'bebco-borrower-transactions-jpl')
DEST_TABLE = os.environ.get('DEST_TABLE', 'bebco-borrower-transactions-stv')
BATCH_SIZE = int(os.environ.get('BATCH_SIZE', '25'))
MAX_ITEMS = int(os.environ.get('MAX_ITEMS', '0'))  # 0 = unlimited

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)

def transform_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    No transformation needed - schemas match between jpl and stv
    Both use: primary key (account_id, posted_date_tx_id)
    """
    # Both tables have the same schema, so just return as-is
    return item.copy()

def lambda_handler(event, context):
    """
    Lambda handler to migrate transactions from jpl to stv
    
    Event format:
    {
        "source_table": "bebco-borrower-transactions-jpl",  # optional
        "dest_table": "bebco-borrower-transactions-stv",    # optional
        "batch_size": 25,                                    # optional
        "exclusive_start_key": {...},                        # optional, for resuming
        "max_items": 10000                                   # optional, limit items in this run
    }
    """
    source_table_name = event.get('source_table', SOURCE_TABLE)
    dest_table_name = event.get('dest_table', DEST_TABLE)
    batch_size = event.get('batch_size', BATCH_SIZE)
    exclusive_start_key = event.get('exclusive_start_key')
    max_items = event.get('max_items', MAX_ITEMS)
    
    print(f"Starting migration from {source_table_name} to {dest_table_name}")
    print(f"Batch size: {batch_size}, Max items: {max_items if max_items > 0 else 'unlimited'}")
    
    source_table = dynamodb.Table(source_table_name)
    dest_table = dynamodb.Table(dest_table_name)
    
    items_copied = 0
    items_failed = 0
    items_skipped = 0
    batch_number = 0
    
    try:
        scan_kwargs = {
            'Limit': min(batch_size * 4, 1000)  # Scan more items per page for efficiency
        }
        
        if exclusive_start_key:
            scan_kwargs['ExclusiveStartKey'] = exclusive_start_key
            print(f"Resuming from key: {exclusive_start_key}")
        
        while True:
            # Check if we've hit the max items limit
            if max_items > 0 and items_copied >= max_items:
                print(f"Reached max_items limit ({max_items})")
                break
            
            response = source_table.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            batch_number += 1
            
            # Batch write to destination (no transformation needed - schemas match)
            # Batch write in chunks
            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]
                
                try:
                    with dest_table.batch_writer() as writer:
                        for item in batch:
                            try:
                                # Direct write - DynamoDB will handle duplicates automatically
                                # Skip individual GetItem checks for performance (190k items)
                                writer.put_item(Item=item)
                                items_copied += 1
                            except Exception as e:
                                # Check if it's a duplicate key error
                                if 'ConditionalCheckFailedException' in str(e) or 'duplicate' in str(e).lower():
                                    items_skipped += 1
                                else:
                                    key_str = f"{item.get('account_id', 'unknown')}|{item.get('posted_date_tx_id', 'unknown')}"
                                    print(f"Error writing item {key_str}: {e}")
                                    items_failed += 1
                except Exception as e:
                    print(f"Error in batch write: {e}")
                    items_failed += len(batch)
            
            # Progress update
            if batch_number % 10 == 0 or len(items) < scan_kwargs['Limit']:
                print(f"Batch {batch_number}: Processed {len(items)} items (Total copied: {items_copied}, Failed: {items_failed}, Skipped: {items_skipped})")
            
            # Check if there are more items
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
            
            # Small delay to avoid throttling
            import time
            time.sleep(0.1)
        
        result = {
            'statusCode': 200,
            'source_table': source_table_name,
            'dest_table': dest_table_name,
            'items_copied': items_copied,
            'items_failed': items_failed,
            'items_skipped': items_skipped,
            'batches_processed': batch_number,
            'last_evaluated_key': scan_kwargs.get('ExclusiveStartKey'),
            'has_more': 'LastEvaluatedKey' in response if 'response' in locals() else False,
            'success': items_failed == 0
        }
        
        print(f"Migration batch complete: {json.dumps(result, cls=DecimalEncoder)}")
        return result
        
    except Exception as e:
        error_result = {
            'statusCode': 500,
            'source_table': source_table_name,
            'dest_table': dest_table_name,
            'items_copied': items_copied,
            'items_failed': items_failed,
            'items_skipped': items_skipped,
            'batches_processed': batch_number,
            'last_evaluated_key': scan_kwargs.get('ExclusiveStartKey'),
            'error': str(e),
            'success': False
        }
        print(f"Migration error: {json.dumps(error_result, cls=DecimalEncoder)}")
        return error_result

if __name__ == '__main__':
    # Test locally
    test_event = {
        'source_table': 'bebco-borrower-transactions-jpl',
        'dest_table': 'bebco-borrower-transactions-stv',
        'batch_size': 25,
        'max_items': 100  # Limit for testing
    }
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2, cls=DecimalEncoder))

