import json
import os
import time

import boto3


TABLE_NAME = os.environ['TABLE_NAME']
INDEX_NAME = os.environ.get('INDEX_NAME', 'StatusIndex')
HASH_KEY = os.environ.get('HASH_KEY', 'status')
RANGE_KEY = os.environ.get('RANGE_KEY', 'month')

dynamodb = boto3.client('dynamodb')


def lambda_handler(event, _context):
    print('ensure-monthly-reports-status-index event', json.dumps(event))

    if event.get('RequestType') == 'Delete':
        return {
            'PhysicalResourceId': f"{TABLE_NAME}-{INDEX_NAME}",
        }

    ensure_index_exists()
    wait_for_index()

    return {
        'PhysicalResourceId': f"{TABLE_NAME}-{INDEX_NAME}",
        'Data': {
            'IndexName': INDEX_NAME,
            'TableName': TABLE_NAME,
            'Status': 'ACTIVE',
        },
    }


def ensure_index_exists():
    table_description = dynamodb.describe_table(TableName=TABLE_NAME)
    existing = table_description['Table'].get('GlobalSecondaryIndexes', [])
    if any(index['IndexName'] == INDEX_NAME for index in existing):
        print('Index already exists')
        return

    print(f'Creating index {INDEX_NAME} on {TABLE_NAME}')
    dynamodb.update_table(
        TableName=TABLE_NAME,
        AttributeDefinitions=[
            {'AttributeName': HASH_KEY, 'AttributeType': 'S'},
            {'AttributeName': RANGE_KEY, 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexUpdates=[
            {
                'Create': {
                    'IndexName': INDEX_NAME,
                    'KeySchema': [
                        {'AttributeName': HASH_KEY, 'KeyType': 'HASH'},
                        {'AttributeName': RANGE_KEY, 'KeyType': 'RANGE'},
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                }
            }
        ],
    )


def wait_for_index():
    timeout_at = time.time() + 15 * 60
    while time.time() < timeout_at:
        description = dynamodb.describe_table(TableName=TABLE_NAME)
        indexes = description['Table'].get('GlobalSecondaryIndexes', [])
        matching = next((idx for idx in indexes if idx['IndexName'] == INDEX_NAME), None)
        status = matching['IndexStatus'] if matching else 'CREATING'
        print(f'Index status: {status}')
        if status == 'ACTIVE':
            return
        time.sleep(10)

    raise TimeoutError(f'Timed out waiting for index {INDEX_NAME} to become ACTIVE')

