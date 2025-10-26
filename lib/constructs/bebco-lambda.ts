import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { LambdaConfigLoader } from '../config/lambda-config';
import { ResourceNames } from '../config/resource-names';

export interface BebcoLambdaProps {
  sourceFunctionName: string;  // Original name from us-east-1
  newFunctionName?: string;     // New name for us-east-2 (optional, will be generated if not provided)
  resourceNames: ResourceNames;
  environment?: { [key: string]: string };  // Override/add environment variables
  layers?: lambda.ILayerVersion[];  // Override layers
}

export class BebcoLambda extends Construct {
  public readonly function: lambda.Function;
  
  constructor(scope: Construct, id: string, props: BebcoLambdaProps) {
    super(scope, id);
    
    // Load original function configuration
    const config = LambdaConfigLoader.getByName(props.sourceFunctionName);
    if (!config) {
      throw new Error(`Lambda configuration not found for: ${props.sourceFunctionName}`);
    }
    
    // Check if package exists
    const packagePath = LambdaConfigLoader.getPackagePath(props.sourceFunctionName);
    if (!LambdaConfigLoader.packageExists(props.sourceFunctionName)) {
      throw new Error(`Lambda package not found: ${packagePath}. Run download-lambda-packages script first.`);
    }
    
    // Generate new function name (bebco-staging-X → bebco-dev-X)
    // For functions without "staging", keep the original name (they're already environment-agnostic)
    let newName = props.newFunctionName;
    if (!newName) {
      if (config.name.includes('staging')) {
        newName = config.name.replace('staging', 'dev').replace('bebco-bebco', 'bebco');
      } else {
        // For functions without staging (bebco-admin-*, bebco-agent-*, bebco-docusign-*, etc.)
        // Keep original name as they're environment-agnostic or managed via aliases
        newName = config.name;
      }
    }
    
    // Map runtime string to CDK Runtime
    const runtime = this.mapRuntime(config.runtime);
    
    // Merge environment variables
    const environment = {
      ...config.environment,
      ...(props.environment || {})
    };
    
    // Create Lambda function
    this.function = new lambda.Function(this, 'Function', {
      functionName: newName,
      runtime: runtime,
      handler: config.handler,
      code: lambda.Code.fromAsset(packagePath),
      timeout: cdk.Duration.seconds(config.timeout),
      memorySize: config.memorySize,
      environment: environment,
      layers: props.layers,
      tracing: lambda.Tracing.ACTIVE,
    });
    
    // Add tags
    cdk.Tags.of(this.function).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this.function).add('Project', 'bebco');
    cdk.Tags.of(this.function).add('SourceFunction', props.sourceFunctionName);
  }
  
  private mapRuntime(runtimeString: string): lambda.Runtime {
    switch (runtimeString) {
      case 'python3.9':
        return lambda.Runtime.PYTHON_3_9;
      case 'python3.11':
        return lambda.Runtime.PYTHON_3_11;
      case 'python3.12':
        return lambda.Runtime.PYTHON_3_12;
      case 'nodejs18.x':
        return lambda.Runtime.NODEJS_18_X;
      case 'nodejs20.x':
        return lambda.Runtime.NODEJS_20_X;
      default:
        throw new Error(`Unsupported runtime: ${runtimeString}`);
    }
  }
}

