import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface IntegrationsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  textractRole: iam.IRole;
  textractResultsTopic: sns.ITopic;
}

export class IntegrationsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: IntegrationsStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets, config, textractRole, textractResultsTopic } = props;
    const baseLambdaProps = {
      resourceNames,
      config,
      environmentSuffix: config.naming.environmentSuffix,
    };

    const sharepointSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SharepointSecret', config.integrations.sharepointSecretName);

    const sharepointEnvBase: Record<string, string> = {
      REGION: this.region,
      SHAREPOINT_SECRET_NAME: config.integrations.sharepointSecretName,
    };
    if (config.integrations.sharepointHost) {
      sharepointEnvBase.SHAREPOINT_HOST = config.integrations.sharepointHost;
    }
    if (config.integrations.sharepointSitePath) {
      sharepointEnvBase.SHAREPOINT_SITE_PATH = config.integrations.sharepointSitePath;
    }
    if (config.integrations.sharepointDriveName) {
      sharepointEnvBase.SHAREPOINT_DRIVE_NAME = config.integrations.sharepointDriveName;
    }
    if (config.integrations.sharepointTenantId) {
      sharepointEnvBase.SHAREPOINT_TENANT_ID = config.integrations.sharepointTenantId;
    }
    if (config.integrations.sharepointClientId) {
      sharepointEnvBase.SHAREPOINT_CLIENT_ID = config.integrations.sharepointClientId;
    }
    if (config.integrations.sharepointPortReconFilePath) {
      sharepointEnvBase.PORT_RECON_FILE_PATH = config.integrations.sharepointPortReconFilePath;
    }
    if (config.integrations.sharepointS3Prefix) {
      sharepointEnvBase.SHAREPOINT_S3_PREFIX = config.integrations.sharepointS3Prefix;
    }
    if (config.integrations.sharepointBankId) {
      sharepointEnvBase.EAJF_BANK_ID = config.integrations.sharepointBankId;
    }
    sharepointEnvBase.SHAREPOINT_CLIENT_SECRET = config.integrations.sharepointSecretName;

    const textractPolicies = [
      new iam.PolicyStatement({
        actions: [
          'textract:StartDocumentAnalysis',
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentAnalysis',
          'textract:GetDocumentTextDetection',
        ],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [textractRole.roleArn],
      }),
    ];

    // SharePoint Integration Functions
    // 1. bebco-staging-sharepoint-sync-portfolio
    const sharepointSyncPortfolio = new BebcoLambda(this, 'SharepointSyncPortfolio', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-sharepoint-sync-portfolio',
      environment: {
        ...sharepointEnvBase,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        S3_STAGING_BUCKET: buckets.documents.bucketName,
        LOANS_TABLE: tables.loans.tableName,
        COMPANIES_TABLE: tables.companies.tableName,
      },
      secrets: [sharepointSecret],
    });
    buckets.documents.grantReadWrite(sharepointSyncPortfolio.function);
    tables.loans.grantReadData(sharepointSyncPortfolio.function);
    tables.companies.grantReadData(sharepointSyncPortfolio.function);
    this.functions.sharepointSyncPortfolio = sharepointSyncPortfolio.function;

    // 2. bebco-staging-sharepoint-manual-sync
    const sharepointManualSync = new BebcoLambda(this, 'SharepointManualSync', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-sharepoint-manual-sync',
      environment: {
        ...sharepointEnvBase,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        S3_STAGING_BUCKET: buckets.documents.bucketName,
        LOANS_TABLE: tables.loans.tableName,
        COMPANIES_TABLE: tables.companies.tableName,
      },
      secrets: [sharepointSecret],
    });
    buckets.documents.grantReadWrite(sharepointManualSync.function);
    tables.loans.grantReadData(sharepointManualSync.function);
    tables.companies.grantReadData(sharepointManualSync.function);
    this.functions.sharepointManualSync = sharepointManualSync.function;

    // 3. bebco-staging-sharepoint-sync-status
    const sharepointSyncStatus = new BebcoLambda(this, 'SharepointSyncStatus', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-sharepoint-sync-status',
      environment: sharepointEnvBase,
      secrets: [sharepointSecret],
    });
    this.functions.sharepointSyncStatus = sharepointSyncStatus.function;

    // OCR and Document Processing
    // 4. bebco-staging-analyze-documents
    const analyzeDocuments = new BebcoLambda(this, 'AnalyzeDocuments', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-analyze-documents',
      environment: {
        ...sharepointEnvBase,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
        TEXTRACT_ROLE_ARN: textractRole.roleArn,
        OCR_RESULTS_TOPIC_ARN: textractResultsTopic.topicArn,
      },
      secrets: [sharepointSecret],
      topicsToPublish: [textractResultsTopic],
      additionalPolicies: textractPolicies,
    });
    buckets.documents.grantRead(analyzeDocuments.function);
    tables.files.grantReadWriteData(analyzeDocuments.function);
    this.functions.analyzeDocuments = analyzeDocuments.function;

    // 5. bebco-borrower-staging-process-document-ocr
    const processDocumentOcr = new BebcoLambda(this, 'ProcessDocumentOcr', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-borrower-staging-process-document-ocr',
      environment: {
        ...sharepointEnvBase,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        FILES_TABLE: tables.files.tableName,
        TEXTRACT_ROLE_ARN: textractRole.roleArn,
        OCR_RESULTS_TOPIC_ARN: textractResultsTopic.topicArn,
      },
      secrets: [sharepointSecret],
      topicsToPublish: [textractResultsTopic],
      additionalPolicies: textractPolicies,
    });
    buckets.documents.grantReadWrite(processDocumentOcr.function);
    tables.files.grantReadWriteData(processDocumentOcr.function);
    this.functions.processDocumentOcr = processDocumentOcr.function;

    // Excel Parser
    // 6. bebco-staging-excel-parser
    const excelParser = new BebcoLambda(this, 'ExcelParser', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-excel-parser',
      environment: {
        ...sharepointEnvBase,
        DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
        LOANS_TABLE_NAME: tables.loans.tableName,
        LOANS_BANK_COMPANY_INDEX: 'BankCompanyIndex',
        LOANS_TRANSACTION_INDEX: 'TransactionTypeIndex',
      },
      secrets: [sharepointSecret],
    });
    buckets.documents.grantRead(excelParser.function);
    this.functions.excelParser = excelParser.function;

    // Agent Functions (AI/Automation)
    // 7. bebco-agent-resolve-company-tool
    const agentResolveCompanyTool = new BebcoLambda(this, 'AgentResolveCompanyTool', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-agent-resolve-company-tool',
      environment: {
        REGION: this.region,
        COMPANIES_TABLE: tables.companies.tableName,
      },
    });
    tables.companies.grantReadData(agentResolveCompanyTool.function);
    this.functions.agentResolveCompanyTool = agentResolveCompanyTool.function;

    // 8. bebco-agent-run-partiql-tool
    const agentRunPartiqlTool = new BebcoLambda(this, 'AgentRunPartiqlTool', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-agent-run-partiql-tool',
      environment: {
        REGION: this.region,
      },
    });
    // TODO: Grant appropriate DynamoDB permissions based on what PartiQL queries need
    this.functions.agentRunPartiqlTool = agentRunPartiqlTool.function;
  }
}

