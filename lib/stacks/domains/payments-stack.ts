import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';

export interface PaymentsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class PaymentsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: PaymentsStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    const commonEnv = {
      REGION: this.region,
      MAX_PAGE_SIZE: '1000',
      PAYMENTS_TABLE: tables.payments.tableName,
      COMPANIES_TABLE: tables.companies.tableName,
      LOANS_TABLE: tables.loans.tableName,
      INVOICES_TABLE: tables.invoices.tableName,
      BANKS_TABLE: tables.banks.tableName,
      MONTHLY_REPORTINGS_TABLE: tables.monthlyReportings.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      ACH_BATCHES_TABLE: tables.achBatches.tableName,
      // Backcompat for packaged code that still reads DYNAMODB_TABLE
      DYNAMODB_TABLE: tables.loans.tableName,
      DYNAMODB_TABLE_NAME: tables.loans.tableName,
      TABLE_NAME: tables.loans.tableName,
    };
    
    // Payment operations
    const paymentsCreate = new BebcoLambda(this, 'PaymentsCreate', {
      sourceFunctionName: 'bebco-staging-payments-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(paymentsCreate.function, tables.payments, tables.loans);
    grantReadDataWithQuery(paymentsCreate.function, tables.companies, tables.invoices, tables.monthlyReportings);
    this.functions.paymentsCreate = paymentsCreate.function;
    
    const paymentsGet = new BebcoLambda(this, 'PaymentsGet', {
      sourceFunctionName: 'bebco-staging-payments-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.paymentsGet = paymentsGet.function;
    
    const paymentsList = new BebcoLambda(this, 'PaymentsList', {
      sourceFunctionName: 'bebco-staging-payments-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.paymentsList = paymentsList.function;
    grantReadDataWithQuery(paymentsList.function, tables.payments, tables.companies);

    // Grant access to tables via environment-specific ARNs
    tables.loanLoc.grantReadData(paymentsList.function);
    tables.payments.grantReadData(paymentsList.function);
    tables.companies.grantReadData(paymentsList.function);
    
    const paymentsUpdate = new BebcoLambda(this, 'PaymentsUpdate', {
      sourceFunctionName: 'bebco-borrower-staging-payments-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.paymentsUpdate = paymentsUpdate.function;
    
    // ACH operations
    const paymentsAchBatches = new BebcoLambda(this, 'PaymentsAchBatches', {
      sourceFunctionName: 'bebco-staging-payments-ach-batches',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(paymentsAchBatches.function, tables.payments, tables.invoices, tables.achBatches);
    grantReadDataWithQuery(paymentsAchBatches.function, tables.companies, tables.banks, tables.loans);
    buckets.documents.grantReadWrite(paymentsAchBatches.function);
    this.functions.paymentsAchBatches = paymentsAchBatches.function;
    
    const paymentsAchConsentCreate = new BebcoLambda(this, 'PaymentsAchConsentCreate', {
      sourceFunctionName: 'bebco-staging-payments-ach-consent-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.paymentsAchConsentCreate = paymentsAchConsentCreate.function;
    
    // Admin operations
    const adminPaymentsWaive = new BebcoLambda(this, 'AdminPaymentsWaive', {
      sourceFunctionName: 'bebco-staging-admin-payments-waive',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        MONTHLY_REPORTINGS_TABLE: tables.monthlyReportings.tableName,
        MONTHLY_REPORTS_TABLE: tables.monthlyReportings.tableName,
        INVOICES_TABLE: tables.loanLoc.tableName,
      },
    });
    this.functions.adminPaymentsWaive = adminPaymentsWaive.function;
    // Grant permissions to read monthly reports and update invoices in loan-loc
    tables.monthlyReportings.grantReadWriteData(adminPaymentsWaive.function);
    tables.loanLoc.grantReadWriteData(adminPaymentsWaive.function);
    tables.payments.grantReadWriteData(adminPaymentsWaive.function);
    
    new cdk.CfnOutput(this, 'PaymentsCreateArn', {
      value: this.functions.paymentsCreate.functionArn,
    });
  }
}

