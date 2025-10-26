import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface ExpensesStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
}

export class ExpensesStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};

  constructor(scope: Construct, id: string, props: ExpensesStackProps) {
    super(scope, id, props);

    const { resourceNames, tables } = props;

    const commonEnv = {
      REGION: this.region,
      EXPENSES_TABLE: tables.expenses.tableName,
      COMPANIES_TABLE: tables.companies.tableName,
    };

    // 1. bebco-staging-expenses-create-bulk
    const expensesCreateBulk = new BebcoLambda(this, 'ExpensesCreateBulk', {
      sourceFunctionName: 'bebco-staging-expenses-create-bulk',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.expenses.grantReadWriteData(expensesCreateBulk.function);
    this.functions.expensesCreateBulk = expensesCreateBulk.function;

    // 2. bebco-staging-expenses-get
    const expensesGet = new BebcoLambda(this, 'ExpensesGet', {
      sourceFunctionName: 'bebco-staging-expenses-get',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.expenses.grantReadData(expensesGet.function);
    this.functions.expensesGet = expensesGet.function;

    // 3. bebco-staging-expenses-list
    const expensesList = new BebcoLambda(this, 'ExpensesList', {
      sourceFunctionName: 'bebco-staging-expenses-list',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.expenses.grantReadData(expensesList.function);
    this.functions.expensesList = expensesList.function;

    // 4. bebco-staging-expenses-update
    const expensesUpdate = new BebcoLambda(this, 'ExpensesUpdate', {
      sourceFunctionName: 'bebco-staging-expenses-update',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    tables.expenses.grantReadWriteData(expensesUpdate.function);
    this.functions.expensesUpdate = expensesUpdate.function;
  }
}

