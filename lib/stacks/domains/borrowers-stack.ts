import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface BorrowersStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class BorrowersStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: BorrowersStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    const commonEnv = {
      REGION: this.region,
      COMPANIES_TABLE: tables.companies.tableName,
      USERS_TABLE: tables.users.tableName,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      LOANS_TABLE: tables.loans.tableName,
      TRANSACTIONS_TABLE: tables.transactions.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
    };

    // 1. bebco-staging-admin-borrowers-create-borrower-function
    const adminBorrowersCreate = new BebcoLambda(this, 'AdminBorrowersCreate', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-create-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadWriteData(adminBorrowersCreate.function);
    tables.users.grantReadWriteData(adminBorrowersCreate.function);
    this.functions.adminBorrowersCreate = adminBorrowersCreate.function;

    // 2. bebco-staging-admin-borrowers-get-borrower-function
    const adminBorrowersGet = new BebcoLambda(this, 'AdminBorrowersGet', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(adminBorrowersGet.function);
    tables.users.grantReadData(adminBorrowersGet.function);
    tables.accounts.grantReadData(adminBorrowersGet.function);
    this.functions.adminBorrowersGet = adminBorrowersGet.function;

    // 3. bebco-staging-admin-borrowers-list-borrowers-function
    const adminBorrowersList = new BebcoLambda(this, 'AdminBorrowersList', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-list-borrowers-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(adminBorrowersList.function);
    tables.users.grantReadData(adminBorrowersList.function);
    this.functions.adminBorrowersList = adminBorrowersList.function;

    // 4. bebco-staging-admin-borrowers-update-borrower-function
    const adminBorrowersUpdate = new BebcoLambda(this, 'AdminBorrowersUpdate', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-update-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadWriteData(adminBorrowersUpdate.function);
    tables.users.grantReadWriteData(adminBorrowersUpdate.function);
    this.functions.adminBorrowersUpdate = adminBorrowersUpdate.function;

    // 5. bebco-staging-admin-borrowers-get-borrower-summary-function
    const adminBorrowersSummary = new BebcoLambda(this, 'AdminBorrowersSummary', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-summary-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(adminBorrowersSummary.function);
    tables.loans.grantReadData(adminBorrowersSummary.function);
    tables.accounts.grantReadData(adminBorrowersSummary.function);
    this.functions.adminBorrowersSummary = adminBorrowersSummary.function;

    // 6. bebco-staging-admin-borrowers-get-borrower-transactions-function
    const adminBorrowersTransactions = new BebcoLambda(this, 'AdminBorrowersTransactions', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-transactions-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.transactions.grantReadData(adminBorrowersTransactions.function);
    tables.accounts.grantReadData(adminBorrowersTransactions.function);
    this.functions.adminBorrowersTransactions = adminBorrowersTransactions.function;

    // 7. bebco-staging-admin-borrower-settings
    const adminBorrowerSettings = new BebcoLambda(this, 'AdminBorrowerSettings', {
      sourceFunctionName: 'bebco-staging-admin-borrower-settings',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadWriteData(adminBorrowerSettings.function);
    this.functions.adminBorrowerSettings = adminBorrowerSettings.function;

    // 8. bebco-borrowers-api-listBorrowers (AppSync resolver)
    const borrowersApiList = new BebcoLambda(this, 'BorrowersApiList', {
      sourceFunctionName: 'bebco-borrowers-api-listBorrowers',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(borrowersApiList.function);
    this.functions.borrowersApiList = borrowersApiList.function;

    // 9. bebco-borrowers-api-getFinancialOverview (AppSync resolver)
    const borrowersApiFinancialOverview = new BebcoLambda(this, 'BorrowersApiFinancialOverview', {
      sourceFunctionName: 'bebco-borrowers-api-getFinancialOverview',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(borrowersApiFinancialOverview.function);
    tables.accounts.grantReadData(borrowersApiFinancialOverview.function);
    tables.transactions.grantReadData(borrowersApiFinancialOverview.function);
    this.functions.borrowersApiFinancialOverview = borrowersApiFinancialOverview.function;

    // 10. bebco-borrowers-api-batchGetFinancialOverviews (AppSync resolver)
    const borrowersApiBatchFinancialOverviews = new BebcoLambda(this, 'BorrowersApiBatchFinancialOverviews', {
      sourceFunctionName: 'bebco-borrowers-api-batchGetFinancialOverviews',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.companies.grantReadData(borrowersApiBatchFinancialOverviews.function);
    tables.accounts.grantReadData(borrowersApiBatchFinancialOverviews.function);
    tables.transactions.grantReadData(borrowersApiBatchFinancialOverviews.function);
    this.functions.borrowersApiBatchFinancialOverviews = borrowersApiBatchFinancialOverviews.function;
  }
}

