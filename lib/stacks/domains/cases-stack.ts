import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface CasesStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
}

export class CasesStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: CasesStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    const commonEnv = {
      REGION: this.region,
    };
    
    const casesCreate = new BebcoLambda(this, 'CasesCreate', {
      sourceFunctionName: 'bebco-staging-cases-create',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesCreate = casesCreate.function;
    
    const casesGet = new BebcoLambda(this, 'CasesGet', {
      sourceFunctionName: 'bebco-staging-cases-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesGet = casesGet.function;
    
    const casesList = new BebcoLambda(this, 'CasesList', {
      sourceFunctionName: 'bebco-staging-cases-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesList = casesList.function;
    
    const casesUpdate = new BebcoLambda(this, 'CasesUpdate', {
      sourceFunctionName: 'bebco-staging-cases-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesUpdate = casesUpdate.function;
    
    const casesClose = new BebcoLambda(this, 'CasesClose', {
      sourceFunctionName: 'bebco-staging-cases-close',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesClose = casesClose.function;
    
    const casesDocketVerification = new BebcoLambda(this, 'CasesDocketVerification', {
      sourceFunctionName: 'bebco-staging-cases-docket-verification',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.casesDocketVerification = casesDocketVerification.function;
    
    new cdk.CfnOutput(this, 'CasesCreateArn', {
      value: this.functions.casesCreate.functionArn,
    });
  }
}

