#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EnvironmentConfigLoader } from '../lib/config/environment-config';
import { ResourceNames } from '../lib/config/resource-names';

// Foundation stacks
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { DataStack } from '../lib/stacks/data-stack';

// Domain stacks
import { PlaidStack } from '../lib/stacks/domains/plaid-stack';
import { AccountsStack } from '../lib/stacks/domains/accounts-stack';
import { UsersStack } from '../lib/stacks/domains/users-stack';
import { DrawsStack } from '../lib/stacks/domains/draws-stack';
import { ReportingStack } from '../lib/stacks/domains/reporting-stack';
import { LoansStack } from '../lib/stacks/domains/loans-stack';
import { PaymentsStack } from '../lib/stacks/domains/payments-stack';
import { CasesStack } from '../lib/stacks/domains/cases-stack';
import { AuthLambdasStack } from '../lib/stacks/domains/auth-lambdas-stack';
import { DocuSignStack } from '../lib/stacks/domains/docusign-stack';
import { BorrowersStack } from '../lib/stacks/domains/borrowers-stack';
import { ExpensesStack } from '../lib/stacks/domains/expenses-stack';
import { InvoicesStack } from '../lib/stacks/domains/invoices-stack';
import { BanksStack } from '../lib/stacks/domains/banks-stack';
import { StatementsStack } from '../lib/stacks/domains/statements-stack';
import { IntegrationsStack } from '../lib/stacks/domains/integrations-stack';
import { MiscStack } from '../lib/stacks/domains/misc-stack';
import { SharedServicesStack } from '../lib/stacks/shared-services-stack';

// API stacks
import { BorrowerApiStack } from '../lib/stacks/api/borrower-api-stack-generated';
import { AdminApiStack } from '../lib/stacks/api/admin-api-stack-generated';
import { AdminSecondaryApiStack } from '../lib/stacks/api/admin-secondary-api-stack-generated';
import { BorrowersGraphQLStack } from '../lib/stacks/api/borrowers-graphql-stack';
import { BorrowerStatementsGraphQLStack } from '../lib/stacks/api/borrower-statements-graphql-stack';

// Infrastructure stacks
import { QueuesStack } from '../lib/stacks/queues-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

const app = new cdk.App();

// Load environment configuration from context
const config = EnvironmentConfigLoader.loadFromContext(app);
const resourceNames = new ResourceNames(
  config.naming.prefix,
  config.naming.environmentSuffix,
  config.region,
  config.account
);

const env = {
  account: config.account,
  region: config.region,
};

console.log('');
console.log('='.repeat(60));
console.log(`Deploying Bebco Infrastructure`);
console.log(`Environment: ${config.environment}`);
console.log(`Region: ${config.region}`);
console.log(`Account: ${config.account}`);
console.log('='.repeat(60));
console.log('');

// Helper function to create environment-specific stack IDs
const getStackId = (baseName: string) => `Bebco${baseName}Stack-${config.naming.environmentSuffix}`;

// Foundation stacks (no Lambda dependencies)
const authStack = new AuthStack(app, getStackId('Auth'), {
  env,
  config,
  resourceNames,
  description: 'Cognito User Pool and Identity Pool for Bebco',
});

const storageStack = new StorageStack(app, getStackId('Storage'), {
  env,
  config,
  resourceNames,
  description: 'S3 buckets for documents, statements, and deployments',
});

const sharedServicesStack = new SharedServicesStack(app, getStackId('SharedServices'), {
  env,
  config,
  resourceNames,
  buckets: storageStack.buckets,
  description: 'Shared services (Textract role, SNS topics, cross-cutting IAM resources)',
});
sharedServicesStack.addDependency(storageStack);

const dataStack = new DataStack(app, getStackId('Data'), {
  env,
  config,
  resourceNames,
  description: 'DynamoDB tables for all bebco data',
});

// Domain Lambda stacks
const plaidStack = new PlaidStack(app, getStackId('Plaid'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '9 Plaid integration Lambda functions',
});
plaidStack.addDependency(dataStack);
plaidStack.addDependency(storageStack);

const accountsStack = new AccountsStack(app, getStackId('Accounts'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  identityPoolId: authStack.identityPool.ref,
  textractRole: sharedServicesStack.textractRole,
  textractResultsTopic: sharedServicesStack.textractResultsTopic,
  description: '9 Account management Lambda functions',
});
accountsStack.addDependency(dataStack);
accountsStack.addDependency(storageStack);
accountsStack.addDependency(authStack);
accountsStack.addDependency(sharedServicesStack);

const usersStack = new UsersStack(app, getStackId('Users'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  identityPoolId: authStack.identityPool.ref,
  description: '21 User management and authentication Lambda functions',
});
usersStack.addDependency(dataStack);
usersStack.addDependency(storageStack);
usersStack.addDependency(authStack);

const drawsStack = new DrawsStack(app, getStackId('Draws'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  identityPoolId: authStack.identityPool.ref,
  description: '7 Draw request management Lambda functions',
});
drawsStack.addDependency(dataStack);
drawsStack.addDependency(storageStack);
drawsStack.addDependency(authStack);

const reportingStack = new ReportingStack(app, getStackId('Reporting'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '15 Reporting Lambda functions (monthly, annual, AppSync)',
});
reportingStack.addDependency(dataStack);
reportingStack.addDependency(storageStack);

const loansStack = new LoansStack(app, getStackId('Loans'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '3 Loan management Lambda functions',
});
loansStack.addDependency(dataStack);
loansStack.addDependency(storageStack);

const paymentsStack = new PaymentsStack(app, getStackId('Payments'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '7 Payment and ACH Lambda functions',
});
paymentsStack.addDependency(dataStack);
paymentsStack.addDependency(storageStack);

const casesStack = new CasesStack(app, getStackId('Cases'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '6 Case management Lambda functions',
});
casesStack.addDependency(dataStack);
casesStack.addDependency(storageStack);

const authLambdasStack = new AuthLambdasStack(app, getStackId('AuthLambdas'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  identityPoolId: authStack.identityPool.ref,
  description: '6 Auth helper Lambda functions (borrower + admin)',
});
authLambdasStack.addDependency(dataStack);
authLambdasStack.addDependency(authStack);

const docusignStack = new DocuSignStack(app, getStackId('DocuSign'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '6 DocuSign integration Lambda functions',
});
docusignStack.addDependency(dataStack);
docusignStack.addDependency(storageStack);

const borrowersStack = new BorrowersStack(app, getStackId('Borrowers'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '10 Borrower management Lambda functions',
});
borrowersStack.addDependency(dataStack);
borrowersStack.addDependency(storageStack);

const expensesStack = new ExpensesStack(app, getStackId('Expenses'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  description: '4 Expense management Lambda functions',
});
expensesStack.addDependency(dataStack);

const invoicesStack = new InvoicesStack(app, getStackId('Invoices'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '5 Invoice management Lambda functions',
});
invoicesStack.addDependency(dataStack);
invoicesStack.addDependency(storageStack);

const banksStack = new BanksStack(app, getStackId('Banks'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  description: '3 Bank management Lambda functions',
});
banksStack.addDependency(dataStack);

const statementsStack = new StatementsStack(app, getStackId('Statements'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '5 Statement management Lambda functions',
});
statementsStack.addDependency(dataStack);
statementsStack.addDependency(storageStack);

const integrationsStack = new IntegrationsStack(app, getStackId('Integrations'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  textractRole: sharedServicesStack.textractRole,
  textractResultsTopic: sharedServicesStack.textractResultsTopic,
  description: '8 Integration Lambda functions (SharePoint, OCR, Excel, Agents)',
});
integrationsStack.addDependency(dataStack);
integrationsStack.addDependency(storageStack);
integrationsStack.addDependency(sharedServicesStack);

const miscStack = new MiscStack(app, getStackId('Misc'), {
  env,
  config,
  resourceNames,
  tables: dataStack.tables,
  buckets: storageStack.buckets,
  description: '3 Utility Lambda functions (change-tracker, backup, NACHA)',
});
miscStack.addDependency(dataStack);
miscStack.addDependency(storageStack);

// API Layer Stacks
const borrowerApiStack = new BorrowerApiStack(app, getStackId('BorrowerApi'), {
  env,
  config,
  resourceNames,
  userPool: authStack.userPool,
  description: 'Borrower Portal REST API (49 endpoints)',
});
borrowerApiStack.addDependency(authStack);
borrowerApiStack.addDependency(plaidStack);
borrowerApiStack.addDependency(accountsStack);
borrowerApiStack.addDependency(usersStack);

const adminApiStack = new AdminApiStack(app, getStackId('AdminApi'), {
  env,
  config,
  resourceNames,
  userPool: authStack.userPool,
  description: 'Admin Portal REST API (79 endpoints)',
});
adminApiStack.addDependency(authStack);
adminApiStack.addDependency(borrowersStack);
adminApiStack.addDependency(usersStack);

const adminSecondaryApiStack = new AdminSecondaryApiStack(app, getStackId('AdminSecondaryApi'), {
  env,
  config,
  resourceNames,
  userPool: authStack.userPool,
  description: 'Admin Portal Secondary REST API (9 endpoints)',
});
adminSecondaryApiStack.addDependency(authStack);
adminSecondaryApiStack.addDependency(banksStack);

const borrowersGraphQLStack = new BorrowersGraphQLStack(app, getStackId('BorrowersGraphQL'), {
  env,
  config,
  resourceNames,
  description: 'Borrowers GraphQL API',
});
borrowersGraphQLStack.addDependency(borrowersStack);

const borrowerStatementsGraphQLStack = new BorrowerStatementsGraphQLStack(app, getStackId('BorrowerStatementsGraphQL'), {
  env,
  config,
  resourceNames,
  userPool: authStack.userPool,
  statementsTable: dataStack.tables.statements,
  description: 'Borrower Statements GraphQL API',
});
borrowerStatementsGraphQLStack.addDependency(authStack);
borrowerStatementsGraphQLStack.addDependency(dataStack);

// Collect all Lambda functions for Queues Stack
const allLambdaFunctions: { [key: string]: lambda.IFunction } = {
  ...plaidStack.functions,
  ...accountsStack.functions,
  ...usersStack.functions,
  ...drawsStack.functions,
  ...reportingStack.functions,
  ...loansStack.functions,
  ...paymentsStack.functions,
  ...casesStack.functions,
  ...authLambdasStack.functions,
  ...docusignStack.functions,
  ...borrowersStack.functions,
  ...expensesStack.functions,
  ...invoicesStack.functions,
  ...banksStack.functions,
  ...statementsStack.functions,
  ...integrationsStack.functions,
  ...miscStack.functions,
};

// Queues & Events Stack (SQS, SNS, EventBridge)
const queuesStack = new QueuesStack(app, getStackId('Queues'), {
  env,
  config,
  resourceNames,
  lambdaFunctions: allLambdaFunctions,
  textractResultsTopic: sharedServicesStack.textractResultsTopic,
  description: 'SQS Queues, SNS Topics, and EventBridge Rules',
});
queuesStack.addDependency(plaidStack);
queuesStack.addDependency(paymentsStack);
queuesStack.addDependency(integrationsStack);
queuesStack.addDependency(statementsStack);
queuesStack.addDependency(reportingStack);
queuesStack.addDependency(miscStack);
queuesStack.addDependency(sharedServicesStack);

// Monitoring Stack (CloudWatch Alarms, Dashboards, Log Groups)
const monitoringStack = new MonitoringStack(app, getStackId('Monitoring'), {
  env,
  config,
  resourceNames,
  lambdaFunctions: allLambdaFunctions,
  description: 'CloudWatch Alarms, Dashboards, and Log Group configurations',
});
monitoringStack.addDependency(plaidStack);
monitoringStack.addDependency(paymentsStack);
monitoringStack.addDependency(usersStack);
monitoringStack.addDependency(miscStack);

app.synth();
