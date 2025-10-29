import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import * as path from 'path';

export interface BorrowersGraphQLStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
}

export class BorrowersGraphQLStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  
  constructor(scope: Construct, id: string, props: BorrowersGraphQLStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames } = props;
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

