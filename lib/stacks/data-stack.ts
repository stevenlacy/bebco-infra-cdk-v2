import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceNames } from '../config/resource-names';

export interface DataStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
}

export class DataStack extends cdk.Stack {
  public readonly tables: { [key: string]: dynamodb.Table } = {};
  
  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    
    const { resourceNames } = props;
    
    // Helper function to create table with common settings
    const createTable = (
      id: string,
      tableName: string,
      partitionKey: { name: string; type: dynamodb.AttributeType },
      sortKey?: { name: string; type: dynamodb.AttributeType }
    ): dynamodb.Table => {
      const tableProps: dynamodb.TableProps = {
        tableName,
        partitionKey,
        ...(sortKey && { sortKey }),
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecovery: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      };
      
      return new dynamodb.Table(this, id, tableProps);
    };
    
    // Accounts table
    this.tables.accounts = createTable(
      'AccountsTable',
      resourceNames.table('borrower', 'accounts'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.accounts.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.tables.accounts.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Companies table
    this.tables.companies = createTable(
      'CompaniesTable',
      resourceNames.table('borrower', 'companies'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Users table
    this.tables.users = createTable(
      'UsersTable',
      resourceNames.table('borrower', 'users'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.users.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.tables.users.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Loans table
    this.tables.loans = createTable(
      'LoansTable',
      resourceNames.table('borrower', 'loans'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.loans.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.tables.loans.addGlobalSecondaryIndex({
      indexName: 'LoanNumberIndex',
      partitionKey: { name: 'loan_no', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Transactions table
    this.tables.transactions = createTable(
      'TransactionsTable',
      resourceNames.table('borrower', 'transactions'),
      { name: 'account_id', type: dynamodb.AttributeType.STRING },
      { name: 'posted_date_tx_id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.transactions.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'posted_date_account_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.tables.transactions.addGlobalSecondaryIndex({
      indexName: 'LoanNumberIndex',
      partitionKey: { name: 'loan_no', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.tables.transactions.addGlobalSecondaryIndex({
      indexName: 'PlaidTxIndex',
      partitionKey: { name: 'plaid_transaction_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Payments table
    this.tables.payments = createTable(
      'PaymentsTable',
      resourceNames.table('borrower', 'payments'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.payments.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Statements table
    this.tables.statements = createTable(
      'StatementsTable',
      resourceNames.table('borrower', 'statements'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Cases table
    this.tables.cases = createTable(
      'CasesTable',
      resourceNames.table('borrower', 'cases'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Monthly Reportings table
    this.tables.monthlyReportings = createTable(
      'MonthlyReportingsTable',
      resourceNames.table('borrower', 'monthly-reportings'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Annual Reportings table
    this.tables.annualReportings = createTable(
      'AnnualReportingsTable',
      resourceNames.table('borrower', 'annual-reportings'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // OTP Codes table
    this.tables.otpCodes = createTable(
      'OtpCodesTable',
      resourceNames.table('borrower', 'otp-codes'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Plaid Items table
    this.tables.plaidItems = createTable(
      'PlaidItemsTable',
      resourceNames.table('borrower', 'plaid-items'),
      { name: 'item_id', type: dynamodb.AttributeType.STRING }
    );
    
    // Files table
    this.tables.files = createTable(
      'FilesTable',
      resourceNames.table('borrower', 'files'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Banks table
    this.tables.banks = createTable(
      'BanksTable',
      resourceNames.table('borrower', 'banks'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // ACH Batches table
    this.tables.achBatches = createTable(
      'AchBatchesTable',
      resourceNames.table('borrower', 'ach-batches'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Ledger Entries table
    this.tables.ledgerEntries = createTable(
      'LedgerEntriesTable',
      resourceNames.table('borrower', 'ledger-entries'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Approvals table
    this.tables.approvals = createTable(
      'ApprovalsTable',
      resourceNames.table('borrower', 'approvals'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Notifications table
    this.tables.notifications = createTable(
      'NotificationsTable',
      resourceNames.table('borrower', 'notifications'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    const docusignRequestsTableName = props.config.integrations.docusignRequestsTableName ?? 'docusign-requests';
    this.tables.docusignRequests = createTable(
      'DocusignRequestsTable',
      resourceNames.table('integrations', docusignRequestsTableName),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    
    // Expenses table
    this.tables.expenses = createTable(
      'ExpensesTable',
      resourceNames.table('borrower', 'expenses'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.expenses.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Invoices table
    this.tables.invoices = createTable(
      'InvoicesTable',
      resourceNames.table('borrower', 'invoices'),
      { name: 'id', type: dynamodb.AttributeType.STRING }
    );
    this.tables.invoices.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Additional tables (simplified without all GSIs for now)
    const additionalTables = [
      'loan-loc',
      'lines-of-credit',
      'case-counsel-relationships',
      'case-financials-current',
      'case-underwritings',
      'docket-review-case-details',
      'borrower-value-config-settings',
      'discount-rate-matrix',
      'mass-tort-general',
      'mass-tort-plaintiffs',
      'settlement-success-tracking',
      'valuations-summary',
      'variance-tracking',
    ];
    
    additionalTables.forEach(tableName => {
      const camelCaseName = tableName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const table = createTable(
        `${camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1)}Table`,
        resourceNames.table('borrower', tableName),
        { name: 'id', type: dynamodb.AttributeType.STRING }
      );
      
      // Add CompanyIndex GSI to loan-loc table for cases queries
      if (tableName === 'loan-loc') {
        table.addGlobalSecondaryIndex({
          indexName: 'CompanyIndex',
          partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
          projectionType: dynamodb.ProjectionType.ALL,
        });
      }
      
      this.tables[camelCaseName] = table;
    });

    // Backcompat: Provision legacy-named staging tables some packaged Lambdas still reference directly
    // Note: legacy staging tables may already exist outside this stack; do not attempt to create here

    // Create legacy-named statements table in this region for packaged code
    if (props.config.naming.environmentSuffix === 'dev') {
      new dynamodb.Table(this, 'LegacyStatementsStaging', {
        tableName: 'bebco-borrower-staging-statements',
        partitionKey: { name: 'company_id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecovery: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    } else {
      cdk.Annotations.of(this).addInfo(
        'Skipping legacy staging statements table creation; table is shared across environments.'
      );
    }
 
    // Outputs
    new cdk.CfnOutput(this, 'AccountsTableName', {
      value: this.tables.accounts.tableName,
      description: 'Accounts DynamoDB Table Name',
    });
    
    new cdk.CfnOutput(this, 'CompaniesTableName', {
      value: this.tables.companies.tableName,
      description: 'Companies DynamoDB Table Name',
    });
    
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.tables.users.tableName,
      description: 'Users DynamoDB Table Name',
    });
  }
}

