#!/usr/bin/env python3
"""
Generate CDK TypeScript code for API Gateway stacks with Lambda integrations - V2
This version properly handles resource tree creation
"""

import json
import sys
import os
from collections import defaultdict

# Load function mappings
def load_function_mappings():
    """Load Lambda function name mappings for missing/renamed functions"""
    mapping_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'lambda-function-mappings.json')
    if os.path.exists(mapping_file):
        with open(mapping_file, 'r') as f:
            return json.load(f)
    return {}

FUNCTION_MAPPINGS = load_function_mappings()

def transform_lambda_name(name):
    """Transform staging Lambda names to dev names, applying mappings first"""
    # Apply mapping if exists
    if name in FUNCTION_MAPPINGS:
        name = FUNCTION_MAPPINGS[name]
    
    # Then do staging->dev transform
    if 'staging' in name:
        return name.replace('staging', 'dev')
    return name

def path_to_variable_name(path):
    """Convert path to valid TypeScript variable name"""
    if not path or path == '/':
        return 'root'
    var_name = path.lstrip('/').replace('/', '_').replace('{', '').replace('}', '').replace('-', '_')
    return var_name

def parse_integrations(integrations):
    """Parse integrations into a structured format"""
    paths_data = defaultdict(lambda: defaultdict(set))
    
    for integration in integrations:
        path = integration['path']
        method = integration['method']
        lambda_func = integration['lambdaFunction']
        
        paths_data[path][method].add(lambda_func)
    
    return paths_data

def get_all_paths_in_tree(paths_data):
    """Get all paths including intermediate paths that need to be created"""
    all_paths = set()
    
    for path in paths_data.keys():
        # Add this path
        all_paths.add(path)
        
        # Add all parent paths
        parts = [p for p in path.split('/') if p]
        for i in range(1, len(parts)):
            parent_path = '/' + '/'.join(parts[:i])
            all_paths.add(parent_path)
    
    return sorted(all_paths, key=lambda p: (p.count('/'), p))

def generate_api_stack_code(api_name, integrations_file, output_file):
    """Generate complete CDK stack code"""
    
    # Load integrations
    with open(integrations_file, 'r') as f:
        integrations = json.load(f)
    
    print(f"Generating {api_name} stack with {len(integrations)} integrations...")
    
    # Parse integrations
    paths_data = parse_integrations(integrations)
    
    # Get all paths including intermediates
    all_paths = get_all_paths_in_tree(paths_data)
    
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
    for path, methods in paths_data.items():
        for method, funcs in methods.items():
            if method != 'OPTIONS':  # Skip OPTIONS
                lambda_functions.update(funcs)
    
    # Import Lambda functions
    func_vars = {}
    for i, func_name in enumerate(sorted(lambda_functions)):
        dev_func_name = transform_lambda_name(func_name)
        var_name = f"fn{i}"
        func_vars[func_name] = var_name
        code_lines.append(f"    const {var_name} = lambda.Function.fromFunctionName(this, 'Fn{i}', '{dev_func_name}');")
    
    code_lines.append("\n    // API Resources\n")
    
    # Build resource tree
    resource_vars = {}
    
    for path in all_paths:
        path_parts = [p for p in path.split('/') if p]
        parent_path = '/' + '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''
        current_part = path_parts[-1] if path_parts else ''
        
        # Get parent variable
        if parent_path == '':
            parent_var = 'this.api.root'
        elif parent_path in resource_vars:
            parent_var = resource_vars[parent_path]
        else:
            # This shouldn't happen if we sorted correctly, but just in case
            print(f"Warning: Parent path {parent_path} not found for {path}")
            continue
        
        # Create resource variable name
        var_name = path_to_variable_name(path)
        
        # Create the resource
        code_lines.append(f"    const {var_name} = {parent_var}.addResource('{current_part}');")
        resource_vars[path] = var_name
    
    code_lines.append("\n    // API Methods\n")
    
    # Add methods
    for path in all_paths:
        if path not in paths_data:
            continue
            
        methods = paths_data[path]
        resource_var = resource_vars[path]
        
        for method in sorted(methods.keys()):
            if method == 'OPTIONS':
                # Skip OPTIONS - handled by CORS
                continue
            
            funcs = list(methods[method])
            if not funcs:
                continue
            
            func_name = funcs[0]
            func_var = func_vars[func_name]
            
            code_lines.append(f"    {resource_var}.addMethod('{method}', new apigateway.LambdaIntegration({func_var}), {{ authorizer }});")
    
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
    print(f"  - {len(all_paths)} API resources (including intermediates)")
    print(f"  - {len(integrations)} integrations")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: generate-api-stack-code-v2.py <api-name> <integrations-file> <output-file>")
        sys.exit(1)
    
    api_name = sys.argv[1]
    integrations_file = sys.argv[2]
    output_file = sys.argv[3]
    
    generate_api_stack_code(api_name, integrations_file, output_file)

