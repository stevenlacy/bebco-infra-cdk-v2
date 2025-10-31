import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';

export interface MigrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
}

export class MigrationStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: MigrationStackProps) {
    super(scope, id, props);

    const { resourceNames, tables } = props;

    // Migration Lambda: Copy transactions from jpl to stv
    const migrateTransactions = new lambda.Function(this, 'MigrateTransactions', {
      functionName: resourceNames.lambda('migration', 'transactions'),
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'migrate-transactions-jpl-to-stv.lambda_handler',
      code: lambda.Code.fromAsset('scripts'),
      timeout: cdk.Duration.minutes(15), // Allow time for large migrations
      memorySize: 3008, // Maximum for better performance
      environment: {
        REGION: this.region,
        SOURCE_TABLE: 'bebco-borrower-transactions-jpl',
        DEST_TABLE: tables.transactions.tableName,
        BATCH_SIZE: '25',
        MAX_ITEMS: '0', // 0 = unlimited
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant read permissions on source table (jpl)
    migrateTransactions.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:Scan',
        'dynamodb:Query',
        'dynamodb:GetItem',
      ],
      resources: [
        'arn:aws:dynamodb:us-east-2:303555290462:table/bebco-borrower-transactions-jpl',
        'arn:aws:dynamodb:us-east-2:303555290462:table/bebco-borrower-transactions-jpl/index/*',
      ],
    }));

    // Grant write permissions on destination table (stv)
    tables.transactions.grantWriteData(migrateTransactions);
    
    // Also grant query/scan for checking duplicates
    tables.transactions.grantReadData(migrateTransactions);

    this.functions.migrateTransactions = migrateTransactions;

    // Output function name for easy invocation
    new cdk.CfnOutput(this, 'MigrateTransactionsFunctionName', {
      value: migrateTransactions.functionName,
      description: 'Lambda function name for migrating transactions from jpl to stv',
    });
  }
}

