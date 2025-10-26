import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface DocuSignStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class DocuSignStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: DocuSignStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    const baseLambdaProps = {
      resourceNames,
      config: props.config,
      environmentSuffix: props.config.naming.environmentSuffix,
    };
    const docusignSecret = secretsmanager.Secret.fromSecretNameV2(this, 'DocusignSecret', props.config.integrations.docusignSecretName);
    const sharepointSecret = secretsmanager.Secret.fromSecretNameV2(this, 'DocusignSharepointSecret', props.config.integrations.sharepointSecretName);
    const docusignSecrets = [docusignSecret, sharepointSecret];
    
    const commonEnv: Record<string, string> = {
      REGION: this.region,
      DOCUSIGN_SECRET_NAME: props.config.integrations.docusignSecretName,
      SHAREPOINT_SECRET_NAME: props.config.integrations.sharepointSecretName,
    };
    if (props.config.integrations.docusignHost) {
      commonEnv.DOCUSIGN_HOST = props.config.integrations.docusignHost;
    }
    if (props.config.integrations.docusignLegacySecretName) {
      commonEnv.DOCUSIGN_LEGACY_SECRET_NAME = props.config.integrations.docusignLegacySecretName;
    }
    
    const docusignSendEnvelope = new BebcoLambda(this, 'DocuSignSendEnvelope', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusign-send_envelope',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignSendEnvelope = docusignSendEnvelope.function;
    
    const docusignGetEnvelope = new BebcoLambda(this, 'DocuSignGetEnvelope', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusign-get_envelope',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignGetEnvelope = docusignGetEnvelope.function;
    
    const docusignResendEnvelope = new BebcoLambda(this, 'DocuSignResendEnvelope', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusign-resend_envelope',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignResendEnvelope = docusignResendEnvelope.function;
    
    const docusignWebhookComplete = new BebcoLambda(this, 'DocuSignWebhookComplete', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusign-webhook_complete',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignWebhookComplete = docusignWebhookComplete.function;
    
    const docusignTemplatesSync = new BebcoLambda(this, 'DocuSignTemplatesSync', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusign-templates_sync',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignTemplatesSync = docusignTemplatesSync.function;
    
    const docusignLegacySendEnvelope = new BebcoLambda(this, 'DocuSignLegacySendEnvelope', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-docusignLegacy-send-envelope',
      environment: commonEnv,
      secrets: docusignSecrets,
    });
    this.functions.docusignLegacySendEnvelope = docusignLegacySendEnvelope.function;

    if (tables.docusignRequests) {
      Object.values(this.functions).forEach(fn => tables.docusignRequests.grantReadWriteData(fn));
    }
    
    new cdk.CfnOutput(this, 'DocuSignSendEnvelopeArn', {
      value: this.functions.docusignSendEnvelope.functionArn,
    });
  }
}

