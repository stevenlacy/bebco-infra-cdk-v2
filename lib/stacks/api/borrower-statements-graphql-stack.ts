import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import * as path from 'path';

export interface BorrowerStatementsGraphQLStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
  statementsTable: dynamodb.ITable;
}

export class BorrowerStatementsGraphQLStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  
  constructor(scope: Construct, id: string, props: BorrowerStatementsGraphQLStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool, statementsTable } = props;
    
    // Create AppSync GraphQL API
    this.api = new appsync.GraphqlApi(this, 'BorrowerStatementsApi', {
      name: resourceNames.appSyncApi('borrower-statements-api'),
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, '../../../exports/api-configs/graphql/beco-borrower-statements.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.days(365)),
            },
          },
        ],
      },
      xrayEnabled: false,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        excludeVerboseContent: false,
      },
    });
    
    // DynamoDB data source for statements table
    const statementsDataSource = this.api.addDynamoDbDataSource(
      'StatementsTableDataSource',
      statementsTable,
      {
        name: 'StatementsTable',
        description: 'DynamoDB data source for statements table',
      }
    );
    
    // Create resolver for listStatements query
    statementsDataSource.createResolver('ListStatementsResolver', {
      typeName: 'Query',
      fieldName: 'listStatements',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
        appsync.KeyCondition.eq('company_id', 'companyId'),
        'company_id-created_at-index'
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'GraphQLApiEndpoint', {
      value: this.api.graphqlUrl,
      description: 'Borrower Statements GraphQL API endpoint',
      exportName: 'BorrowerStatementsGraphQLApiEndpoint',
    });
    
    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: this.api.apiKey || 'N/A',
      description: 'Borrower Statements GraphQL API Key',
    });
    
    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      description: 'Borrower Statements GraphQL API ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this).add('API', 'borrower-statements-graphql');
  }
}

