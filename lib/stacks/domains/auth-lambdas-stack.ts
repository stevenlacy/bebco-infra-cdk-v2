import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AuthLambdasStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

export class AuthLambdasStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: AuthLambdasStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables } = props;
    
    const commonEnv = {
      REGION: this.region,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
      IDENTITY_POOL_ID: props.identityPoolId,
    };
    const stack = cdk.Stack.of(this);
    const cognitoUserPoolArn = stack.formatArn({
      service: 'cognito-idp',
      resource: 'userpool',
      resourceName: props.userPoolId,
    });
    const usersTableArn = tables.users.tableArn;
    const grantAdminAuthPermissions = (fn: lambda.IFunction) => {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:ListUsers',
        ],
        resources: [cognitoUserPoolArn],
      }));
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Scan',
          'dynamodb:Query',
        ],
        resources: [usersTableArn],
      }));
    };
    
    // Borrower Portal Auth
    const authCompleteSetup = new BebcoLambda(this, 'AuthCompleteSetup', {
      sourceFunctionName: 'bebco-staging-auth-complete-setup',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.authCompleteSetup = authCompleteSetup.function;
    
    const authRefreshToken = new BebcoLambda(this, 'AuthRefreshToken', {
      sourceFunctionName: 'bebco-staging-auth-refresh-token',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.authRefreshToken = authRefreshToken.function;
    
    const authValidatePassword = new BebcoLambda(this, 'AuthValidatePassword', {
      sourceFunctionName: 'bebco-staging-auth-validate-password',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    this.functions.authValidatePassword = authValidatePassword.function;
    
    // Admin Portal Auth
    const adminAuthCompleteSetup = new BebcoLambda(this, 'AdminAuthCompleteSetup', {
      sourceFunctionName: 'bebco-admin-auth-complete-setup',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantAdminAuthPermissions(adminAuthCompleteSetup.function);
    this.functions.adminAuthCompleteSetup = adminAuthCompleteSetup.function;
    
    const adminAuthRefreshToken = new BebcoLambda(this, 'AdminAuthRefreshToken', {
      sourceFunctionName: 'bebco-admin-auth-refresh-token',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantAdminAuthPermissions(adminAuthRefreshToken.function);
    this.functions.adminAuthRefreshToken = adminAuthRefreshToken.function;
    
    const adminAuthValidatePassword = new BebcoLambda(this, 'AdminAuthValidatePassword', {
      sourceFunctionName: 'bebco-admin-auth-validate-password',
      resourceNames,
      environmentSuffix: props.config.naming.environmentSuffix,
      environment: commonEnv,
    });
    grantAdminAuthPermissions(adminAuthValidatePassword.function);
    this.functions.adminAuthValidatePassword = adminAuthValidatePassword.function;
    
    new cdk.CfnOutput(this, 'AuthCompleteSetupArn', {
      value: this.functions.authCompleteSetup.functionArn,
    });
  }
}

