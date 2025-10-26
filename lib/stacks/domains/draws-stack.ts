import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface DrawsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

export class DrawsStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: DrawsStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    
    // Common environment variables for draw functions
    const commonEnv = {
      REGION: this.region,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
      IDENTITY_POOL_ID: props.identityPoolId,
    };
    
    // 1. Draws Create
    const drawsCreate = new BebcoLambda(this, 'DrawsCreate', {
      sourceFunctionName: 'bebco-staging-draws-create',
      resourceNames,
      environment: commonEnv,
    });
    // Grant permissions as needed
    this.functions.drawsCreate = drawsCreate.function;
    
    // 2. Draws Get
    const drawsGet = new BebcoLambda(this, 'DrawsGet', {
      sourceFunctionName: 'bebco-staging-draws-get',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsGet = drawsGet.function;
    
    // 3. Draws List
    const drawsList = new BebcoLambda(this, 'DrawsList', {
      sourceFunctionName: 'bebco-staging-draws-list',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsList = drawsList.function;
    
    // 4. Draws Approve
    const drawsApprove = new BebcoLambda(this, 'DrawsApprove', {
      sourceFunctionName: 'bebco-staging-draws-approve',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsApprove = drawsApprove.function;
    
    // 5. Draws Reject
    const drawsReject = new BebcoLambda(this, 'DrawsReject', {
      sourceFunctionName: 'bebco-staging-draws-reject',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsReject = drawsReject.function;
    
    // 6. Draws Submit
    const drawsSubmit = new BebcoLambda(this, 'DrawsSubmit', {
      sourceFunctionName: 'bebco-staging-draws-submit',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsSubmit = drawsSubmit.function;
    
    // 7. Draws Fund
    const drawsFund = new BebcoLambda(this, 'DrawsFund', {
      sourceFunctionName: 'bebco-staging-draws-fund',
      resourceNames,
      environment: commonEnv,
    });
    this.functions.drawsFund = drawsFund.function;
    
    // Stack outputs
    new cdk.CfnOutput(this, 'DrawsCreateArn', {
      value: this.functions.drawsCreate.functionArn,
      description: 'ARN of the Draws Create function',
    });
  }
}

