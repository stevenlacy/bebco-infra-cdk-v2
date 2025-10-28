import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { addQueryScan, grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';

export interface AccountsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  textractRole: iam.IRole;
  textractResultsTopic: sns.ITopic;
}

export class AccountsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets, config, textractRole, textractResultsTopic } = props;
    const baseLambdaProps = {
      resourceNames,
      config,
      environmentSuffix: config.naming.environmentSuffix,
    };
    
    // Common environment variables for account functions
    const commonEnv = {
      REGION: this.region,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      FILES_TABLE: tables.files.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
      IDENTITY_POOL_ID: props.identityPoolId,
    };
    
    // 1. Account Transaction Counts
    const accountTransactionCounts = new BebcoLambda(this, 'AccountTransactionCounts', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-account-transaction-counts',
      environment: {
        REGION: this.region,
        TRANSACTIONS_TABLE: tables.transactions.tableName,
      },
    });
    tables.transactions.grantReadData(accountTransactionCounts.function);
    addQueryScan(accountTransactionCounts.function, tables.transactions);
    this.functions.accountTransactionCounts = accountTransactionCounts.function;
    
    // 2. Accounts Upload Statement
    const accountsUploadStatement = new BebcoLambda(this, 'AccountsUploadStatement', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-upload-statement',
      environment: {
        ...commonEnv,
        MONTHLY_REPORTS_TABLE: tables.monthlyReportings.tableName,
      },
    });
    tables.accounts.grantReadWriteData(accountsUploadStatement.function);
    addQueryScan(accountsUploadStatement.function, tables.accounts);
    tables.files.grantReadWriteData(accountsUploadStatement.function);
    addQueryScan(accountsUploadStatement.function, tables.files);
    tables.monthlyReportings.grantReadData(accountsUploadStatement.function);
    addQueryScan(accountsUploadStatement.function, tables.monthlyReportings);
    buckets.documents.grantReadWrite(accountsUploadStatement.function);
    this.functions.accountsUploadStatement = accountsUploadStatement.function;
    
    // 3. Accounts Get
    const accountsGet = new BebcoLambda(this, 'AccountsGet', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-get',
      environment: commonEnv,
    });
    tables.accounts.grantReadData(accountsGet.function);
    addQueryScan(accountsGet.function, tables.accounts);
    tables.files.grantReadData(accountsGet.function);
    addQueryScan(accountsGet.function, tables.files);
    buckets.documents.grantRead(accountsGet.function);
    this.functions.accountsGet = accountsGet.function;
    
    // 4. Accounts OCR Results
    const accountsOcrResults = new BebcoLambda(this, 'AccountsOcrResults', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-ocr-results',
      environment: {
        REGION: this.region,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
      },
    });
    tables.files.grantReadWriteData(accountsOcrResults.function);
    addQueryScan(accountsOcrResults.function, tables.files);
    buckets.documents.grantReadWrite(accountsOcrResults.function);
    this.functions.accountsOcrResults = accountsOcrResults.function;
    
    // 5. Admin Account Statements Download
    const adminAccountStatementsDownload = new BebcoLambda(this, 'AdminAccountStatementsDownload', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-borrower-staging-admin-account-statements-download',
      environment: {
        REGION: this.region,
        DOCUMENTS_BUCKET: buckets.documents.bucketName,
      },
    });
    buckets.documents.grantRead(adminAccountStatementsDownload.function);
    this.functions.adminAccountStatementsDownload = adminAccountStatementsDownload.function;
    
    // 6. Accounts Process OCR
    const accountsProcessOcr = new BebcoLambda(this, 'AccountsProcessOcr', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-process-ocr',
      environment: {
        REGION: this.region,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
        TEXTRACT_ROLE_ARN: textractRole.roleArn,
        OCR_RESULTS_TOPIC_ARN: textractResultsTopic.topicArn,
      },
      topicsToPublish: [textractResultsTopic],
      additionalPolicies: [
        new iam.PolicyStatement({
          actions: [
            'textract:StartDocumentAnalysis',
            'textract:StartDocumentTextDetection',
            'textract:GetDocumentAnalysis',
            'textract:GetDocumentTextDetection',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [textractRole.roleArn],
        }),
      ],
    });
    tables.files.grantReadWriteData(accountsProcessOcr.function);
    addQueryScan(accountsProcessOcr.function, tables.files);
    buckets.documents.grantReadWrite(accountsProcessOcr.function);
    // Note: Will need Textract and SNS permissions added
    this.functions.accountsProcessOcr = accountsProcessOcr.function;
    
    // 7. Accounts Create
    const accountsCreate = new BebcoLambda(this, 'AccountsCreate', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-create',
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(accountsCreate.function, tables.accounts, tables.files);
    buckets.documents.grantReadWrite(accountsCreate.function);
    this.functions.accountsCreate = accountsCreate.function;
    
    // 8. Known Accounts (Admin)
    const knownAccounts = new BebcoLambda(this, 'KnownAccounts', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebcoborroweradmin-known-accounts-staging',
      environment: {
        REGION: this.region,
        TABLE_NAME: tables.accounts.tableName,
      },
    });
    grantReadDataWithQuery(knownAccounts.function, tables.accounts);
    this.functions.knownAccounts = knownAccounts.function;
    
    // 9. Accounts List
    const accountsList = new BebcoLambda(this, 'AccountsList', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-accounts-list',
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.loanLoc.tableName,
      },
    });
    grantReadDataWithQuery(accountsList.function, tables.accounts, tables.files, tables.loanLoc);
    buckets.documents.grantRead(accountsList.function);
    this.functions.accountsList = accountsList.function;
    
    // Stack outputs
    new cdk.CfnOutput(this, 'AccountsCreateArn', {
      value: this.functions.accountsCreate.functionArn,
      description: 'ARN of the Accounts Create function',
    });
    
    new cdk.CfnOutput(this, 'AccountsGetArn', {
      value: this.functions.accountsGet.functionArn,
      description: 'ARN of the Accounts Get function',
    });
  }
}

