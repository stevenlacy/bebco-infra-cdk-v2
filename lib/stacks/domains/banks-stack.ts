import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface BanksStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
}

export class BanksStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: BanksStackProps) {
    super(scope, id, props);

    const { resourceNames, tables } = props;

    const commonEnv = {
      REGION: this.region,
      BANKS_TABLE: tables.banks.tableName,
    };

    // 1. bebco-staging-banks-create
    const banksCreate = new BebcoLambda(this, 'BanksCreate', {
      sourceFunctionName: 'bebco-staging-banks-create',
      resourceNames,
      environment: commonEnv,
    });
    tables.banks.grantReadWriteData(banksCreate.function);
    this.functions.banksCreate = banksCreate.function;

    // 2. bebco-staging-banks-list
    const banksList = new BebcoLambda(this, 'BanksList', {
      sourceFunctionName: 'bebco-staging-banks-list',
      resourceNames,
      environment: commonEnv,
    });
    tables.banks.grantReadData(banksList.function);
    this.functions.banksList = banksList.function;

    // 3. bebco-staging-banks-update
    const banksUpdate = new BebcoLambda(this, 'BanksUpdate', {
      sourceFunctionName: 'bebco-staging-banks-update',
      resourceNames,
      environment: commonEnv,
    });
    tables.banks.grantReadWriteData(banksUpdate.function);
    this.functions.banksUpdate = banksUpdate.function;
  }
}

