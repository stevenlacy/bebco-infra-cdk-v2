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
    const corsAllowedOrigins = Array.from(
      new Set(
        [
          'http://localhost:3000',
          'http://localhost:3001',
          config?.domains?.api ? `https://${config.domains.api}` : undefined,
        ].filter(Boolean) as string[],
      ),
    );
    const withEnvSuffix = (name: string) => {
      const suffix = config.naming.environmentSuffix;
      if (!suffix || suffix === 'dev') {
        return name;
      }
      return name.endsWith(`-${suffix}`) ? name : `${name}-${suffix}`;
    };
    
    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: resourceNames.apiGateway('adminsecondaryapi'),
      defaultCorsPreflightOptions: {
        allowOrigins: corsAllowedOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowCredentials: false,
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

    // Add CORS headers to error responses (4xx, 5xx)
    const corsHeaders = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Origin,Accept'",
      'Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
    };
    
    this.api.addGatewayResponse('Default4xxGatewayResponse', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    
    this.api.addGatewayResponse('Default5xxGatewayResponse', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsHeaders,
    });
    
    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    
    // Lambda functions

    const lambdaNames = [
      'bebco-dev-accounts-list',
      'bebco-dev-banks-create',
      'bebco-dev-banks-list',
      'bebco-dev-banks-update',
      'bebco-dev-draws-list',
      'bebco-dev-monthly-reports-list',
    ];

    const [fn0, fn1, fn2, fn3, fn4, fn5] = lambdaNames.map((name, index) =>
      lambda.Function.fromFunctionName(this, `Fn${index}`, withEnvSuffix(name))
    );

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
