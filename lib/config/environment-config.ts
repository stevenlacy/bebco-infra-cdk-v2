import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';

export interface EnvironmentConfig {
  environment: string;
  region: string;
  account: string;
  stackPrefix?: string;
  naming: {
    prefix: string;
    environmentSuffix: string;
  };
  cognito: {
    userPoolName: string;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };
  domains: {
    api: string;
    graphql: string;
  };
  integrations: {
    plaidClientId: string;
    plaidEnvironment: string;
    plaidWebhookBaseUrl?: string;
    plaidSyncQueueName?: string;
    plaidSyncQueueFifoName?: string;
    plaidSyncQueueDlqName?: string;
    plaidSyncQueueDlqFifoName?: string;
    docusignSecretName: string;
    docusignLegacySecretName?: string;
    docusignHost?: string;
    docusignRequestsTableName?: string;
    sharepointSecretName: string;
    sharepointHost?: string;
    sharepointSitePath?: string;
    sharepointDriveName?: string;
    sharepointTenantId?: string;
    sharepointClientId?: string;
    sharepointPortReconFilePath?: string;
    sharepointS3Prefix?: string;
    sharepointBankId?: string;
    sendgridSecretName: string;
    sendgridFromAddress?: string;
    sendgridApiKeyId?: string;
  };
  textract: {
    roleName: string;
    snsTopicName: string;
    roleArn?: string;
    snsTopicArn?: string;
  };
  lambdaDefaults: {
    runtime: string;
    timeout: number;
    memorySize: number;
  };
}

export class EnvironmentConfigLoader {
  static loadFromContext(app: cdk.App): EnvironmentConfig {
    const environment = app.node.tryGetContext('environment') || 'dev';
    const region = app.node.tryGetContext('region') || 'us-east-2';
    
    const configFileName = `${environment}-${region}.json`;
    const configPath = path.join(__dirname, '../../config/environments', configFileName);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config: EnvironmentConfig = JSON.parse(configData);
    
    console.log(`Loaded configuration: ${environment} @ ${region}`);
    return config;
  }
  
  static load(environment: string, region: string): EnvironmentConfig {
    const configFileName = `${environment}-${region}.json`;
    const configPath = path.join(__dirname, '../../config/environments', configFileName);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  }
}

