import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import * as path from 'path';
import * as fs from 'fs';

export interface BorrowerApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}

export class BorrowerApiStack extends cdk.Stack {
  public readonly api: apigateway.SpecRestApi;
  
  constructor(scope: Construct, id: string, props: BorrowerApiStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool } = props;
    
    // Load and modify the OpenAPI spec
    const openApiSpecPath = path.join(__dirname, '../../../exports/api-configs/swagger/bebco-borrower-staging-api.json');
    const openApiSpec = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf-8'));
    
    // Update the spec for dev environment
    openApiSpec.info.title = 'bebco-borrower-dev-api';
    openApiSpec.info.version = '1.0-dev';
    
    // Add Cognito authorizer configuration to the spec
    if (!openApiSpec.components) {
      openApiSpec.components = {};
    }
    if (!openApiSpec.components.securitySchemes) {
      openApiSpec.components.securitySchemes = {};
    }
    
    // Add the Cognito authorizer
    openApiSpec.components.securitySchemes['bebcodev-cognito'] = {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      'x-amazon-apigateway-authtype': 'cognito_user_pools',
      'x-amazon-apigateway-authorizer': {
        type: 'cognito_user_pools',
        providerARNs: [userPool.userPoolArn],
      },
    };
    
    // Update Lambda integrations to point to us-east-2 functions
    // Replace all us-east-1 ARNs with us-east-2 ARNs and staging with dev
    const specString = JSON.stringify(openApiSpec);
    const updatedSpecString = specString
      .replace(/us-east-1/g, config.region)
      .replace(/staging/g, 'dev')
      .replace(/:303555290462:/g, `:${config.account}:`);
    const updatedSpec = JSON.parse(updatedSpecString);
    
    // Create REST API from OpenAPI spec
    this.api = new apigateway.SpecRestApi(this, 'BorrowerApi', {
      restApiName: resourceNames.apiGateway('borrower-api'),
      apiDefinition: apigateway.ApiDefinition.fromInline(updatedSpec),
      deployOptions: {
        stageName: 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      cloudWatchRole: true,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });
    
    // Add CORS configuration (will need to update origins for actual portals)
    const corsOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      // Add actual portal URLs here
    ];
    
    // Grant API Gateway permission to invoke Lambda functions
    // We need to grant invoke permissions for all Lambda functions used by this API
    const lambdaFunctions = this.extractLambdaFunctionsFromSpec(updatedSpec);
    lambdaFunctions.forEach(functionName => {
      try {
        const fn = lambda.Function.fromFunctionName(
          this,
          `Fn-${functionName}`,
          functionName
        );
        fn.grantInvoke(new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'));
      } catch (error) {
        console.warn(`Could not grant permission for function: ${functionName}`);
      }
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'Borrower Portal API endpoint',
      exportName: 'BorrowerApiEndpoint',
    });
    
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'Borrower Portal API ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this).add('API', 'borrower-portal');
  }
  
  private extractLambdaFunctionsFromSpec(spec: any): string[] {
    const functions = new Set<string>();
    
    // Parse the OpenAPI spec to find all Lambda integrations
    if (spec.paths) {
      Object.keys(spec.paths).forEach(path => {
        const pathItem = spec.paths[path];
        Object.keys(pathItem).forEach(method => {
          if (method === 'parameters') return;
          const methodItem = pathItem[method];
          
          // Check for x-amazon-apigateway-integration
          if (methodItem['x-amazon-apigateway-integration']) {
            const integration = methodItem['x-amazon-apigateway-integration'];
            if (integration.uri) {
              // Extract function name from ARN
              const match = integration.uri.match(/function:([^/]+)/);
              if (match) {
                functions.add(match[1]);
              }
            }
          }
        });
      });
    }
    
    return Array.from(functions);
  }
}

