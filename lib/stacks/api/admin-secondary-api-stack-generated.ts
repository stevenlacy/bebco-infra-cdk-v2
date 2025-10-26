import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';

export interface AdminSecondaryApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}

export class AdminSecondaryApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props: AdminSecondaryApiStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool } = props;
    
    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: resourceNames.apiGateway('adminsecondaryapi'),
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      cloudWatchRole: true,
    });
    
    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    
    // Lambda functions

    const fn0 = lambda.Function.fromFunctionName(this, 'Fn0', 'bebco-dev-accounts-list');
    const fn1 = lambda.Function.fromFunctionName(this, 'Fn1', 'bebco-dev-banks-create');
    const fn2 = lambda.Function.fromFunctionName(this, 'Fn2', 'bebco-dev-banks-list');
    const fn3 = lambda.Function.fromFunctionName(this, 'Fn3', 'bebco-dev-banks-update');
    const fn4 = lambda.Function.fromFunctionName(this, 'Fn4', 'bebco-dev-draws-list');
    const fn5 = lambda.Function.fromFunctionName(this, 'Fn5', 'bebco-dev-monthly-reports-list');

    // API Resources

    const admin = this.api.root.addResource('admin');
    const banks = this.api.root.addResource('banks');
    const admin_accounts = admin.addResource('accounts');
    const admin_banks = admin.addResource('banks');
    const admin_monthly_reports = admin.addResource('monthly-reports');
    const banks_bankId = banks.addResource('{bankId}');
    const admin_banks_id = admin_banks.addResource('{id}');
    const banks_bankId_draws = banks_bankId.addResource('draws');

    // API Methods

    admin_accounts.addMethod('GET', new apigateway.LambdaIntegration(fn0), { authorizer });
    admin_banks.addMethod('GET', new apigateway.LambdaIntegration(fn2), { authorizer });
    admin_banks.addMethod('POST', new apigateway.LambdaIntegration(fn1), { authorizer });
    admin_monthly_reports.addMethod('GET', new apigateway.LambdaIntegration(fn5), { authorizer });
    admin_banks_id.addMethod('PUT', new apigateway.LambdaIntegration(fn3), { authorizer });
    banks_bankId_draws.addMethod('GET', new apigateway.LambdaIntegration(fn4), { authorizer });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API endpoint URL',
    });
    
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
  }
}
