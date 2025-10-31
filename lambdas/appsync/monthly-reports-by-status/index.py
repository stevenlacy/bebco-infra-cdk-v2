import base64
import json
import os
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key


TABLE_NAME = os.environ['MONTHLY_REPORTS_TABLE']
INDEX_NAME = os.environ.get('MONTHLY_REPORTS_STATUS_INDEX', 'StatusIndex')
DEFAULT_LIMIT = int(os.environ.get('MONTHLY_REPORTS_DEFAULT_LIMIT', '1000'))
MAX_LIMIT = int(os.environ.get('MONTHLY_REPORTS_MAX_LIMIT', '5000'))
COMPANIES_TABLE = os.environ['COMPANIES_TABLE']

dynamodb = boto3.resource('dynamodb')
monthly_reports_table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, _context):
    print('monthlyReportsByStatus event', json.dumps(event))

    arguments = event.get('arguments') or {}
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

    response = monthly_reports_table.query(**params)

    raw_items: List[Dict] = response.get('Items', [])
    converted_items = [_convert_types(item) for item in raw_items]

    company_ids = {item.get('company_id') for item in converted_items if item.get('company_id')}
    companies = _fetch_companies(company_ids)

    needs_enrichment = [item for item in converted_items if _needs_enrichment(item)]
    print(
        'monthlyReportsByStatus records needing enrichment:',
        len(needs_enrichment),
        'out of',
        len(converted_items)
    )

    enriched_items = [_enrich_item(item, companies) for item in converted_items]

    next_token = _encode_token(response.get('LastEvaluatedKey'))

    result = {
        'items': enriched_items,
    }
    if next_token is not None:
        result['nextToken'] = next_token

    print(
        'monthlyReportsByStatus returning',
        len(enriched_items),
        'items with nextToken =',
        'yes' if next_token else 'no'
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


def _needs_enrichment(item: Dict) -> bool:
    if not item.get('company_id'):
        return False
    company_no = item.get('company_no')
    company_name = item.get('company_name')
    bank_id = item.get('bank_id')
    return (
        company_no in (None, 0)
        or not _has_value(company_name)
        or not _has_value(bank_id)
    )


def _has_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ''
    return True


def _enrich_item(item: Dict, companies: Dict[str, Dict]) -> Dict:
    company_id = item.get('company_id')
    if not company_id:
        return item

    company = companies.get(company_id)
    if not company:
        return item

    if item.get('company_no') in (None, 0):
        company_no = _safe_int(company.get('company_no'))
        if company_no is not None:
            item['company_no'] = company_no

    if not _has_value(item.get('bank_id')) and _has_value(company.get('bank_id')):
        item['bank_id'] = company['bank_id']

    if not _has_value(item.get('company_name')):
        preferred_name = (
            company.get('name')
            or company.get('short_name')
            or company.get('entity_name')
        )
        if preferred_name:
            item['company_name'] = preferred_name

    return item


def _safe_int(value) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip())
        except ValueError:
            return None
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return None
    return None


def _fetch_companies(company_ids: Iterable[str]) -> Dict[str, Dict]:
    ids = [company_id for company_id in company_ids if isinstance(company_id, str) and company_id.strip()]
    if not ids:
        return {}

    projection_expression = 'id, company_no, bank_id, #n, short_name, entity_name'
    expression_attribute_names = {'#n': 'name'}

    results: Dict[str, Dict] = {}
    for chunk in _chunks(ids, 100):
        request_items = {
            COMPANIES_TABLE: {
                'Keys': [{'id': value} for value in chunk],
                'ProjectionExpression': projection_expression,
                'ExpressionAttributeNames': expression_attribute_names,
            }
        }

        response = dynamodb.batch_get_item(RequestItems=request_items)
        _accumulate_companies(response, results)

        unprocessed = response.get('UnprocessedKeys', {})
        while unprocessed:
            response = dynamodb.batch_get_item(RequestItems=unprocessed)
            _accumulate_companies(response, results)
            unprocessed = response.get('UnprocessedKeys', {})

    print('monthlyReportsByStatus loaded company profiles:', len(results))
    return results


def _accumulate_companies(response: Dict, results: Dict[str, Dict]) -> None:
    records = response.get('Responses', {}).get(COMPANIES_TABLE, [])
    for record in records:
        converted = _convert_types(record)
        company_id = converted.get('id')
        if company_id:
            results[company_id] = converted


def _chunks(values: List[str], size: int) -> Iterable[List[str]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


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


