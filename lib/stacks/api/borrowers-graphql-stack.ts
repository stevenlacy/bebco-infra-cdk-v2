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
      'bebco-borrowers-api-listBorrowers'
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
      'bebco-borrowers-api-getFinancialOverview'
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
      'bebco-borrowers-api-batchGetFinancialOverviews'
    );
    const batchGetFinancialOverviewsDs = this.api.addLambdaDataSource(
      'BatchGetFinancialOverviewsDataSource',
      batchGetFinancialOverviewsFn,
      {
        name: 'BatchGetFinancialOverviewsDataSource',
        description: 'Lambda data source for batchGetFinancialOverviews query',
      }
    );
    
    // Create resolvers (these will be created based on the schema)
    // The actual field names will depend on the GraphQL schema
    // Uncomment and adjust once we verify the schema structure
    
    // listBorrowersDs.createResolver('ListBorrowersResolver', {
    //   typeName: 'Query',
    //   fieldName: 'listBorrowers',
    // });
    
    // getFinancialOverviewDs.createResolver('GetFinancialOverviewResolver', {
    //   typeName: 'Query',
    //   fieldName: 'getFinancialOverview',
    // });
    
    // batchGetFinancialOverviewsDs.createResolver('BatchGetFinancialOverviewsResolver', {
    //   typeName: 'Query',
    //   fieldName: 'batchGetFinancialOverviews',
    // });
    
    // Outputs
    new cdk.CfnOutput(this, 'GraphQLApiEndpoint', {
      value: this.api.graphqlUrl,
      description: 'Borrowers GraphQL API endpoint',
      exportName: 'BorrowersGraphQLApiEndpoint',
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

