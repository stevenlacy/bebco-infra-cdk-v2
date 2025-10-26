import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface AccountsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

export class AccountsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets, config } = props;
    
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
      sourceFunctionName: 'bebco-staging-account-transaction-counts',
      resourceNames,
      environment: {
        REGION: this.region,
        TRANSACTIONS_TABLE: tables.transactions.tableName,
      },
    });
    tables.transactions.grantReadData(accountTransactionCounts.function);
    this.functions.accountTransactionCounts = accountTransactionCounts.function;
    
    // 2. Accounts Upload Statement
    const accountsUploadStatement = new BebcoLambda(this, 'AccountsUploadStatement', {
      sourceFunctionName: 'bebco-staging-accounts-upload-statement',
      resourceNames,
      environment: {
        ...commonEnv,
        MONTHLY_REPORTS_TABLE: tables.monthlyReportings.tableName,
      },
    });
    tables.accounts.grantReadWriteData(accountsUploadStatement.function);
    tables.files.grantReadWriteData(accountsUploadStatement.function);
    tables.monthlyReportings.grantReadData(accountsUploadStatement.function);
    buckets.documents.grantReadWrite(accountsUploadStatement.function);
    this.functions.accountsUploadStatement = accountsUploadStatement.function;
    
    // 3. Accounts Get
    const accountsGet = new BebcoLambda(this, 'AccountsGet', {
      sourceFunctionName: 'bebco-staging-accounts-get',
      resourceNames,
      environment: commonEnv,
    });
    tables.accounts.grantReadData(accountsGet.function);
    tables.files.grantReadData(accountsGet.function);
    buckets.documents.grantRead(accountsGet.function);
    this.functions.accountsGet = accountsGet.function;
    
    // 4. Accounts OCR Results
    const accountsOcrResults = new BebcoLambda(this, 'AccountsOcrResults', {
      sourceFunctionName: 'bebco-staging-accounts-ocr-results',
      resourceNames,
      environment: {
        REGION: this.region,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
      },
    });
    tables.files.grantReadWriteData(accountsOcrResults.function);
    buckets.documents.grantReadWrite(accountsOcrResults.function);
    this.functions.accountsOcrResults = accountsOcrResults.function;
    
    // 5. Admin Account Statements Download
    const adminAccountStatementsDownload = new BebcoLambda(this, 'AdminAccountStatementsDownload', {
      sourceFunctionName: 'bebco-borrower-staging-admin-account-statements-download',
      resourceNames,
      environment: {
        REGION: this.region,
        DOCUMENTS_BUCKET: buckets.documents.bucketName,
      },
    });
    buckets.documents.grantRead(adminAccountStatementsDownload.function);
    this.functions.adminAccountStatementsDownload = adminAccountStatementsDownload.function;
    
    // 6. Accounts Process OCR
    const accountsProcessOcr = new BebcoLambda(this, 'AccountsProcessOcr', {
      sourceFunctionName: 'bebco-staging-accounts-process-ocr',
      resourceNames,
      environment: {
        REGION: this.region,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
        // Note: Textract role ARN and SNS topic will need to be created in us-east-2
        TEXTRACT_ROLE_ARN: `arn:aws:iam::${this.account}:role/bebco-dev-textract-sns-role`,
        OCR_RESULTS_TOPIC_ARN: `arn:aws:sns:${this.region}:${this.account}:bebco-dev-textract-results`,
      },
    });
    tables.files.grantReadWriteData(accountsProcessOcr.function);
    buckets.documents.grantReadWrite(accountsProcessOcr.function);
    // Note: Will need Textract and SNS permissions added
    this.functions.accountsProcessOcr = accountsProcessOcr.function;
    
    // 7. Accounts Create
    const accountsCreate = new BebcoLambda(this, 'AccountsCreate', {
      sourceFunctionName: 'bebco-staging-accounts-create',
      resourceNames,
      environment: commonEnv,
    });
    tables.accounts.grantReadWriteData(accountsCreate.function);
    tables.files.grantReadWriteData(accountsCreate.function);
    buckets.documents.grantReadWrite(accountsCreate.function);
    this.functions.accountsCreate = accountsCreate.function;
    
    // 8. Known Accounts (Admin)
    const knownAccounts = new BebcoLambda(this, 'KnownAccounts', {
      sourceFunctionName: 'bebcoborroweradmin-known-accounts-staging',
      resourceNames,
      environment: {
        REGION: this.region,
        TABLE_NAME: tables.accounts.tableName,
      },
    });
    tables.accounts.grantReadData(knownAccounts.function);
    this.functions.knownAccounts = knownAccounts.function;
    
    // 9. Accounts List
    const accountsList = new BebcoLambda(this, 'AccountsList', {
      sourceFunctionName: 'bebco-staging-accounts-list',
      resourceNames,
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.loanLoc.tableName,
      },
    });
    tables.accounts.grantReadData(accountsList.function);
    tables.files.grantReadData(accountsList.function);
    tables.loanLoc.grantReadData(accountsList.function);
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

