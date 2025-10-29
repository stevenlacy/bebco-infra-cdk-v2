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
    };
    
    // Monthly Reports (6 functions)
    const monthlyReportsCreate = new BebcoLambda(this, 'MonthlyReportsCreate', {
      sourceFunctionName: 'bebco-staging-monthly-reports-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.monthlyReportsCreate = monthlyReportsCreate.function;
    
    const monthlyReportsGet = new BebcoLambda(this, 'MonthlyReportsGet', {
      sourceFunctionName: 'bebco-staging-monthly-reports-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.monthlyReportsGet = monthlyReportsGet.function;
    
    const monthlyReportsList = new BebcoLambda(this, 'MonthlyReportsList', {
      sourceFunctionName: 'bebco-staging-monthly-reports-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.monthlyReportsList = monthlyReportsList.function;
    
    const monthlyReportsUpdate = new BebcoLambda(this, 'MonthlyReportsUpdate', {
      sourceFunctionName: 'bebco-staging-monthly-reports-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
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
      environment: commonEnv,
    });
    this.functions.annualReportsCreate = annualReportsCreate.function;
    
    const annualReportsGet = new BebcoLambda(this, 'AnnualReportsGet', {
      sourceFunctionName: 'bebco-staging-annual-reports-get-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.annualReportsGet = annualReportsGet.function;
    
    const annualReportsList = new BebcoLambda(this, 'AnnualReportsList', {
      sourceFunctionName: 'bebco-staging-annual-reports-list-annual-reports',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.annualReportsList = annualReportsList.function;
    // TEMP: Allow packaged annual-reports list lambda to read legacy-named staging table in this region
    annualReportsList.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:DescribeTable', 'dynamodb:BatchGetItem'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-annual-reportings`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/bebco-borrower-staging-annual-reportings/index/*`,
      ],
    }));
    
    const annualReportsUpdate = new BebcoLambda(this, 'AnnualReportsUpdate', {
      sourceFunctionName: 'bebco-staging-annual-reports-update-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.annualReportsUpdate = annualReportsUpdate.function;
    
    const annualReportsDelete = new BebcoLambda(this, 'AnnualReportsDelete', {
      sourceFunctionName: 'bebco-staging-annual-reports-delete-annual-report',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.annualReportsDelete = annualReportsDelete.function;
    
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

    // TEMP: Cross-region access for legacy staging tables referenced by packaged code (us-east-1)
    const legacyStagingArns = [
      // Tables
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-annual-reportings`,
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-loans`,
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-companies`,
      // Indexes (some scans/queries may target GSIs)
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-annual-reportings/index/*`,
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-loans/index/*`,
      `arn:aws:dynamodb:us-east-1:${this.account}:table/bebco-borrower-staging-companies/index/*`,
    ];
    [
      appsyncAnnualReportingDashboard.function,
      appsyncListAnnualReports.function,
      appsyncBorrowerAnnualReports.function,
    ].forEach(fn => {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:DescribeTable'],
        resources: legacyStagingArns,
      }));
      // Broad backcompat for us-east-1 legacy resources referenced by packaged code
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:DescribeTable'],
        resources: [
          `arn:aws:dynamodb:us-east-1:${this.account}:table/*`,
          `arn:aws:dynamodb:us-east-1:${this.account}:table/*/index/*`,
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
    
    // Monthly Reports Submit (missing function)
    const monthlyReportsSubmit = new BebcoLambda(this, 'MonthlyReportsSubmit', {
      sourceFunctionName: 'bebco-staging-monthly-reports-submit',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.monthlyReportings.grantReadWriteData(monthlyReportsSubmit.function);
    this.functions.monthlyReportsSubmit = monthlyReportsSubmit.function;
    
    new cdk.CfnOutput(this, 'MonthlyReportsCreateArn', {
      value: this.functions.monthlyReportsCreate.functionArn,
    });
  }
}

