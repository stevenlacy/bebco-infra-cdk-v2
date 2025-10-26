import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface IntegrationsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class IntegrationsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: IntegrationsStackProps) {
    super(scope, id, props);

    const { resourceNames, tables, buckets } = props;

    const commonEnv = {
      REGION: this.region,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      FILES_TABLE: tables.files.tableName,
      SHAREPOINT_SECRET_NAME: props.config.integrations.sharepointSecretName,
    };

    // SharePoint Integration Functions
    // 1. bebco-staging-sharepoint-sync-portfolio
    const sharepointSyncPortfolio = new BebcoLambda(this, 'SharepointSyncPortfolio', {
      sourceFunctionName: 'bebco-staging-sharepoint-sync-portfolio',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    buckets.documents.grantReadWrite(sharepointSyncPortfolio.function);
    // TODO: Grant Secrets Manager permissions for SharePoint
    this.functions.sharepointSyncPortfolio = sharepointSyncPortfolio.function;

    // 2. bebco-staging-sharepoint-manual-sync
    const sharepointManualSync = new BebcoLambda(this, 'SharepointManualSync', {
      sourceFunctionName: 'bebco-staging-sharepoint-manual-sync',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    buckets.documents.grantReadWrite(sharepointManualSync.function);
    // TODO: Grant Secrets Manager permissions for SharePoint
    this.functions.sharepointManualSync = sharepointManualSync.function;

    // 3. bebco-staging-sharepoint-sync-status
    const sharepointSyncStatus = new BebcoLambda(this, 'SharepointSyncStatus', {
      sourceFunctionName: 'bebco-staging-sharepoint-sync-status',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    // TODO: Grant Secrets Manager permissions for SharePoint
    this.functions.sharepointSyncStatus = sharepointSyncStatus.function;

    // OCR and Document Processing
    // 4. bebco-staging-analyze-documents
    const analyzeDocuments = new BebcoLambda(this, 'AnalyzeDocuments', {
      sourceFunctionName: 'bebco-staging-analyze-documents',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        TEXTRACT_ROLE_ARN: 'arn:aws:iam::303555290462:role/bebco-dev-textract-role', // Placeholder
      },
    });
    buckets.documents.grantRead(analyzeDocuments.function);
    tables.files.grantReadWriteData(analyzeDocuments.function);
    // TODO: Grant Textract permissions
    this.functions.analyzeDocuments = analyzeDocuments.function;

    // 5. bebco-borrower-staging-process-document-ocr
    const processDocumentOcr = new BebcoLambda(this, 'ProcessDocumentOcr', {
      sourceFunctionName: 'bebco-borrower-staging-process-document-ocr',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        TEXTRACT_ROLE_ARN: 'arn:aws:iam::303555290462:role/bebco-dev-textract-role', // Placeholder
      },
    });
    buckets.documents.grantReadWrite(processDocumentOcr.function);
    tables.files.grantReadWriteData(processDocumentOcr.function);
    // TODO: Grant Textract permissions
    this.functions.processDocumentOcr = processDocumentOcr.function;

    // Excel Parser
    // 6. bebco-staging-excel-parser
    const excelParser = new BebcoLambda(this, 'ExcelParser', {
      sourceFunctionName: 'bebco-staging-excel-parser',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    buckets.documents.grantRead(excelParser.function);
    this.functions.excelParser = excelParser.function;

    // Agent Functions (AI/Automation)
    // 7. bebco-agent-resolve-company-tool
    const agentResolveCompanyTool = new BebcoLambda(this, 'AgentResolveCompanyTool', {
      sourceFunctionName: 'bebco-agent-resolve-company-tool',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        REGION: this.region,
        COMPANIES_TABLE: tables.companies.tableName,
      },
    });
    tables.companies.grantReadData(agentResolveCompanyTool.function);
    this.functions.agentResolveCompanyTool = agentResolveCompanyTool.function;

    // 8. bebco-agent-run-partiql-tool
    const agentRunPartiqlTool = new BebcoLambda(this, 'AgentRunPartiqlTool', {
      sourceFunctionName: 'bebco-agent-run-partiql-tool',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        REGION: this.region,
      },
    });
    // TODO: Grant appropriate DynamoDB permissions based on what PartiQL queries need
    this.functions.agentRunPartiqlTool = agentRunPartiqlTool.function;
  }
}

