import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { addQueryScan } from '../../utils/dynamodb-permissions';

export interface PlaidStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  queues?: { [key: string]: sqs.IQueue };
  eventBus?: events.IEventBus;
}

export class PlaidStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: PlaidStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    // Python deps layer is not needed for Plaid functions (they bundle deps)
    
    // Common environment variables for all Plaid functions
    const commonEnv = {
      REGION: this.region,
      PLAID_CLIENT_ID: props.config.integrations.plaidClientId,
      PLAID_ENVIRONMENT: props.config.integrations.plaidEnvironment,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      COMPANIES_TABLE: tables.companies.tableName,
      TRANSACTIONS_TABLE: tables.transactions.tableName,
      PLAID_ITEMS_TABLE: tables.plaidItems.tableName,
    };
    
    // 1. Plaid Link Token Create
    const linkTokenCreate = new BebcoLambda(this, 'PlaidLinkTokenCreate', {
      sourceFunctionName: 'bebco-staging-plaid-link-token-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.accounts.grantReadWriteData(linkTokenCreate.function);
    addQueryScan(linkTokenCreate.function, tables.accounts);
    tables.companies.grantReadData(linkTokenCreate.function);
    addQueryScan(linkTokenCreate.function, tables.companies);
    this.functions.linkTokenCreate = linkTokenCreate.function;
    
    // 2. Plaid Token Exchange
    const tokenExchange = new BebcoLambda(this, 'PlaidTokenExchange', {
      sourceFunctionName: 'bebco-staging-plaid-token-exchange',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.accounts.grantReadWriteData(tokenExchange.function);
    addQueryScan(tokenExchange.function, tables.accounts);
    tables.plaidItems.grantReadWriteData(tokenExchange.function);
    addQueryScan(tokenExchange.function, tables.plaidItems);
    this.functions.tokenExchange = tokenExchange.function;
    
    // 3. Plaid Accounts Preview
    const accountsPreview = new BebcoLambda(this, 'PlaidAccountsPreview', {
      sourceFunctionName: 'bebco-staging-plaid-accounts-preview',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.accounts.grantReadData(accountsPreview.function);
    addQueryScan(accountsPreview.function, tables.accounts);
    tables.plaidItems.grantReadData(accountsPreview.function);
    addQueryScan(accountsPreview.function, tables.plaidItems);
    this.functions.accountsPreview = accountsPreview.function;
    
    // 4. Create Account from Plaid
    const createAccountFromPlaid = new BebcoLambda(this, 'CreateAccountFromPlaid', {
      sourceFunctionName: 'bebco-staging-create-account-from-plaid',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.accounts.grantReadWriteData(createAccountFromPlaid.function);
    addQueryScan(createAccountFromPlaid.function, tables.accounts);
    tables.plaidItems.grantReadWriteData(createAccountFromPlaid.function);
    addQueryScan(createAccountFromPlaid.function, tables.plaidItems);
    tables.companies.grantReadData(createAccountFromPlaid.function);
    addQueryScan(createAccountFromPlaid.function, tables.companies);
    this.functions.createAccountFromPlaid = createAccountFromPlaid.function;
    
    // 5. Plaid Transactions Sync
    const transactionsSync = new BebcoLambda(this, 'PlaidTransactionsSync', {
      sourceFunctionName: 'bebco-staging-plaid-transactions-sync',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.transactions.grantReadWriteData(transactionsSync.function);
    addQueryScan(transactionsSync.function, tables.transactions);
    tables.accounts.grantReadData(transactionsSync.function);
    addQueryScan(transactionsSync.function, tables.accounts);
    tables.plaidItems.grantReadWriteData(transactionsSync.function);
    addQueryScan(transactionsSync.function, tables.plaidItems);
    this.functions.transactionsSync = transactionsSync.function;
    
    // 6. Plaid Sync Manual
    const syncManual = new BebcoLambda(this, 'PlaidSyncManual', {
      sourceFunctionName: 'bebco-staging-plaid-sync-manual',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.transactions.grantReadWriteData(syncManual.function);
    addQueryScan(syncManual.function, tables.transactions);
    tables.accounts.grantReadData(syncManual.function);
    addQueryScan(syncManual.function, tables.accounts);
    tables.plaidItems.grantReadWriteData(syncManual.function);
    addQueryScan(syncManual.function, tables.plaidItems);
    this.functions.syncManual = syncManual.function;
    
    // 7. Plaid Webhook Handler
    const webhookHandler = new BebcoLambda(this, 'PlaidWebhookHandler', {
      sourceFunctionName: 'bebco-staging-plaid-webhook-handler',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.accounts.grantReadWriteData(webhookHandler.function);
    addQueryScan(webhookHandler.function, tables.accounts);
    tables.plaidItems.grantReadWriteData(webhookHandler.function);
    addQueryScan(webhookHandler.function, tables.plaidItems);
    tables.transactions.grantReadWriteData(webhookHandler.function);
    addQueryScan(webhookHandler.function, tables.transactions);
    this.functions.webhookHandler = webhookHandler.function;
    
    // 8. Plaid Account Transactions
    const accountTransactions = new BebcoLambda(this, 'PlaidAccountTransactions', {
      sourceFunctionName: 'bebco-staging-plaid-account-transactions',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.transactions.grantReadData(accountTransactions.function);
    addQueryScan(accountTransactions.function, tables.transactions);
    tables.accounts.grantReadData(accountTransactions.function);
    addQueryScan(accountTransactions.function, tables.accounts);
    this.functions.accountTransactions = accountTransactions.function;
    
    // 9. Plaid Item Webhook Bulk Update
    const itemWebhookBulkUpdate = new BebcoLambda(this, 'PlaidItemWebhookBulkUpdate', {
      sourceFunctionName: 'bebco-staging-plaid-item-webhook-bulk-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.plaidItems.grantReadWriteData(itemWebhookBulkUpdate.function);
    addQueryScan(itemWebhookBulkUpdate.function, tables.plaidItems);
    this.functions.itemWebhookBulkUpdate = itemWebhookBulkUpdate.function;
    
    // 10. Plaid Daily Sync (missing function - scheduler)
    const plaidDailySync = new BebcoLambda(this, 'PlaidDailySync', {
      sourceFunctionName: 'bebcostaging-plaid-daily-sync',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.plaidItems.grantReadData(plaidDailySync.function);
    addQueryScan(plaidDailySync.function, tables.plaidItems);
    tables.accounts.grantReadData(plaidDailySync.function);
    addQueryScan(plaidDailySync.function, tables.accounts);
    this.functions.plaidDailySync = plaidDailySync.function;
    
    // 11. Generate Plaid Monthly Account Statement (missing function)
    const generatePlaidMonthlyStatement = new BebcoLambda(this, 'GeneratePlaidMonthlyStatement', {
      sourceFunctionName: 'bebcostaging-generate-plaid-monthly-account-statement',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        STATEMENTS_S3_BUCKET: buckets.documents.bucketName,
      },
    });
    tables.accounts.grantReadData(generatePlaidMonthlyStatement.function);
    addQueryScan(generatePlaidMonthlyStatement.function, tables.accounts);
    tables.transactions.grantReadData(generatePlaidMonthlyStatement.function);
    addQueryScan(generatePlaidMonthlyStatement.function, tables.transactions);
    tables.plaidItems.grantReadData(generatePlaidMonthlyStatement.function);
    addQueryScan(generatePlaidMonthlyStatement.function, tables.plaidItems);
    buckets.documents.grantReadWrite(generatePlaidMonthlyStatement.function);
    this.functions.generatePlaidMonthlyStatement = generatePlaidMonthlyStatement.function;
    
    // Outputs
    new cdk.CfnOutput(this, 'PlaidLinkTokenCreateArn', {
      value: linkTokenCreate.function.functionArn,
      description: 'Plaid Link Token Create Lambda ARN',
    });
    
    new cdk.CfnOutput(this, 'PlaidWebhookHandlerArn', {
      value: webhookHandler.function.functionArn,
      description: 'Plaid Webhook Handler Lambda ARN',
    });
  }
}

