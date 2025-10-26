#!/usr/bin/env python3
"""
Extract Lambda integrations from API Gateway resources
READ ONLY operation on us-east-1
"""

import json
import subprocess
import sys
import re

def get_integration(api_id, resource_id, http_method, region='us-east-1'):
    """Get integration details for a specific method"""
    try:
        result = subprocess.run([
            'aws', 'apigateway', 'get-integration',
            '--rest-api-id', api_id,
            '--resource-id', resource_id,
            '--http-method', http_method,
            '--region', region,
            '--output', 'json'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"    Warning: Failed to get integration for {http_method}: {e}", file=sys.stderr)
        return None

def extract_lambda_name(uri):
    """Extract Lambda function name from integration URI"""
    if not uri:
        return None
    match = re.search(r'function:([^/]+)/', uri)
    if match:
        return match.group(1)
    return None

def main(api_id, resources_file, output_file):
    print(f"Processing API: {api_id}")
    print(f"Reading resources from: {resources_file}")
    print(f"Output will be saved to: {output_file}")
    print("")
    
    # Load resources
    with open(resources_file, 'r') as f:
        resources_data = json.load(f)
    
    resources = resources_data.get('items', [])
    integrations = []
    
    total = len(resources)
    for i, resource in enumerate(resources, 1):
        resource_id = resource.get('id')
        path = resource.get('path')
        methods = resource.get('resourceMethods', {})
        
        if methods:
            print(f"[{i}/{total}] {path}")
            
            for method in methods.keys():
                integration = get_integration(api_id, resource_id, method)
                
                if integration:
                    lambda_uri = integration.get('uri', '')
                    lambda_name = extract_lambda_name(lambda_uri)
                    integration_type = integration.get('type', '')
                    
                    if lambda_name:
                        integrations.append({
                            'path': path,
                            'method': method,
                            'lambdaFunction': lambda_name,
                            'uri': lambda_uri,
                            'integrationType': integration_type
                        })
                        print(f"    {method} -> {lambda_name}")
    
    # Save results
    with open(output_file, 'w') as f:
        json.dump(integrations, f, indent=2)
    
    print("")
    print(f"✓ Extracted {len(integrations)} Lambda integrations")
    return len(integrations)

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: extract-api-integrations.py <api-id> <resources-file> <output-file>")
        sys.exit(1)
    
    api_id = sys.argv[1]
    resources_file = sys.argv[2]
    output_file = sys.argv[3]
    
    count = main(api_id, resources_file, output_file)
    sys.exit(0 if count > 0 else 1)

