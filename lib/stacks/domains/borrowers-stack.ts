import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';

export interface BorrowersStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
}

export class BorrowersStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: BorrowersStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    const commonEnv = {
      REGION: this.region,
      TABLE_NAME: tables.loans.tableName,  // For AppSync Lambda
      COMPANIES_TABLE: tables.companies.tableName,
      USERS_TABLE: tables.users.tableName,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      LOANS_TABLE: tables.loans.tableName,
      TRANSACTIONS_TABLE: tables.transactions.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
    };

    // 1. bebco-staging-admin-borrowers-create-borrower-function
    const adminBorrowersCreate = new BebcoLambda(this, 'AdminBorrowersCreate', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-create-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(adminBorrowersCreate.function, tables.companies, tables.users);
    this.functions.adminBorrowersCreate = adminBorrowersCreate.function;

    // 2. bebco-staging-admin-borrowers-get-borrower-function
    const adminBorrowersGet = new BebcoLambda(this, 'AdminBorrowersGet', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(adminBorrowersGet.function, tables.companies, tables.users, tables.accounts, tables.loans);
    this.functions.adminBorrowersGet = adminBorrowersGet.function;

    // 3. bebco-staging-admin-borrowers-list-borrowers-function
    const adminBorrowersList = new BebcoLambda(this, 'AdminBorrowersList', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-list-borrowers-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(adminBorrowersList.function, tables.companies, tables.users);
    this.functions.adminBorrowersList = adminBorrowersList.function;

    // 4. bebco-staging-admin-borrowers-update-borrower-function
    const adminBorrowersUpdate = new BebcoLambda(this, 'AdminBorrowersUpdate', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-update-borrower-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(adminBorrowersUpdate.function, tables.companies, tables.users);
    this.functions.adminBorrowersUpdate = adminBorrowersUpdate.function;

    // 5. bebco-staging-admin-borrowers-get-borrower-summary-function
    const adminBorrowersSummary = new BebcoLambda(this, 'AdminBorrowersSummary', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-summary-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(adminBorrowersSummary.function, tables.companies, tables.loans, tables.accounts);
    this.functions.adminBorrowersSummary = adminBorrowersSummary.function;

    // 6. bebco-staging-admin-borrowers-get-borrower-transactions-function
    const adminBorrowersTransactions = new BebcoLambda(this, 'AdminBorrowersTransactions', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-get-borrower-transactions-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: { ...commonEnv, FORCE_UPDATE: 'gsi-refresh-loannumber-v2' },
      // Override to use repository source for reliability (fix 502s)
      codeAsset: lambda.Code.fromAsset(path.join(__dirname, '../../../..', 'AdminPortal', 'lambda_functions', 'borrowers')),
      runtimeOverride: lambda.Runtime.PYTHON_3_11,
      handlerOverride: 'get_borrower_transactions.lambda_handler',
    });
    grantReadDataWithQuery(adminBorrowersTransactions.function, tables.transactions, tables.accounts, tables.companies, tables.loans);
    this.functions.adminBorrowersTransactions = adminBorrowersTransactions.function;

    // 7. bebco-staging-admin-borrower-settings
    const adminBorrowerSettings = new BebcoLambda(this, 'AdminBorrowerSettings', {
      sourceFunctionName: 'bebco-staging-admin-borrower-settings',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(adminBorrowerSettings.function, tables.companies);
    this.functions.adminBorrowerSettings = adminBorrowerSettings.function;

    // 8. bebco-borrowers-api-listBorrowers (AppSync resolver)
    const borrowersApiList = new BebcoLambda(this, 'BorrowersApiList', {
      sourceFunctionName: 'bebco-borrowers-api-listBorrowers',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        DESCRIPTION: 'AppSync GraphQL resolver for listing borrowers', // Force update
      },
    });
    grantReadDataWithQuery(borrowersApiList.function, tables.companies, tables.loans);
    this.functions.borrowersApiList = borrowersApiList.function;

    // 9. bebco-borrowers-api-getFinancialOverview (AppSync resolver)
    const borrowersApiFinancialOverview = new BebcoLambda(this, 'BorrowersApiFinancialOverview', {
      sourceFunctionName: 'bebco-borrowers-api-getFinancialOverview',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(borrowersApiFinancialOverview.function, tables.companies, tables.accounts, tables.transactions, tables.loans);
    this.functions.borrowersApiFinancialOverview = borrowersApiFinancialOverview.function;

    // 10. bebco-borrowers-api-batchGetFinancialOverviews (AppSync resolver)
    const borrowersApiBatchFinancialOverviews = new BebcoLambda(this, 'BorrowersApiBatchFinancialOverviews', {
      sourceFunctionName: 'bebco-borrowers-api-batchGetFinancialOverviews',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: { ...commonEnv, FORCE_UPDATE: 'iam-refresh-20251028' },
    });
    grantReadDataWithQuery(borrowersApiBatchFinancialOverviews.function, tables.companies, tables.accounts, tables.transactions, tables.loans);
    // TEMP: Allow access to legacy-named staging loans table referenced by packaged code
    borrowersApiBatchFinancialOverviews.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:DescribeTable'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-loans`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-loans/index/*`,
      ],
    }));
    this.functions.borrowersApiBatchFinancialOverviews = borrowersApiBatchFinancialOverviews.function;
  }
}

