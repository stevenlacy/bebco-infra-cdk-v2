#!/usr/bin/env python3
"""
Copy DynamoDB table data from jpl environment to stv environment
Runs as AWS Lambda function with Step Functions orchestration
"""
import boto3
import json
import os
from decimal import Decimal
from typing import Dict, List, Any

dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
dynamodb_client = boto3.client('dynamodb', region_name='us-east-2')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    """
    Lambda handler to copy data from source table to destination table
    
    Event format:
    {
        "source_table": "bebco-borrower-accounts-jpl",
        "dest_table": "bebco-borrower-accounts-stv",
        "batch_size": 25
    }
    """
    source_table_name = event['source_table']
    dest_table_name = event['dest_table']
    batch_size = event.get('batch_size', 25)
    
    print(f"Starting copy from {source_table_name} to {dest_table_name}")
    
    source_table = dynamodb.Table(source_table_name)
    dest_table = dynamodb.Table(dest_table_name)
    
    items_copied = 0
    items_failed = 0
    
    try:
        # Scan source table with pagination
        scan_kwargs = {}
        
        while True:
            response = source_table.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            # Batch write to destination in chunks
            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]
                
                with dest_table.batch_writer() as writer:
                    for item in batch:
                        try:
                            writer.put_item(Item=item)
                            items_copied += 1
                        except Exception as e:
                            print(f"Error writing item: {e}")
                            items_failed += 1
            
            print(f"Copied {items_copied} items so far...")
            
            # Check if there are more items
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        result = {
            'statusCode': 200,
            'source_table': source_table_name,
            'dest_table': dest_table_name,
            'items_copied': items_copied,
            'items_failed': items_failed,
            'success': True
        }
        
        print(f"Completed: {json.dumps(result, cls=DecimalEncoder)}")
        return result
        
    except Exception as e:
        error_result = {
            'statusCode': 500,
            'source_table': source_table_name,
            'dest_table': dest_table_name,
            'items_copied': items_copied,
            'items_failed': items_failed,
            'error': str(e),
            'success': False
        }
        print(f"Error: {json.dumps(error_result, cls=DecimalEncoder)}")
        return error_result

if __name__ == '__main__':
    # Test locally
    test_event = {
        'source_table': 'bebco-borrower-banks-jpl',
        'dest_table': 'bebco-borrower-banks-stv',
        'batch_size': 25
    }
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2, cls=DecimalEncoder))




