import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface MiscStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class MiscStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: MiscStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    // 1. bebco-change-tracker
    const changeTracker = new BebcoLambda(this, 'ChangeTracker', {
      sourceFunctionName: 'bebco-change-tracker',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        REGION: this.region,
        CHANGE_TRACKING_BUCKET: buckets.changeTracking.bucketName,
      },
    });
    buckets.changeTracking.grantReadWrite(changeTracker.function);
    // Grant stream read permissions to all tables that need change tracking
    Object.values(tables).forEach(table => {
      table.grantStreamRead(changeTracker.function);
    });
    this.functions.changeTracker = changeTracker.function;

    // 2. bebco-lambda-backup-function
    const lambdaBackup = new BebcoLambda(this, 'LambdaBackup', {
      sourceFunctionName: 'bebco-lambda-backup-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        REGION: this.region,
        BACKUP_BUCKET: buckets.lambdaDeployments.bucketName, // Using lambda deployments bucket for backups
      },
    });
    buckets.lambdaDeployments.grantWrite(lambdaBackup.function);
    // TODO: Grant Lambda read permissions to list and get function code
    this.functions.lambdaBackup = lambdaBackup.function;

    // 3. bebco-borrower-staging-admin-nacha-download
    const adminNachaDownload = new BebcoLambda(this, 'AdminNachaDownload', {
      sourceFunctionName: 'bebco-borrower-staging-admin-nacha-download',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        REGION: this.region,
        PAYMENTS_TABLE: tables.payments?.tableName || 'bebco-borrower-dev-payments', // Fallback
        ACH_BATCHES_TABLE: tables.achBatches?.tableName || 'bebco-borrower-dev-ach-batches', // Fallback
      },
    });
    if (tables.payments) {
      tables.payments.grantReadData(adminNachaDownload.function);
    }
    if (tables.achBatches) {
      tables.achBatches.grantReadData(adminNachaDownload.function);
    }
    this.functions.adminNachaDownload = adminNachaDownload.function;
  }
}

