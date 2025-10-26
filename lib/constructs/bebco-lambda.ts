import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { LambdaConfigLoader } from '../config/lambda-config';
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceNames } from '../config/resource-names';

export interface BebcoLambdaProps {
  sourceFunctionName: string;  // Original name from us-east-1
  newFunctionName?: string;     // New name for us-east-2 (optional, will be generated if not provided)
  resourceNames: ResourceNames;
  config?: EnvironmentConfig;
  environmentSuffix?: string;   // Environment suffix (dev, jaspal, dinu, brandon, steven) - defaults to 'dev'
  environment?: { [key: string]: string };  // Override/add environment variables
  layers?: lambda.ILayerVersion[];  // Override layers
  secrets?: secretsmanager.ISecret[];
  topicsToPublish?: sns.ITopic[];
  queuesToSend?: sqs.IQueue[];
  queuesToConsume?: sqs.IQueue[];
  additionalPolicies?: iam.PolicyStatement[];
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
    
    const stack = cdk.Stack.of(this);
    const region = stack.region;
    const account = stack.account;

    // Generate new function name with environment suffix
    let newName = props.newFunctionName;
    if (!newName) {
      newName = BebcoLambda.normalizedFunctionName(config.name, envSuffix);
    }
    
    // Map runtime string to CDK Runtime
    const runtime = this.mapRuntime(config.runtime);
    
    // Merge environment variables and update table names to match environment
    const environment: { [key: string]: string } = {};
    
    // Update original environment variables to point to correct tables
    const tableNameOverrides: Record<string, string> = {
      ANNUAL_REPORTS_TABLE: 'annual-reportings',
      BANKS_TABLE: 'banks',
      COMPANIES_TABLE: 'companies',
      DOCUMENTS_TABLE: 'documents',
      FILES_TABLE: 'files',
      INVOICES_TABLE: 'invoices',
      LEDGER_TABLE: 'ledger-entries',
      LOANS_TABLE: 'loans',
      LOANS_TABLE_NAME: 'loans',
      MONTHLY_REPORTS_TABLE: 'monthly-reportings',
      PAYMENTS_TABLE: 'payments',
      PLAID_ITEMS_TABLE: 'plaid-items',
      STATEMENTS_TABLE: 'statements',
      TRANSACTIONS_TABLE: 'transactions',
      USERS_TABLE: 'users',
      OTP_TABLE: 'otp-codes',
    };

    const bucketKeys = new Set([
      'DOCUMENTS_S3_BUCKET',
      'DOCUMENTS_BUCKET',
      'S3_BUCKET',
      'S3_STAGING_BUCKET',
      'OUTPUT_BUCKET',
    ]);

    for (const [key, value] of Object.entries(config.environment || {})) {
      const originalValue = value;
      let newValue = value;

      if (envSuffix !== 'dev') {
        newValue = newValue.replace(/bebco-borrower-(\w+)-staging/g, `bebco-borrower-$1-${envSuffix}`);
        newValue = newValue.replace(/bebco-borrower-(\w+)-dev/g, `bebco-borrower-$1-${envSuffix}`);
        newValue = newValue.replace(/borrower-(\w+)-staging/g, `borrower-$1-${envSuffix}`);
        newValue = newValue.replace(/borrower-(\w+)-dev/g, `borrower-$1-${envSuffix}`);
      } else {
        newValue = newValue.replace(/staging/g, 'dev');
      }

      newValue = newValue.replace(/us-east-1/g, region);
      newValue = newValue.replace(/303555290462/g, account);

      if (bucketKeys.has(key)) {
        newValue = props.environment?.[key] ?? props.resourceNames.bucket('borrower-documents');
      }

      if (tableNameOverrides[key]) {
        newValue = props.environment?.[key] ?? props.resourceNames.table('borrower', tableNameOverrides[key]);
      } else if (['DYNAMODB_TABLE', 'TABLE_NAME', 'DYNAMODB_TABLE_NAME'].includes(key)) {
        const derivedTable = BebcoLambda.tryMapBorrowerTable(originalValue, props.resourceNames);
        if (derivedTable) {
          newValue = derivedTable;
        }
      }

      if (key === 'DYNAMODB_DOCUSIGN_REQUESTS_TABLE') {
        const tableName = props.config?.integrations.docusignRequestsTableName ?? 'docusign-requests';
        newValue = props.resourceNames.table('integrations', tableName);
      }

      if (key === 'OCR_RESULTS_TOPIC_ARN') {
        const topicName = props.resourceNames.topic(props.config?.textract.snsTopicName ?? 'textract-results');
        newValue = `arn:aws:sns:${region}:${account}:${topicName}`;
      }

      if (key === 'TEXTRACT_ROLE_ARN') {
        const roleName = props.resourceNames.iamRole(props.config?.textract.roleName ?? 'textract-sns-role');
        newValue = `arn:aws:iam::${account}:role/${roleName}`;
      }

      if (key === 'TRANSACTIONS_SYNC_QUEUE_URL') {
        const queueBaseName = props.config?.integrations.plaidSyncQueueName ?? 'plaid-transactions-sync';
        const queueName = BebcoLambda.buildQueueName(queueBaseName, props.resourceNames, false);
        newValue = `https://sqs.${region}.amazonaws.com/${account}/${queueName}`;
      }

      if (key === 'WEBHOOK_BASE_URL') {
        newValue = props.config?.integrations.plaidWebhookBaseUrl ?? `https://${props.config?.domains.api}/plaid/webhook`;
      }

      if (key === 'STAGE') {
        newValue = props.config?.environment ?? (envSuffix !== 'dev' ? envSuffix : 'dev');
      }

      if (['SEND2FA_FUNCTION', 'VERIFY2FA_FUNCTION', 'SYNC_WORKER_FUNCTION_NAME'].includes(key) && originalValue.startsWith('bebco-')) {
        newValue = BebcoLambda.normalizedFunctionName(originalValue, envSuffix);
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

    props.secrets?.forEach(secret => secret.grantRead(this.function));
    props.topicsToPublish?.forEach(topic => topic.grantPublish(this.function));
    props.queuesToSend?.forEach(queue => queue.grantSendMessages(this.function));
    props.queuesToConsume?.forEach(queue => queue.grantConsumeMessages(this.function));
    props.additionalPolicies?.forEach(policy => this.function.addToRolePolicy(policy));
    
    // Add tags
    cdk.Tags.of(this.function).add('ManagedBy', 'CDK-v2');
    cdk.Tags.of(this.function).add('Project', 'bebco');
    cdk.Tags.of(this.function).add('SourceFunction', props.sourceFunctionName);
  }
  
  private static normalizedFunctionName(originalName: string, envSuffix: string): string {
    let baseName = originalName.replace(/staging/g, 'dev');
    if (envSuffix !== 'dev' && !baseName.endsWith(`-${envSuffix}`)) {
      baseName = `${baseName}-${envSuffix}`;
    }
    return baseName.replace(/^bebco-bebco/, 'bebco');
  }

  private static tryMapBorrowerTable(value: string, resourceNames: ResourceNames): string | undefined {
    if (!value) {
      return undefined;
    }
    const match = value.match(/^bebco-borrower-([a-z0-9-]+)-(?:staging|dev)$/);
    if (!match) {
      return undefined;
    }
    return resourceNames.table('borrower', match[1]);
  }

  private static buildQueueName(baseName: string, resourceNames: ResourceNames, isFifo: boolean): string {
    if (!baseName) {
      return baseName;
    }
    const parts = baseName.split('-');
    if (parts.length < 2) {
      return baseName;
    }
    const domain = parts.shift()!;
    let purposeParts = parts;
    if (isFifo && purposeParts[purposeParts.length - 1] === 'fifo') {
      purposeParts = purposeParts.slice(0, -1);
    }
    const purpose = purposeParts.join('-');
    return isFifo ? resourceNames.queueFifo(domain, purpose) : resourceNames.queue(domain, purpose);
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

