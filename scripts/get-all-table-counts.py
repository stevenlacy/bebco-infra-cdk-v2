#!/usr/bin/env python3
"""
Get comprehensive table counts across all environments
"""
import boto3
import json
from datetime import datetime
from collections import defaultdict

def get_all_table_counts(region='us-east-2'):
    dynamodb = boto3.client('dynamodb', region_name=region)
    
    print("Fetching all DynamoDB table counts...")
    print(f"Region: {region}")
    print("")
    
    # Get all tables
    response = dynamodb.list_tables()
    all_tables = response['TableNames']
    
    # Handle pagination
    while 'LastEvaluatedTableName' in response:
        response = dynamodb.list_tables(
            ExclusiveStartTableName=response['LastEvaluatedTableName']
        )
        all_tables.extend(response['TableNames'])
    
    # Filter for dev, jpl, din tables
    target_tables = [t for t in all_tables if t.endswith(('-dev', '-jpl', '-din'))]
    target_tables.sort()
    
    print(f"Found {len(target_tables)} tables across dev, jpl, din environments")
    print("")
    
    # Organize by base name and environment
    table_data = defaultdict(dict)
    
    for table_name in target_tables:
        # Get table details
        try:
            table_info = dynamodb.describe_table(TableName=table_name)
            item_count = table_info['Table']['ItemCount']
            status = table_info['Table']['TableStatus']
            
            # Extract base name and environment
            if table_name.endswith('-dev'):
                base_name = table_name[:-4]
                env = 'dev'
            elif table_name.endswith('-jpl'):
                base_name = table_name[:-4]
                env = 'jpl'
            elif table_name.endswith('-din'):
                base_name = table_name[:-4]
                env = 'din'
            else:
                continue
            
            table_data[base_name][env] = {
                'count': item_count,
                'status': status,
                'full_name': table_name
            }
            
        except Exception as e:
            print(f"Error fetching {table_name}: {e}")
    
    return table_data

def print_summary(table_data):
    """Print formatted summary"""
    
    print("="*120)
    print(f"{'TABLE NAME':<50} {'DEV':<20} {'JPL':<20} {'DIN':<20}")
    print("="*120)
    
    dev_total = 0
    jpl_total = 0
    din_total = 0
    
    for base_name in sorted(table_data.keys()):
        envs = table_data[base_name]
        
        dev_count = envs.get('dev', {}).get('count', 0)
        jpl_count = envs.get('jpl', {}).get('count', 0)
        din_count = envs.get('din', {}).get('count', 0)
        
        dev_total += dev_count
        jpl_total += jpl_count
        din_total += din_count
        
        # Color code mismatches
        match_indicator = ""
        if dev_count > 0:
            if jpl_count != dev_count or din_count != dev_count:
                match_indicator = " ⚠️"
        
        dev_str = f"{dev_count:,}" if dev_count > 0 else "-"
        jpl_str = f"{jpl_count:,}" if jpl_count > 0 else "-"
        din_str = f"{din_count:,}" if din_count > 0 else "-"
        
        print(f"{base_name:<50} {dev_str:<20} {jpl_str:<20} {din_str:<20}{match_indicator}")
    
    print("="*120)
    print(f"{'TOTALS':<50} {dev_total:,<20} {jpl_total:,<20} {din_total:,<20}")
    print("="*120)
    print("")
    
    # Summary statistics
    tables_with_data = sum(1 for base, envs in table_data.items() if envs.get('dev', {}).get('count', 0) > 0)
    tables_empty = sum(1 for base, envs in table_data.items() if envs.get('dev', {}).get('count', 0) == 0)
    
    print(f"Summary:")
    print(f"  Total table groups: {len(table_data)}")
    print(f"  Tables with data (dev): {tables_with_data}")
    print(f"  Empty tables (dev): {tables_empty}")
    print("")
    
    # Check for mismatches
    mismatches = []
    for base_name, envs in table_data.items():
        dev_count = envs.get('dev', {}).get('count', 0)
        jpl_count = envs.get('jpl', {}).get('count', 0)
        din_count = envs.get('din', {}).get('count', 0)
        
        if dev_count > 0 and (jpl_count != dev_count or din_count != dev_count):
            mismatches.append({
                'table': base_name,
                'dev': dev_count,
                'jpl': jpl_count,
                'din': din_count
            })
    
    if mismatches:
        print(f"⚠️  Tables with mismatched counts: {len(mismatches)}")
        for m in mismatches:
            print(f"  - {m['table']}: dev={m['dev']:,}, jpl={m['jpl']:,}, din={m['din']:,}")
    else:
        print("✅ All tables synchronized!")
    
    return {
        'total': {
            'dev': dev_total,
            'jpl': jpl_total,
            'din': din_total
        },
        'tables_with_data': tables_with_data,
        'tables_empty': tables_empty,
        'mismatches': mismatches
    }

def save_json_report(table_data, summary, filename='table-counts-report.json'):
    """Save detailed JSON report"""
    report = {
        'timestamp': datetime.now().isoformat(),
        'region': 'us-east-2',
        'summary': summary,
        'tables': {}
    }
    
    for base_name, envs in table_data.items():
        report['tables'][base_name] = {
            'dev': envs.get('dev', {}).get('count', 0),
            'jpl': envs.get('jpl', {}).get('count', 0),
            'din': envs.get('din', {}).get('count', 0),
            'dev_table': envs.get('dev', {}).get('full_name', ''),
            'jpl_table': envs.get('jpl', {}).get('full_name', ''),
            'din_table': envs.get('din', {}).get('full_name', '')
        }
    
    with open(filename, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDetailed JSON report saved to: {filename}")

if __name__ == '__main__':
    table_data = get_all_table_counts()
    summary = print_summary(table_data)
    save_json_report(table_data, summary)

