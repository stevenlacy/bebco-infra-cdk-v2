import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { LambdaConfigLoader } from '../config/lambda-config';
import { ResourceNames } from '../config/resource-names';

export interface BebcoLambdaProps {
  sourceFunctionName: string;  // Original name from us-east-1
  newFunctionName?: string;     // New name for us-east-2 (optional, will be generated if not provided)
  resourceNames: ResourceNames;
  environmentSuffix?: string;   // Environment suffix (dev, jaspal, dinu, brandon, steven) - defaults to 'dev'
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
    
    // Get environment suffix (default to 'dev' if not provided)
    const envSuffix = props.environmentSuffix || 'dev';
    
    // Generate new function name with environment suffix
    // For dev environments: keep dev and add suffix (e.g., bebco-dev-plaid-sync → bebco-dev-plaid-sync-jaspal)
    // For staging: replace staging with dev first (e.g., bebco-staging-X → bebco-dev-X-jaspal)
    let newName = props.newFunctionName;
    if (!newName) {
      // First normalize: replace 'staging' with 'dev'
      let baseName = config.name.replace(/staging/g, 'dev');
      
      // Then add environment suffix if not 'dev'
      if (envSuffix !== 'dev') {
        newName = `${baseName}-${envSuffix}`;
      } else {
        newName = baseName;
      }
      
      // Fix any double prefixes
      newName = newName.replace(/^bebco-bebco/, 'bebco');
    }
    
    // Map runtime string to CDK Runtime
    const runtime = this.mapRuntime(config.runtime);
    
    // Merge environment variables and update table names to match environment
    const environment: { [key: string]: string } = {};
    
    // Update original environment variables to point to correct tables
    for (const [key, value] of Object.entries(config.environment || {})) {
      let newValue = value;
      
      // Update DynamoDB table names in environment variables
      // Replace patterns like: bebco-borrower-X-staging → bebco-borrower-X-{env}
      // Or: bebco-borrower-X-dev → bebco-borrower-X-{env} (for non-dev environments)
      if (envSuffix !== 'dev') {
        // Replace staging with environment suffix
        newValue = newValue.replace(/bebco-borrower-(\w+)-staging/g, `bebco-borrower-$1-${envSuffix}`);
        // Replace dev with environment suffix  
        newValue = newValue.replace(/bebco-borrower-(\w+)-dev/g, `bebco-borrower-$1-${envSuffix}`);
        // Also handle cases without bebco- prefix
        newValue = newValue.replace(/borrower-(\w+)-staging/g, `borrower-$1-${envSuffix}`);
        newValue = newValue.replace(/borrower-(\w+)-dev/g, `borrower-$1-${envSuffix}`);
      } else {
        // For dev environment, just replace staging with dev
        newValue = newValue.replace(/staging/g, 'dev');
      }
      
      environment[key] = newValue;
    }
    
    // Merge with any overrides from props
    Object.assign(environment, props.environment || {});
    
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

