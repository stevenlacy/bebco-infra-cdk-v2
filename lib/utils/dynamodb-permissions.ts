import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const QUERY_SCAN_ACTIONS = ['dynamodb:Query', 'dynamodb:Scan'];

export function resourceWithIndexes(table: dynamodb.ITable): string[] {
  return [table.tableArn, `${table.tableArn}/index/*`];
}

export function addQueryScan(fn: lambda.IFunction, table: dynamodb.ITable) {
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: QUERY_SCAN_ACTIONS,
      resources: resourceWithIndexes(table),
    })
  );
}

export function grantReadDataWithQuery(fn: lambda.IFunction, ...tables: dynamodb.ITable[]) {
  tables.forEach(table => {
    table.grantReadData(fn);
    addQueryScan(fn, table);
  });
}

export function grantReadWriteDataWithQuery(fn: lambda.IFunction, ...tables: dynamodb.ITable[]) {
  tables.forEach(table => {
    table.grantReadWriteData(fn);
    addQueryScan(fn, table);
  });
}


