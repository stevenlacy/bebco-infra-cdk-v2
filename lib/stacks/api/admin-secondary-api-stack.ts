import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import * as path from 'path';
import * as fs from 'fs';

export interface AdminSecondaryApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}

export class AdminSecondaryApiStack extends cdk.Stack {
  public readonly api: apigateway.SpecRestApi;
  
  constructor(scope: Construct, id: string, props: AdminSecondaryApiStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool } = props;
    
    // Load and modify the OpenAPI spec
    const openApiSpecPath = path.join(__dirname, '../../../exports/api-configs/swagger/bebco-admin-api.json');
    const openApiSpec = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf-8'));
    
    // Update the spec for dev environment
    openApiSpec.info.title = 'bebco-admin-secondary-dev-api';
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
    const specString = JSON.stringify(openApiSpec);
    let updatedSpecString = specString
      .replace(/us-east-1/g, config.region)
      .replace(/staging/g, 'dev')
      .replace(/:303555290462:/g, `:${config.account}:`);
    if (config.naming.environmentSuffix && config.naming.environmentSuffix !== 'dev') {
      const suffix = config.naming.environmentSuffix;
      updatedSpecString = updatedSpecString.replace(/function:(bebco[^/"']+)/g, (_match, fnName: string) => {
        const updatedName = fnName.endsWith(`-${suffix}`) ? fnName : `${fnName}-${suffix}`;
        return `function:${updatedName}`;
      });
    }
    const updatedSpec = JSON.parse(updatedSpecString);
    
    // Create REST API from OpenAPI spec
    this.api = new apigateway.SpecRestApi(this, 'AdminSecondaryApi', {
      restApiName: resourceNames.apiGateway('admin-secondary-api'),
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
    
    // Grant API Gateway permission to invoke Lambda functions
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
      description: 'Admin Portal Secondary API endpoint',
    });
    
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'Admin Portal Secondary API ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this).add('API', 'admin-portal-secondary');
  }
  
  private extractLambdaFunctionsFromSpec(spec: any): string[] {
    const functions = new Set<string>();
    
    if (spec.paths) {
      Object.keys(spec.paths).forEach(path => {
        const pathItem = spec.paths[path];
        Object.keys(pathItem).forEach(method => {
          if (method === 'parameters') return;
          const methodItem = pathItem[method];
          
          if (methodItem['x-amazon-apigateway-integration']) {
            const integration = methodItem['x-amazon-apigateway-integration'];
            if (integration.uri) {
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

