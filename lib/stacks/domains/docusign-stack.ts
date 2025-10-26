import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
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
    
    const commonEnv = {
      REGION: this.region,
      DOCUSIGN_SECRET_NAME: props.config.integrations.docusignSecretName,
    };
    
    const docusignSendEnvelope = new BebcoLambda(this, 'DocuSignSendEnvelope', {
      sourceFunctionName: 'bebco-docusign-send_envelope',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignSendEnvelope = docusignSendEnvelope.function;
    
    const docusignGetEnvelope = new BebcoLambda(this, 'DocuSignGetEnvelope', {
      sourceFunctionName: 'bebco-docusign-get_envelope',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignGetEnvelope = docusignGetEnvelope.function;
    
    const docusignResendEnvelope = new BebcoLambda(this, 'DocuSignResendEnvelope', {
      sourceFunctionName: 'bebco-docusign-resend_envelope',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignResendEnvelope = docusignResendEnvelope.function;
    
    const docusignWebhookComplete = new BebcoLambda(this, 'DocuSignWebhookComplete', {
      sourceFunctionName: 'bebco-docusign-webhook_complete',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignWebhookComplete = docusignWebhookComplete.function;
    
    const docusignTemplatesSync = new BebcoLambda(this, 'DocuSignTemplatesSync', {
      sourceFunctionName: 'bebco-docusign-templates_sync',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignTemplatesSync = docusignTemplatesSync.function;
    
    const docusignLegacySendEnvelope = new BebcoLambda(this, 'DocuSignLegacySendEnvelope', {
      sourceFunctionName: 'bebco-docusignLegacy-send-envelope',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.docusignLegacySendEnvelope = docusignLegacySendEnvelope.function;
    
    new cdk.CfnOutput(this, 'DocuSignSendEnvelopeArn', {
      value: this.functions.docusignSendEnvelope.functionArn,
    });
  }
}

