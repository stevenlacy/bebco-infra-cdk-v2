import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';
import * as path from 'path';

export interface StatementsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class StatementsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: StatementsStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    const commonEnv = {
      REGION: this.region,
      MONTHLY_REPORTS_TABLE: tables.monthlyReportings.tableName,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      STATEMENTS_S3_BUCKET: buckets.statements?.bucketName || buckets.documents.bucketName, // Fallback if statements bucket doesn't exist
    };

    // 1. bebco-staging-admin-list-statements
    const adminListStatements = new BebcoLambda(this, 'AdminListStatements', {
      sourceFunctionName: 'bebco-staging-admin-list-statements',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(adminListStatements.function, tables.monthlyReportings);
    buckets.documents.grantRead(adminListStatements.function);
    // Grant access to legacy statements table (if it exists in tables)
    if (tables.legacyStatements) {
      grantReadDataWithQuery(adminListStatements.function, tables.legacyStatements);
    }
    this.functions.adminListStatements = adminListStatements.function;

    // 2. bebco-staging-admin-upload-statements
    const adminUploadStatements = new BebcoLambda(this, 'AdminUploadStatements', {
      sourceFunctionName: 'bebco-staging-admin-upload-statements',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(adminUploadStatements.function, tables.monthlyReportings);
    buckets.documents.grantReadWrite(adminUploadStatements.function);
    this.functions.adminUploadStatements = adminUploadStatements.function;

    // 3. bebco-staging-statements-financials
    const statementsFinancials = new BebcoLambda(this, 'StatementsFinancials', {
      sourceFunctionName: 'bebco-staging-statements-financials',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(statementsFinancials.function, tables.monthlyReportings, tables.accounts);
    this.functions.statementsFinancials = statementsFinancials.function;

    // 4. bebco-staging-statements-get-url
    const statementsGetUrl = new BebcoLambda(this, 'StatementsGetUrl', {
      sourceFunctionName: 'bebco-staging-statements-get-url',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    buckets.documents.grantRead(statementsGetUrl.function);
    this.functions.statementsGetUrl = statementsGetUrl.function;

    // 5. bebco-statements-stream-publisher
    const statementsStreamPublisher = new BebcoLambda(this, 'StatementsStreamPublisher', {
      sourceFunctionName: 'bebco-statements-stream-publisher',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantStreamRead(statementsStreamPublisher.function);
    // TODO: Add EventBridge/SNS permissions if needed
    this.functions.statementsStreamPublisher = statementsStreamPublisher.function;

    // 6. repo-managed fallback for listing company statements (returns empty list if none)
    const listCompanyStatements = new BebcoLambda(this, 'ListCompanyStatements', {
      sourceFunctionName: 'bebco-staging-admin-list-statements', // placeholder for metadata
      newFunctionName: `bebco-admin-list-company-statements-${props.config.naming.environmentSuffix}`,
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
      codeAsset: lambda.Code.fromAsset(path.join(__dirname, '../../../..', 'AdminPortal', 'lambda_functions', 'statements')),
      runtimeOverride: lambda.Runtime.PYTHON_3_12,
      handlerOverride: 'list_company_statements.lambda_handler',
    });
    this.functions.listCompanyStatements = listCompanyStatements.function;
  }
}

