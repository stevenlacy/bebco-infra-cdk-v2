import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery } from '../../utils/dynamodb-permissions';

export interface ReportingStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class ReportingStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: ReportingStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    const commonEnv = {
      REGION: this.region,
      MONTHLY_REPORTINGS_TABLE: tables.monthlyReportings.tableName,
      COMPANIES_TABLE: tables.companies.tableName,
      ANNUAL_REPORTINGS_TABLE: tables.annualReportings.tableName,
      LOANS_TABLE: tables.loans.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      TABLE_NAME: tables.monthlyReportings.tableName, // Override hardcoded TABLE_NAME
    };
    
    // Monthly Reports (6 functions)
    const monthlyReportsCreate = new BebcoLambda(this, 'MonthlyReportsCreate', {
      sourceFunctionName: 'bebco-staging-monthly-reports-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadWriteData(monthlyReportsCreate.function);
    tables.companies.grantReadData(monthlyReportsCreate.function);
    // Grant permission to query GSIs
    monthlyReportsCreate.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [`${tables.monthlyReportings.tableArn}/index/*`],
    }));
    this.functions.monthlyReportsCreate = monthlyReportsCreate.function;
    
    const monthlyReportsGet = new BebcoLambda(this, 'MonthlyReportsGet', {
      sourceFunctionName: 'bebco-staging-monthly-reports-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadData(monthlyReportsGet.function);
    tables.companies.grantReadData(monthlyReportsGet.function);
    // Grant permission to query GSIs
    monthlyReportsGet.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [`${tables.monthlyReportings.tableArn}/index/*`],
    }));
    this.functions.monthlyReportsGet = monthlyReportsGet.function;
    
    const monthlyReportsList = new BebcoLambda(this, 'MonthlyReportsList', {
      sourceFunctionName: 'bebco-staging-monthly-reports-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadData(monthlyReportsList.function);
    tables.companies.grantReadData(monthlyReportsList.function);
    // Grant permission to query GSIs
    monthlyReportsList.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [
        `${tables.monthlyReportings.tableArn}/index/*`,
      ],
    }));
    this.functions.monthlyReportsList = monthlyReportsList.function;
    
    const monthlyReportsUpdate = new BebcoLambda(this, 'MonthlyReportsUpdate', {
      sourceFunctionName: 'bebco-staging-monthly-reports-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadWriteData(monthlyReportsUpdate.function);
    tables.companies.grantReadData(monthlyReportsUpdate.function);
    // Grant permission to query GSIs
    monthlyReportsUpdate.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [`${tables.monthlyReportings.tableArn}/index/*`],
    }));
    this.functions.monthlyReportsUpdate = monthlyReportsUpdate.function;
    
    const monthlyReportSharepointUpload = new BebcoLambda(this, 'MonthlyReportSharepointUpload', {
      sourceFunctionName: 'bebco-staging-monthly-report-sharepoint-upload',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.monthlyReportSharepointUpload = monthlyReportSharepointUpload.function;
    
    const monthlyReportsScheduler = new BebcoLambda(this, 'MonthlyReportsScheduler', {
      sourceFunctionName: 'bebcostaging-monthly-reports-scheduler',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.monthlyReportsScheduler = monthlyReportsScheduler.function;
    
    // Annual Reports (5 functions)
    const annualReportsCreate = new BebcoLambda(this, 'AnnualReportsCreate', {
      sourceFunctionName: 'bebco-staging-annual-reports-create-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.annualReportings.tableName, // Override hardcoded DYNAMODB_TABLE
      },
    });
    this.functions.annualReportsCreate = annualReportsCreate.function;
    // Grant write permissions to annual reportings table
    tables.annualReportings.grantReadWriteData(annualReportsCreate.function);
    tables.companies.grantReadData(annualReportsCreate.function);
    buckets.documents.grantReadWrite(annualReportsCreate.function);
    
    const annualReportsGet = new BebcoLambda(this, 'AnnualReportsGet', {
      sourceFunctionName: 'bebco-staging-annual-reports-get-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.annualReportings.tableName, // Override hardcoded DYNAMODB_TABLE
      },
    });
    this.functions.annualReportsGet = annualReportsGet.function;
    // Grant read permissions
    tables.annualReportings.grantReadData(annualReportsGet.function);
    tables.companies.grantReadData(annualReportsGet.function);
    buckets.documents.grantRead(annualReportsGet.function);
    
    const annualReportsList = new BebcoLambda(this, 'AnnualReportsList', {
      sourceFunctionName: 'bebco-staging-annual-reports-list-annual-reports',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.annualReportsList = annualReportsList.function;
    // Grant read, query, and scan permissions for annual reports
    tables.annualReportings.grantReadData(annualReportsList.function);
    tables.companies.grantReadData(annualReportsList.function);
    tables.loans.grantReadData(annualReportsList.function);
    buckets.documents.grantRead(annualReportsList.function);
    annualReportsList.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query', 'dynamodb:Scan'],
      resources: [
        tables.annualReportings.tableArn,
        `${tables.annualReportings.tableArn}/index/*`,
        `${tables.loans.tableArn}/index/*`,
      ],
    }));
    
    const annualReportsUpdate = new BebcoLambda(this, 'AnnualReportsUpdate', {
      sourceFunctionName: 'bebco-staging-annual-reports-update-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.annualReportings.tableName, // Override hardcoded DYNAMODB_TABLE
      },
    });
    this.functions.annualReportsUpdate = annualReportsUpdate.function;
    // Grant write permissions
    tables.annualReportings.grantReadWriteData(annualReportsUpdate.function);
    tables.companies.grantReadData(annualReportsUpdate.function);
    buckets.documents.grantReadWrite(annualReportsUpdate.function);
    
    const annualReportsDelete = new BebcoLambda(this, 'AnnualReportsDelete', {
      sourceFunctionName: 'bebco-staging-annual-reports-delete-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        DYNAMODB_TABLE: tables.annualReportings.tableName, // Override hardcoded DYNAMODB_TABLE
      },
    });
    this.functions.annualReportsDelete = annualReportsDelete.function;
    // Grant write permissions
    tables.annualReportings.grantReadWriteData(annualReportsDelete.function);
    
    // AppSync Resolvers (3 functions)
    const appsyncAnnualReportingDashboard = new BebcoLambda(this, 'AppsyncAnnualReportingDashboard', {
      sourceFunctionName: 'bebco-appsync-annual-reporting-dashboard',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: { ...commonEnv, DESCRIPTION: 'force-update-annual-dashboard' },
    });
    this.functions.appsyncAnnualReportingDashboard = appsyncAnnualReportingDashboard.function;
    
    const appsyncListAnnualReports = new BebcoLambda(this, 'AppsyncListAnnualReports', {
      sourceFunctionName: 'bebco-appsync-list-annual-reports',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: { ...commonEnv, DESCRIPTION: 'force-update-annual-list' },
    });
    this.functions.appsyncListAnnualReports = appsyncListAnnualReports.function;
    
    const appsyncBorrowerAnnualReports = new BebcoLambda(this, 'AppsyncBorrowerAnnualReports', {
      sourceFunctionName: 'bebco-appsync-borrower-annual-reports',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: { ...commonEnv, DESCRIPTION: 'force-update-annual-borrower' },
    });
    this.functions.appsyncBorrowerAnnualReports = appsyncBorrowerAnnualReports.function;

    // Grant environment-specific table access for AppSync annual reporting functions
    [
      appsyncAnnualReportingDashboard.function,
      appsyncListAnnualReports.function,
      appsyncBorrowerAnnualReports.function,
    ].forEach(fn => {
      // Grant table read access
      tables.annualReportings.grantReadData(fn);
      tables.loans.grantReadData(fn);
      tables.companies.grantReadData(fn);
      
      // Grant S3 bucket read access for documents
      buckets.documents.grantRead(fn);
      
      // Grant GSI query and Scan permissions
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:Query', 'dynamodb:Scan'],
        resources: [
          tables.annualReportings.tableArn,
          `${tables.annualReportings.tableArn}/index/*`,
          `${tables.loans.tableArn}/index/*`,
          `${tables.companies.tableArn}/index/*`,
        ],
      }));
    });
    
    // Admin (1 function)
    const adminNotesMonthlyReports = new BebcoLambda(this, 'AdminNotesMonthlyReports', {
      sourceFunctionName: 'bebco-staging-admin-notes-monthly-reports',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.adminNotesMonthlyReports = adminNotesMonthlyReports.function;
    // Grant permissions to read and write monthly reports
    tables.monthlyReportings.grantReadWriteData(adminNotesMonthlyReports.function);
    
    // Monthly Reports Submit (missing function)
    const monthlyReportsSubmit = new BebcoLambda(this, 'MonthlyReportsSubmit', {
      sourceFunctionName: 'bebco-staging-monthly-reports-submit',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadWriteData(monthlyReportsSubmit.function);
    tables.companies.grantReadData(monthlyReportsSubmit.function);
    // Grant permission to query GSIs
    monthlyReportsSubmit.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      resources: [`${tables.monthlyReportings.tableArn}/index/*`],
    }));
    this.functions.monthlyReportsSubmit = monthlyReportsSubmit.function;
    
    new cdk.CfnOutput(this, 'MonthlyReportsCreateArn', {
      value: this.functions.monthlyReportsCreate.functionArn,
    });
  }
}

