export class ResourceNames {
  constructor(
    private prefix: string,
    private environment: string,
    private region: string,
    private account: string
  ) {}
  
  // DynamoDB tables: bebco-borrower-<table>-dev
  table(domain: string, name: string): string {
    return `${this.prefix}-${domain}-${name}-${this.environment}`;
  }
  
  // Lambda functions: bebco-dev-<domain>-<action>
  lambda(domain: string, action: string): string {
    return `${this.prefix}-${this.environment}-${domain}-${action}`;
  }
  
  // S3 buckets (globally unique): bebco-<purpose>-dev-us-east-2-<account>
  bucket(purpose: string): string {
    return `${this.prefix}-${purpose}-${this.environment}-${this.region}-${this.account}`;
  }
  
  // SQS queues: bebco-dev-<domain>-<purpose>
  queue(domain: string, purpose: string): string {
    return `${this.prefix}-${this.environment}-${domain}-${purpose}`;
  }
  
  // SQS FIFO queues: bebco-dev-<domain>-<purpose>.fifo
  queueFifo(domain: string, purpose: string): string {
    return `${this.prefix}-${this.environment}-${domain}-${purpose}.fifo`;
  }
  
  // SNS topics: bebco-dev-<purpose>
  topic(purpose: string): string {
    return `${this.prefix}-${this.environment}-${purpose}`;
  }

  // IAM roles: bebco-dev-<purpose>
  iamRole(purpose: string): string {
    return `${this.prefix}-${this.environment}-${purpose}`;
  }
  
  // API Gateways: bebco-<domain>-dev-api
  apiGateway(domain: string): string {
    return `${this.prefix}-${domain}-${this.environment}-api`;
  }
  
  // EventBridge rules: bebco-dev-<purpose>-rule
  eventRule(purpose: string): string {
    return `${this.prefix}-${this.environment}-${purpose}-rule`;
  }
  
  // Cognito User Pool: bebco-borrower-portal-dev
  userPool(): string {
    return `${this.prefix}-borrower-portal-${this.environment}`;
  }
  
  // AppSync API: bebco-<api-name>-dev
  appSyncApi(apiName: string): string {
    return `${this.prefix}-${apiName}-${this.environment}`;
  }
}

