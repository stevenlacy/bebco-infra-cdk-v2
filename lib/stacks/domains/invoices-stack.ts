import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

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
    };

    // 1. bebco-staging-invoices-create
    const invoicesCreate = new BebcoLambda(this, 'InvoicesCreate', {
      sourceFunctionName: 'bebco-staging-invoices-create',
      resourceNames,
      environment: commonEnv,
    });
    tables.invoices.grantReadWriteData(invoicesCreate.function);
    this.functions.invoicesCreate = invoicesCreate.function;

    // 2. bebco-staging-invoices-get
    const invoicesGet = new BebcoLambda(this, 'InvoicesGet', {
      sourceFunctionName: 'bebco-staging-invoices-get',
      resourceNames,
      environment: commonEnv,
    });
    tables.invoices.grantReadData(invoicesGet.function);
    this.functions.invoicesGet = invoicesGet.function;

    // 3. bebco-staging-invoices-list
    const invoicesList = new BebcoLambda(this, 'InvoicesList', {
      sourceFunctionName: 'bebco-staging-invoices-list',
      resourceNames,
      environment: commonEnv,
    });
    tables.invoices.grantReadData(invoicesList.function);
    this.functions.invoicesList = invoicesList.function;

    // 4. bebco-staging-invoices-update
    const invoicesUpdate = new BebcoLambda(this, 'InvoicesUpdate', {
      sourceFunctionName: 'bebco-staging-invoices-update',
      resourceNames,
      environment: commonEnv,
    });
    tables.invoices.grantReadWriteData(invoicesUpdate.function);
    this.functions.invoicesUpdate = invoicesUpdate.function;

    // 5. bebco-staging-invoices-generate-monthly
    const invoicesGenerateMonthly = new BebcoLambda(this, 'InvoicesGenerateMonthly', {
      sourceFunctionName: 'bebco-staging-invoices-generate-monthly',
      resourceNames,
      environment: commonEnv,
    });
    tables.invoices.grantReadWriteData(invoicesGenerateMonthly.function);
    tables.companies.grantReadData(invoicesGenerateMonthly.function);
    buckets.documents.grantReadWrite(invoicesGenerateMonthly.function);
    this.functions.invoicesGenerateMonthly = invoicesGenerateMonthly.function;
  }
}

