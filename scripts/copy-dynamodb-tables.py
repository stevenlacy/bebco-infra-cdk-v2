#!/usr/bin/env python3
"""
DynamoDB Table Data Copy Script

Copies data from -dev tables to -jpl and -din tables in us-east-2 region.
Supports resumption from checkpoint if interrupted.
"""

import boto3
import json
import sys
import time
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Set
import argparse
from pathlib import Path

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert DynamoDB Decimal types to JSON"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)

class DynamoDBTableCopier:
    def __init__(self, region='us-east-2', log_dir='./dynamodb-copy-logs'):
        self.region = region
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.dynamodb_client = boto3.client('dynamodb', region_name=region)
        
        # Create log directory
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        # Setup log files
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.log_file = self.log_dir / f'copy_log_{timestamp}.jsonl'
        self.checkpoint_file = self.log_dir / 'checkpoint.json'
        self.summary_file = self.log_dir / f'summary_{timestamp}.json'
        
        # Statistics
        self.stats = {
            'start_time': datetime.now().isoformat(),
            'tables_processed': 0,
            'tables_failed': 0,
            'total_items_copied': 0,
            'failed_items': [],
            'completed_tables': [],
            'failed_tables': []
        }
        
        print(f"{Colors.HEADER}{Colors.BOLD}=== DynamoDB Table Copy Utility ==={Colors.ENDC}")
        print(f"{Colors.OKCYAN}Region: {region}{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Log Directory: {self.log_dir.absolute()}{Colors.ENDC}\n")

    def log_event(self, event_type: str, message: str, data: Dict = None):
        """Log events to JSONL file for detailed tracking"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'message': message,
            'data': data or {}
        }
        
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(log_entry, cls=DecimalEncoder) + '\n')

    def save_checkpoint(self, completed_tables: List[str]):
        """Save checkpoint of completed tables"""
        checkpoint = {
            'timestamp': datetime.now().isoformat(),
            'completed_tables': completed_tables
        }
        
        with open(self.checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2)
        
        self.log_event('checkpoint', 'Checkpoint saved', checkpoint)

    def load_checkpoint(self) -> Set[str]:
        """Load checkpoint of completed tables"""
        if self.checkpoint_file.exists():
            with open(self.checkpoint_file, 'r') as f:
                checkpoint = json.load(f)
                completed = set(checkpoint.get('completed_tables', []))
                print(f"{Colors.WARNING}Resuming from checkpoint: {len(completed)} tables already completed{Colors.ENDC}\n")
                return completed
        return set()

    def get_dev_tables(self) -> List[str]:
        """Get all tables ending with -dev"""
        response = self.dynamodb_client.list_tables()
        all_tables = response['TableNames']
        
        # Handle pagination
        while 'LastEvaluatedTableName' in response:
            response = self.dynamodb_client.list_tables(
                ExclusiveStartTableName=response['LastEvaluatedTableName']
            )
            all_tables.extend(response['TableNames'])
        
        dev_tables = [t for t in all_tables if t.endswith('-dev')]
        return sorted(dev_tables)

    def get_table_item_count(self, table_name: str) -> int:
        """Get approximate item count for a table"""
        try:
            table = self.dynamodb.Table(table_name)
            return table.item_count
        except Exception as e:
            self.log_event('error', f'Failed to get item count for {table_name}', {'error': str(e)})
            return 0

    def get_target_tables(self, source_table: str) -> List[str]:
        """Get target table names (-jpl and -din) for a given source table"""
        base_name = source_table[:-4]  # Remove '-dev'
        return [f"{base_name}-jpl", f"{base_name}-din"]

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        try:
            self.dynamodb_client.describe_table(TableName=table_name)
            return True
        except self.dynamodb_client.exceptions.ResourceNotFoundException:
            return False
        except Exception as e:
            self.log_event('error', f'Error checking table existence: {table_name}', {'error': str(e)})
            return False

    def copy_table_data(self, source_table: str, target_table: str) -> Dict:
        """Copy data from source table to target table"""
        print(f"{Colors.OKBLUE}  → Copying {source_table} to {target_table}...{Colors.ENDC}")
        
        result = {
            'source': source_table,
            'target': target_table,
            'items_copied': 0,
            'items_failed': 0,
            'success': True,
            'error': None
        }
        
        try:
            source = self.dynamodb.Table(source_table)
            target = self.dynamodb.Table(target_table)
            
            # Scan source table
            scan_kwargs = {}
            items_in_batch = 0
            batch_number = 0
            
            while True:
                response = source.scan(**scan_kwargs)
                items = response.get('Items', [])
                
                if not items:
                    break
                
                batch_number += 1
                items_in_batch = len(items)
                
                # Batch write to target table
                with target.batch_writer() as batch:
                    for item in items:
                        try:
                            batch.put_item(Item=item)
                            result['items_copied'] += 1
                        except Exception as e:
                            result['items_failed'] += 1
                            self.log_event('item_error', f'Failed to copy item', {
                                'source': source_table,
                                'target': target_table,
                                'error': str(e),
                                'item': json.dumps(item, cls=DecimalEncoder)[:200]  # First 200 chars
                            })
                
                # Progress update
                print(f"{Colors.OKCYAN}    Batch {batch_number}: Copied {items_in_batch} items "
                      f"(Total: {result['items_copied']}, Failed: {result['items_failed']}){Colors.ENDC}")
                
                # Check if there are more items to scan
                if 'LastEvaluatedKey' not in response:
                    break
                
                scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
                
                # Small delay to avoid throttling
                time.sleep(0.1)
            
            if result['items_failed'] > 0:
                result['success'] = False
                print(f"{Colors.WARNING}    ⚠ Completed with {result['items_failed']} failed items{Colors.ENDC}")
            else:
                print(f"{Colors.OKGREEN}    ✓ Successfully copied {result['items_copied']} items{Colors.ENDC}")
            
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
            print(f"{Colors.FAIL}    ✗ Error: {str(e)}{Colors.ENDC}")
            self.log_event('table_error', f'Failed to copy table', {
                'source': source_table,
                'target': target_table,
                'error': str(e)
            })
        
        return result

    def process_table(self, source_table: str) -> bool:
        """Process a single source table, copying to all target tables"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}Processing: {source_table}{Colors.ENDC}")
        
        # Get item count
        item_count = self.get_table_item_count(source_table)
        print(f"{Colors.OKCYAN}Source table contains approximately {item_count} items{Colors.ENDC}")
        
        if item_count == 0:
            print(f"{Colors.WARNING}⚠ Source table is empty, skipping...{Colors.ENDC}")
            self.log_event('skip', f'Source table is empty', {'table': source_table})
            return True
        
        # Get target tables
        target_tables = self.get_target_tables(source_table)
        
        # Check if target tables exist
        existing_targets = []
        for target in target_tables:
            if self.table_exists(target):
                existing_targets.append(target)
            else:
                print(f"{Colors.WARNING}⚠ Target table does not exist: {target}{Colors.ENDC}")
                self.log_event('warning', f'Target table does not exist', {'target': target})
        
        if not existing_targets:
            print(f"{Colors.FAIL}✗ No valid target tables found, skipping...{Colors.ENDC}")
            return False
        
        # Copy to each target table
        all_success = True
        for target in existing_targets:
            result = self.copy_table_data(source_table, target)
            
            if result['success']:
                self.stats['total_items_copied'] += result['items_copied']
            else:
                all_success = False
                self.stats['failed_tables'].append({
                    'source': source_table,
                    'target': target,
                    'error': result.get('error')
                })
            
            self.log_event('copy_complete', 'Table copy completed', result)
        
        return all_success

    def run(self, dry_run=False):
        """Main execution method"""
        print(f"{Colors.BOLD}Scanning for tables...{Colors.ENDC}")
        
        # Get all dev tables
        dev_tables = self.get_dev_tables()
        print(f"{Colors.OKGREEN}Found {len(dev_tables)} -dev tables{Colors.ENDC}\n")
        
        if not dev_tables:
            print(f"{Colors.WARNING}No tables ending with -dev found{Colors.ENDC}")
            return
        
        # Load checkpoint
        completed_tables = self.load_checkpoint()
        remaining_tables = [t for t in dev_tables if t not in completed_tables]
        
        if dry_run:
            print(f"{Colors.WARNING}{Colors.BOLD}DRY RUN MODE - No data will be copied{Colors.ENDC}\n")
            print(f"Tables to process: {len(remaining_tables)}")
            for table in remaining_tables[:10]:  # Show first 10
                print(f"  - {table}")
            if len(remaining_tables) > 10:
                print(f"  ... and {len(remaining_tables) - 10} more")
            return
        
        print(f"{Colors.BOLD}Tables to process: {len(remaining_tables)}/{len(dev_tables)}{Colors.ENDC}")
        print(f"{Colors.BOLD}{'='*80}{Colors.ENDC}\n")
        
        # Process each table
        for idx, source_table in enumerate(remaining_tables, 1):
            print(f"{Colors.BOLD}[{idx}/{len(remaining_tables)}]{Colors.ENDC}", end=" ")
            
            try:
                success = self.process_table(source_table)
                
                if success:
                    self.stats['tables_processed'] += 1
                    self.stats['completed_tables'].append(source_table)
                    completed_tables.add(source_table)
                else:
                    self.stats['tables_failed'] += 1
                
                # Save checkpoint after each table
                self.save_checkpoint(list(completed_tables))
                
            except KeyboardInterrupt:
                print(f"\n{Colors.WARNING}{Colors.BOLD}Interrupted by user{Colors.ENDC}")
                self.save_checkpoint(list(completed_tables))
                self.save_summary()
                sys.exit(1)
            except Exception as e:
                print(f"{Colors.FAIL}Unexpected error: {str(e)}{Colors.ENDC}")
                self.log_event('fatal_error', 'Unexpected error', {
                    'table': source_table,
                    'error': str(e)
                })
                self.stats['tables_failed'] += 1
        
        # Final summary
        self.print_summary()
        self.save_summary()

    def print_summary(self):
        """Print final summary"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}COPY OPERATION COMPLETE{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}\n")
        
        print(f"{Colors.OKGREEN}✓ Tables successfully processed: {self.stats['tables_processed']}{Colors.ENDC}")
        print(f"{Colors.OKGREEN}✓ Total items copied: {self.stats['total_items_copied']}{Colors.ENDC}")
        
        if self.stats['tables_failed'] > 0:
            print(f"{Colors.FAIL}✗ Tables with failures: {self.stats['tables_failed']}{Colors.ENDC}")
            print(f"{Colors.WARNING}Check log file for details: {self.log_file}{Colors.ENDC}")
        
        print(f"\n{Colors.OKCYAN}Summary saved to: {self.summary_file}{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Detailed log: {self.log_file}{Colors.ENDC}")
        
        if self.checkpoint_file.exists():
            print(f"{Colors.OKCYAN}Checkpoint file: {self.checkpoint_file}{Colors.ENDC}")

    def save_summary(self):
        """Save final summary to JSON file"""
        self.stats['end_time'] = datetime.now().isoformat()
        
        # Calculate duration
        start = datetime.fromisoformat(self.stats['start_time'])
        end = datetime.fromisoformat(self.stats['end_time'])
        duration = (end - start).total_seconds()
        self.stats['duration_seconds'] = duration
        self.stats['duration_human'] = f"{int(duration // 60)}m {int(duration % 60)}s"
        
        with open(self.summary_file, 'w') as f:
            json.dump(self.stats, f, indent=2, cls=DecimalEncoder)

def main():
    parser = argparse.ArgumentParser(
        description='Copy data from DynamoDB -dev tables to -jpl and -din tables',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be copied
  ./copy-dynamodb-tables.py --dry-run
  
  # Run the actual copy operation
  ./copy-dynamodb-tables.py
  
  # Resume from a previous interrupted run (automatic if checkpoint exists)
  ./copy-dynamodb-tables.py
  
  # Use custom log directory
  ./copy-dynamodb-tables.py --log-dir /path/to/logs
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be copied without actually copying'
    )
    
    parser.add_argument(
        '--log-dir',
        default='./dynamodb-copy-logs',
        help='Directory to store logs and checkpoints (default: ./dynamodb-copy-logs)'
    )
    
    parser.add_argument(
        '--region',
        default='us-east-2',
        help='AWS region (default: us-east-2)'
    )
    
    args = parser.parse_args()
    
    try:
        copier = DynamoDBTableCopier(region=args.region, log_dir=args.log_dir)
        copier.run(dry_run=args.dry_run)
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Operation cancelled by user{Colors.ENDC}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.FAIL}Fatal error: {str(e)}{Colors.ENDC}")
        sys.exit(1)

if __name__ == '__main__':
    main()

