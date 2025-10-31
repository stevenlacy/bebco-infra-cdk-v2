import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import { grantReadDataWithQuery, grantReadWriteDataWithQuery } from '../../utils/dynamodb-permissions';

export interface LoansStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class LoansStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: LoansStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    const commonEnv = {
      REGION: this.region,
    };
    
    // Loan operations
    const generateLoanStatements = new BebcoLambda(this, 'GenerateLoanStatements', {
      sourceFunctionName: 'bebco-staging-generate-loan-statements',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadDataWithQuery(generateLoanStatements.function, tables.loans, tables.companies, tables.statements);
    buckets.documents.grantReadWrite(generateLoanStatements.function);
    this.functions.generateLoanStatements = generateLoanStatements.function;
    
    const adminBorrowersLoanSummary = new BebcoLambda(this, 'AdminBorrowersLoanSummary', {
      sourceFunctionName: 'bebco-staging-admin-borrowers-loan-summary-function',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantReadWriteDataWithQuery(adminBorrowersLoanSummary.function, tables.loans);
    grantReadDataWithQuery(adminBorrowersLoanSummary.function, tables.banks, tables.companies);
    this.functions.adminBorrowersLoanSummary = adminBorrowersLoanSummary.function;
    
    const updateLoan = new BebcoLambda(this, 'UpdateLoan', {
      sourceFunctionName: 'bebcoborroweradmin-update-loan-staging',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: {
        ...commonEnv,
        TABLE_NAME: tables.loans.tableName,
      },
    });
    grantReadWriteDataWithQuery(updateLoan.function, tables.loans);
    this.functions.updateLoan = updateLoan.function;
    
    new cdk.CfnOutput(this, 'GenerateLoanStatementsArn', {
      value: this.functions.generateLoanStatements.functionArn,
    });
  }
}

