import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';

export interface InvoicesStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class InvoicesStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: InvoicesStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    const commonEnv = {
      REGION: this.region,
      INVOICES_TABLE: tables.invoices.tableName,
      COMPANIES_TABLE: tables.companies.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      // Backcompat for packaged code that still reads DYNAMODB_TABLE
      DYNAMODB_TABLE: tables.loans.tableName,
      DYNAMODB_TABLE_NAME: tables.loans.tableName,
      TABLE_NAME: tables.loans.tableName,
    };

    // 1. bebco-staging-invoices-create
    const invoicesCreate = new BebcoLambda(this, 'InvoicesCreate', {
      sourceFunctionName: 'bebco-staging-invoices-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(invoicesCreate.function, tables.invoices);
    this.functions.invoicesCreate = invoicesCreate.function;

    // 2. bebco-staging-invoices-get
    const invoicesGet = new BebcoLambda(this, 'InvoicesGet', {
      sourceFunctionName: 'bebco-staging-invoices-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(invoicesGet.function, tables.invoices);
    this.functions.invoicesGet = invoicesGet.function;

    // 3. bebco-staging-invoices-list
    const invoicesList = new BebcoLambda(this, 'InvoicesList', {
      sourceFunctionName: 'bebco-staging-invoices-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(invoicesList.function, tables.invoices, tables.companies);
    this.functions.invoicesList = invoicesList.function;

    // TEMP: Allow access to legacy-named staging companies table referenced by packaged code
    invoicesList.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan', 'dynamodb:GetItem', 'dynamodb:Query'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-companies`,
      ],
    }));

    // TEMP: Allow access to legacy-named staging invoices storage still used by packaged code
    invoicesList.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan', 'dynamodb:GetItem', 'dynamodb:Query'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-loan-loc`,
      ],
    }));

    // 4. bebco-staging-invoices-update
    const invoicesUpdate = new BebcoLambda(this, 'InvoicesUpdate', {
      sourceFunctionName: 'bebco-staging-invoices-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(invoicesUpdate.function, tables.invoices);
    this.functions.invoicesUpdate = invoicesUpdate.function;

    // 5. bebco-staging-invoices-generate-monthly
    const invoicesGenerateMonthly = new BebcoLambda(this, 'InvoicesGenerateMonthly', {
      sourceFunctionName: 'bebco-staging-invoices-generate-monthly',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(invoicesGenerateMonthly.function, tables.invoices);
    grantReadDataWithQuery(invoicesGenerateMonthly.function, tables.companies);
    buckets.documents.grantReadWrite(invoicesGenerateMonthly.function);
    this.functions.invoicesGenerateMonthly = invoicesGenerateMonthly.function;
  }
}

