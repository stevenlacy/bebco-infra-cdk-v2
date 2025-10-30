import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import * as path from 'path';

export interface BorrowersGraphQLStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  monthlyReportsTable: dynamodb.ITable;
  companiesTable: dynamodb.ITable;
}

export class BorrowersGraphQLStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: BorrowersGraphQLStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, monthlyReportsTable, companiesTable } = props;
    const withEnvSuffix = (name: string) => {
      const suffix = config.naming.environmentSuffix;
      if (!suffix || suffix === 'dev') {
        return name;
      }
      return name.endsWith(`-${suffix}`) ? name : `${name}-${suffix}`;
    };
    
    // Create AppSync GraphQL API
    this.api = new appsync.GraphqlApi(this, 'BorrowersApi', {
      name: resourceNames.appSyncApi('borrowers-api'),
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, '../../../exports/api-configs/graphql/bebco-borrowers-api.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        excludeVerboseContent: false,
      },
    });
    
    // Lambda data source for listBorrowers
    const listBorrowersFn = lambda.Function.fromFunctionName(
      this,
      'ListBorrowersFn',
      withEnvSuffix('bebco-borrowers-api-listBorrowers')
    );
    const listBorrowersDs = this.api.addLambdaDataSource(
      'ListBorrowersDataSource',
      listBorrowersFn,
      {
        name: 'ListBorrowersDataSource',
        description: 'Lambda data source for listBorrowers query',
      }
    );
    
    // Lambda data source for getFinancialOverview
    const getFinancialOverviewFn = lambda.Function.fromFunctionName(
      this,
      'GetFinancialOverviewFn',
      withEnvSuffix('bebco-borrowers-api-getFinancialOverview')
    );
    const getFinancialOverviewDs = this.api.addLambdaDataSource(
      'GetFinancialOverviewDataSource',
      getFinancialOverviewFn,
      {
        name: 'GetFinancialOverviewDataSource',
        description: 'Lambda data source for getFinancialOverview query',
      }
    );
    
    // Lambda data source for batchGetFinancialOverviews
    const batchGetFinancialOverviewsFn = lambda.Function.fromFunctionName(
      this,
      'BatchGetFinancialOverviewsFn',
      withEnvSuffix('bebco-borrowers-api-batchGetFinancialOverviews')
    );
    const batchGetFinancialOverviewsDs = this.api.addLambdaDataSource(
      'BatchGetFinancialOverviewsDataSource',
      batchGetFinancialOverviewsFn,
      {
        name: 'BatchGetFinancialOverviewsDataSource',
        description: 'Lambda data source for batchGetFinancialOverviews query',
      }
    );
    
    // Lambda data source for listAnnualReports (admin dashboard)
    const listAnnualReportsFn = lambda.Function.fromFunctionName(
      this,
      'ListAnnualReportsFn',
      withEnvSuffix('bebco-appsync-list-annual-reports')
    );
    const listAnnualReportsDs = this.api.addLambdaDataSource(
      'ListAnnualReportsDataSource',
      listAnnualReportsFn,
      {
        name: 'ListAnnualReportsDataSource',
        description: 'Lambda data source for listAnnualReports query',
      }
    );

    // Lambda data source for annual reporting dashboard summary
    const annualReportingDashboardFn = lambda.Function.fromFunctionName(
      this,
      'AnnualReportingDashboardFn',
      withEnvSuffix('bebco-appsync-annual-reporting-dashboard')
    );
    const annualReportingDashboardDs = this.api.addLambdaDataSource(
      'AnnualReportingDashboardDataSource',
      annualReportingDashboardFn,
      {
        name: 'AnnualReportingDashboardDataSource',
        description: 'Lambda data source for getAnnualReportingDashboard query',
      }
    );
    
    const monthlyReportsByStatusFn = new lambda.Function(this, 'MonthlyReportsByStatusFn', {
      functionName: resourceNames.lambda('borrowers-api', 'monthly-reports-by-status'),
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../lambdas/appsync/monthly-reports-by-status')
      ),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      description: 'GraphQL resolver for monthlyReportsByStatus with company enrichment',
      environment: {
        MONTHLY_REPORTS_TABLE: monthlyReportsTable.tableName,
        MONTHLY_REPORTS_STATUS_INDEX: 'StatusIndex',
        MONTHLY_REPORTS_DEFAULT_LIMIT: '1000',
        MONTHLY_REPORTS_MAX_LIMIT: '5000',
        COMPANIES_TABLE: companiesTable.tableName,
      },
    });
    this.functions.monthlyReportsByStatus = monthlyReportsByStatusFn;
    monthlyReportsTable.grantReadData(monthlyReportsByStatusFn);
    companiesTable.grantReadData(monthlyReportsByStatusFn);
    monthlyReportsByStatusFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [
        monthlyReportsTable.tableArn,
        `${monthlyReportsTable.tableArn}/index/StatusIndex`,
      ],
    }));

    const monthlyReportsStatusIndexHandler = new lambda.Function(this, 'MonthlyReportsStatusIndexHandler', {
      functionName: resourceNames.lambda('infra', 'monthly-reports-status-index'),
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../lambdas/custom-resources/ensure-monthly-reports-status-index')
      ),
      timeout: cdk.Duration.minutes(15),
      memorySize: 256,
      description: 'Ensures the StatusIndex GSI exists on the monthly-reportings table',
      environment: {
        TABLE_NAME: monthlyReportsTable.tableName,
        INDEX_NAME: 'StatusIndex',
        HASH_KEY: 'status',
        RANGE_KEY: 'month',
      },
    });
    monthlyReportsStatusIndexHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:DescribeTable', 'dynamodb:UpdateTable'],
      resources: [monthlyReportsTable.tableArn],
    }));

    const monthlyReportsStatusIndexProvider = new cr.Provider(this, 'MonthlyReportsStatusIndexProvider', {
      onEventHandler: monthlyReportsStatusIndexHandler,
    });

    const ensureMonthlyReportsStatusIndex = new cdk.CustomResource(this, 'EnsureMonthlyReportsStatusIndex', {
      serviceToken: monthlyReportsStatusIndexProvider.serviceToken,
      properties: {
        TableName: monthlyReportsTable.tableName,
        IndexName: 'StatusIndex',
      },
    });

    monthlyReportsByStatusFn.node.addDependency(ensureMonthlyReportsStatusIndex);

    const monthlyReportsByStatusDs = this.api.addLambdaDataSource(
      'MonthlyReportsByStatusDataSource',
      monthlyReportsByStatusFn,
      {
        name: 'MonthlyReportsByStatusDataSource',
        description: 'Lambda data source for monthlyReportsByStatus query',
      }
    );

    // Create resolvers
    listBorrowersDs.createResolver('ListBorrowersResolver', {
      typeName: 'Query',
      fieldName: 'listBorrowers',
    });
    
    getFinancialOverviewDs.createResolver('GetFinancialOverviewResolver', {
      typeName: 'Query',
      fieldName: 'getFinancialOverview',
    });
    
    batchGetFinancialOverviewsDs.createResolver('BatchGetFinancialOverviewsResolver', {
      typeName: 'Query',
      fieldName: 'batchGetFinancialOverviews',
    });

    listAnnualReportsDs.createResolver('ListAnnualReportsResolver', {
      typeName: 'Query',
      fieldName: 'listAnnualReports',
    });

    annualReportingDashboardDs.createResolver('GetAnnualReportingDashboardResolver', {
      typeName: 'Query',
      fieldName: 'getAnnualReportingDashboard',
    });
    
    monthlyReportsByStatusDs.createResolver('MonthlyReportsByStatusResolver', {
      typeName: 'Query',
      fieldName: 'monthlyReportsByStatus',
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'GraphQLApiEndpoint', {
      value: this.api.graphqlUrl,
      description: 'Borrowers GraphQL API endpoint',
    });
    
    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: this.api.apiKey || 'N/A',
      description: 'Borrowers GraphQL API Key',
    });
    
    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      description: 'Borrowers GraphQL API ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this).add('API', 'borrowers-graphql');
  }
}

