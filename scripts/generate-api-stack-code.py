#!/usr/bin/env python3
"""
Generate CDK TypeScript code for API Gateway stacks with Lambda integrations
"""

import json
import sys
from collections import defaultdict

def transform_lambda_name(name):
    """Transform staging Lambda names to dev names"""
    if 'staging' in name:
        return name.replace('staging', 'dev')
    return name

def create_resource_hierarchy(integrations):
    """Build resource path hierarchy from integrations"""
    paths = defaultdict(lambda: defaultdict(set))  # Use set to avoid duplicates
    
    for integration in integrations:
        path = integration['path']
        method = integration['method']
        lambda_func = integration['lambdaFunction']
        
        paths[path][method].add(lambda_func)
    
    # Convert sets back to lists
    result = {}
    for path, methods in paths.items():
        result[path] = {method: list(funcs) for method, funcs in methods.items()}
    
    return result

def path_to_variable_name(path):
    """Convert path to valid TypeScript variable name"""
    # Remove leading slash and replace special chars
    var_name = path.lstrip('/').replace('/', '_').replace('{', '').replace('}', '').replace('-', '_')
    return var_name if var_name else 'root'

def generate_api_stack_code(api_name, integrations_file, output_file):
    """Generate complete CDK stack code"""
    
    # Load integrations
    with open(integrations_file, 'r') as f:
        integrations = json.load(f)
    
    print(f"Generating {api_name} stack with {len(integrations)} integrations...")
    
    # Build resource hierarchy
    paths = create_resource_hierarchy(integrations)
    
    # Start building TypeScript code
    code_lines = []
    code_lines.append(f"""import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {{ Construct }} from 'constructs';
import {{ EnvironmentConfig }} from '../../config/environment-config';
import {{ ResourceNames }} from '../../config/resource-names';

export interface {api_name}Props extends cdk.StackProps {{
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}}

export class {api_name} extends cdk.Stack {{
  public readonly api: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props: {api_name}Props) {{
    super(scope, id, props);
    
    const {{ config, resourceNames, userPool }} = props;
    
    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {{
      restApiName: resourceNames.apiGateway('{api_name.lower().replace('stack', '').replace('bebco', '')}'),
      defaultCorsPreflightOptions: {{
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      }},
      deployOptions: {{
        stageName: 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      }},
      cloudWatchRole: true,
    }});
    
    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {{
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    }});
    
    // Lambda functions
""")
    
    # Collect all unique Lambda functions
    lambda_functions = set()
    for integration in integrations:
        lambda_functions.add(integration['lambdaFunction'])
    
    # Import Lambda functions
    func_vars = {}
    for i, func_name in enumerate(sorted(lambda_functions)):
        dev_func_name = transform_lambda_name(func_name)
        var_name = f"fn{i}"
        func_vars[func_name] = var_name
        code_lines.append(f"    const {var_name} = lambda.Function.fromFunctionName(this, 'Fn{i}', '{dev_func_name}');")
    
    code_lines.append("\n    // API Resources and Methods\n")
    
    # Build resource tree
    resource_vars = {'': 'this.api.root'}
    options_handled = set()  # Track which resources have OPTIONS added
    
    # Sort paths to process parent paths before children
    sorted_paths = sorted(paths.keys(), key=lambda p: (p.count('/'), p))
    
    for path in sorted_paths:
        if path == '/':
            continue
            
        methods = paths[path]
        
        # Build resource path
        path_parts = [p for p in path.split('/') if p]
        parent_path = '/' + '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''
        current_part = path_parts[-1]
        
        # Create resource if not exists
        if path not in resource_vars:
            parent_var = resource_vars.get(parent_path, 'this.api.root')
            # Use full path for variable name to avoid collisions
            var_name = path_to_variable_name(path) if path != '' else 'root'
            
            code_lines.append(f"    const {var_name} = {parent_var}.addResource('{current_part}');")
            resource_vars[path] = var_name
        
        # Add methods
        for method, funcs in methods.items():
            if not funcs:
                continue
            
            # Skip OPTIONS methods - CORS will handle them automatically
            if method == 'OPTIONS':
                continue
            
            func_name = funcs[0]  # Use first function if multiple
            func_var = func_vars[func_name]
            resource_var = resource_vars[path]
            
            code_lines.append(f"    {resource_var}.addMethod('{method}', new apigateway.LambdaIntegration({func_var}), {{ authorizer }});")
        
        code_lines.append("")
    
    # Outputs
    code_lines.append("""
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
""")
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write('\n'.join(code_lines))
    
    print(f"✓ Generated {output_file}")
    print(f"  - {len(lambda_functions)} Lambda functions")
    print(f"  - {len(paths)} API paths")
    print(f"  - {len(integrations)} integrations")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: generate-api-stack-code.py <api-name> <integrations-file> <output-file>")
        sys.exit(1)
    
    api_name = sys.argv[1]
    integrations_file = sys.argv[2]
    output_file = sys.argv[3]
    
    generate_api_stack_code(api_name, integrations_file, output_file)

