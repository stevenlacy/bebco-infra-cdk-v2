import base64
import json
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key


TABLE_NAME = os.environ['MONTHLY_REPORTS_TABLE']
INDEX_NAME = os.environ.get('MONTHLY_REPORTS_STATUS_INDEX', 'StatusIndex')
DEFAULT_LIMIT = int(os.environ.get('MONTHLY_REPORTS_DEFAULT_LIMIT', '1000'))
MAX_LIMIT = int(os.environ.get('MONTHLY_REPORTS_MAX_LIMIT', '5000'))

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, _context):
    print('monthlyReportsByStatus event', json.dumps(event))

    arguments = event.get('arguments', {})
    raw_status = arguments.get('status')
    if not isinstance(raw_status, str) or not raw_status.strip():
        raise ValueError('status argument is required')

    normalized_status = raw_status.strip().lower()
    limit = _resolve_limit(arguments.get('limit'))

    params = {
        'IndexName': INDEX_NAME,
        'KeyConditionExpression': Key('status').eq(normalized_status),
        'Limit': limit,
    }

    filter_expression = _build_filter_expression(arguments)
    if filter_expression is not None:
        params['FilterExpression'] = filter_expression

    exclusive_start_key = _decode_token(arguments.get('nextToken'))
    if exclusive_start_key is not None:
        params['ExclusiveStartKey'] = exclusive_start_key

    response = table.query(**params)

    items = [_convert_types(item) for item in response.get('Items', [])]
    next_token = _encode_token(response.get('LastEvaluatedKey'))

    result = {
        'items': items,
    }
    if next_token is not None:
        result['nextToken'] = next_token

    print(
        f"monthlyReportsByStatus status={normalized_status} items={len(items)} nextToken={'yes' if next_token else 'no'}"
    )
    return result


def _build_filter_expression(arguments):
    filters = []

    year = arguments.get('year')
    if isinstance(year, int):
        filters.append(Attr('year').eq(year))

    bank_id = arguments.get('bank_id')
    if isinstance(bank_id, str) and bank_id.strip():
        filters.append(Attr('bank_id').eq(bank_id.strip()))

    if arguments.get('legacy_only') is True:
        filters.append(Attr('legacy').eq(True))

    if not filters:
        return None

    expression = filters[0]
    for part in filters[1:]:
        expression = expression & part
    return expression


def _resolve_limit(requested):
    if isinstance(requested, int) and requested > 0:
        return min(requested, MAX_LIMIT)
    return DEFAULT_LIMIT


def _encode_token(token):
    if not token:
        return None
    raw = json.dumps(token)
    return base64.b64encode(raw.encode('utf-8')).decode('utf-8')


def _decode_token(token):
    if not token:
        return None
    try:
        decoded = base64.b64decode(token.encode('utf-8')).decode('utf-8')
        return json.loads(decoded)
    except Exception as exc:  # pylint: disable=broad-except
        print(f'Failed to decode nextToken: {exc}')
        return None


def _convert_types(value):
    if isinstance(value, list):
        return [_convert_types(item) for item in value]
    if isinstance(value, dict):
        return {key: _convert_types(val) for key, val in value.items()}
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    return value

