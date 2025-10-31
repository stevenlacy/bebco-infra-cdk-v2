import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery } from '../../utils/dynamodb-permissions';

export interface PaymentsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
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
      // Backcompat for packaged code that still reads DYNAMODB_TABLE
      DYNAMODB_TABLE: tables.loans.tableName,
      DYNAMODB_TABLE_NAME: tables.loans.tableName,
      TABLE_NAME: tables.loans.tableName,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
    };
    
    // Payment operations
    const paymentsCreate = new BebcoLambda(this, 'PaymentsCreate', {
      sourceFunctionName: 'bebco-staging-payments-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
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

    // TEMP: Allow access to legacy-named staging tables referenced by packaged code
    paymentsList.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-loan-loc`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-payments`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-companies`,
      ],
    }));
    
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
      environment: commonEnv,
    });
    this.functions.adminPaymentsWaive = adminPaymentsWaive.function;
    
    new cdk.CfnOutput(this, 'PaymentsCreateArn', {
      value: this.functions.paymentsCreate.functionArn,
    });
  }
}

