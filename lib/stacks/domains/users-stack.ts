import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';
import { BebcoLambda } from '../../constructs/bebco-lambda';

export interface UsersStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  tables: { [key: string]: dynamodb.Table };
  buckets: { [key: string]: s3.IBucket };
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

export class UsersStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.IFunction } = {};
  
  constructor(scope: Construct, id: string, props: UsersStackProps) {
    super(scope, id, props);
    
    const { resourceNames, tables, buckets } = props;
    const baseLambdaProps = {
      resourceNames,
      config: props.config,
      environmentSuffix: props.config.naming.environmentSuffix,
    };
    const sendgridSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SendgridSecret', props.config.integrations.sendgridSecretName);
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
    
    // Common environment variables for user functions
    const commonEnv = {
      REGION: this.region,
      USERS_TABLE: tables.users.tableName,
      OTP_TABLE: tables.otpCodes.tableName,
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
      IDENTITY_POOL_ID: props.identityPoolId,
    };
    
    // Extended env for functions needing more tables/buckets
    const extendedEnv = {
      ...commonEnv,
      ACCOUNTS_TABLE: tables.accounts.tableName,
      FILES_TABLE: tables.files.tableName,
      DOCUMENTS_S3_BUCKET: buckets.documents.bucketName,
      DYNAMODB_TABLE: tables.loanLoc.tableName,
    };
    
    // 1. Users Create
    const usersCreate = new BebcoLambda(this, 'UsersCreate', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-create',
      environment: extendedEnv,
    });
    tables.users.grantReadWriteData(usersCreate.function);
    tables.accounts.grantReadData(usersCreate.function);
    tables.files.grantReadData(usersCreate.function);
    buckets.documents.grantRead(usersCreate.function);
    this.functions.usersCreate = usersCreate.function;
    
    // 2. Users Get
    const usersGet = new BebcoLambda(this, 'UsersGet', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-get',
      environment: extendedEnv,
    });
    tables.users.grantReadData(usersGet.function);
    tables.accounts.grantReadData(usersGet.function);
    tables.files.grantReadData(usersGet.function);
    buckets.documents.grantRead(usersGet.function);
    this.functions.usersGet = usersGet.function;
    
    // 3. Users List
    const usersList = new BebcoLambda(this, 'UsersList', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-list',
      environment: extendedEnv,
    });
    tables.users.grantReadData(usersList.function);
    tables.loanLoc.grantReadData(usersList.function);
    this.functions.usersList = usersList.function;
    
    // 4. Users Update
    const usersUpdate = new BebcoLambda(this, 'UsersUpdate', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-update',
      environment: extendedEnv,
    });
    tables.users.grantReadWriteData(usersUpdate.function);
    tables.accounts.grantReadData(usersUpdate.function);
    this.functions.usersUpdate = usersUpdate.function;
    
    // 5. Users Delete
    const usersDelete = new BebcoLambda(this, 'UsersDelete', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-delete',
      environment: commonEnv,
    });
    tables.users.grantReadWriteData(usersDelete.function);
    tables.otpCodes.grantReadWriteData(usersDelete.function);
    this.functions.usersDelete = usersDelete.function;
    
    // 6. Users Profile
    const usersProfile = new BebcoLambda(this, 'UsersProfile', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-profile',
      environment: extendedEnv,
    });
    tables.users.grantReadData(usersProfile.function);
    this.functions.usersProfile = usersProfile.function;
    
    // 7. Users Send 2FA
    const usersSend2fa = new BebcoLambda(this, 'UsersSend2fa', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-send2fa',
      environment: {
        ...commonEnv,
        ENABLE_SES: 'false',
        SendGrid_Secret: props.config.integrations.sendgridSecretName,
      },
      secrets: [sendgridSecret],
    });
    tables.users.grantReadData(usersSend2fa.function);
    tables.otpCodes.grantReadWriteData(usersSend2fa.function);
    this.functions.usersSend2fa = usersSend2fa.function;
    
    // 8. Users Verify 2FA
    const usersVerify2fa = new BebcoLambda(this, 'UsersVerify2fa', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-verify2fa',
      environment: extendedEnv,
    });
    tables.users.grantReadData(usersVerify2fa.function);
    tables.otpCodes.grantReadWriteData(usersVerify2fa.function);
    this.functions.usersVerify2fa = usersVerify2fa.function;
    
    // 9. Users Password Start
    const usersPasswordStart = new BebcoLambda(this, 'UsersPasswordStart', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-password-start',
      environment: commonEnv,
    });
    tables.users.grantReadData(usersPasswordStart.function);
    this.functions.usersPasswordStart = usersPasswordStart.function;
    
    // 10. Users Password (Change)
    const usersPassword = new BebcoLambda(this, 'UsersPassword', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-password',
      environment: extendedEnv,
    });
    tables.users.grantReadData(usersPassword.function);
    tables.otpCodes.grantReadData(usersPassword.function);
    this.functions.usersPassword = usersPassword.function;
    
    // 11. Users Password Complete
    const usersPasswordComplete = new BebcoLambda(this, 'UsersPasswordComplete', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-users-password-complete',
      environment: commonEnv,
    });
    tables.users.grantReadData(usersPasswordComplete.function);
    this.functions.usersPasswordComplete = usersPasswordComplete.function;
    
    // 12. Auth Check User Status (Staging)
    const authCheckUserStatus = new BebcoLambda(this, 'AuthCheckUserStatus', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-staging-auth-check-user-status',
      environment: commonEnv,
    });
    tables.users.grantReadData(authCheckUserStatus.function);
    this.functions.authCheckUserStatus = authCheckUserStatus.function;
    
    // Admin portal functions (13-21)
    
    // 13. Admin Users Send 2FA
    const adminUsersSend2fa = new BebcoLambda(this, 'AdminUsersSend2fa', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-send2fa',
      environment: {
        ...commonEnv,
        ENABLE_SES: 'false',
        SendGrid_Secret: props.config.integrations.sendgridSecretName,
      },
      secrets: [sendgridSecret],
    });
    tables.users.grantReadData(adminUsersSend2fa.function);
    tables.otpCodes.grantReadWriteData(adminUsersSend2fa.function);
    this.functions.adminUsersSend2fa = adminUsersSend2fa.function;
    
    // 14. Admin Users Verify 2FA
    const adminUsersVerify2fa = new BebcoLambda(this, 'AdminUsersVerify2fa', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-verify2fa',
      environment: commonEnv,
    });
    tables.users.grantReadData(adminUsersVerify2fa.function);
    tables.otpCodes.grantReadWriteData(adminUsersVerify2fa.function);
    this.functions.adminUsersVerify2fa = adminUsersVerify2fa.function;
    
    // 15. Admin Users Change Password
    const adminUsersChangePassword = new BebcoLambda(this, 'AdminUsersChangePassword', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-change-password',
      environment: commonEnv,
    });
    tables.users.grantReadData(adminUsersChangePassword.function);
    this.functions.adminUsersChangePassword = adminUsersChangePassword.function;
    
    // 16. Admin Users Update Name
    const adminUsersUpdateName = new BebcoLambda(this, 'AdminUsersUpdateName', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-update-name',
      environment: commonEnv,
    });
    tables.users.grantReadWriteData(adminUsersUpdateName.function);
    this.functions.adminUsersUpdateName = adminUsersUpdateName.function;
    
    // 17. Admin Auth Check User Status
    const adminAuthCheckUserStatus = new BebcoLambda(this, 'AdminAuthCheckUserStatus', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-auth-check-user-status',
      environment: commonEnv,
    });
    tables.users.grantReadWriteData(adminAuthCheckUserStatus.function);
    grantAdminAuthPermissions(adminAuthCheckUserStatus.function);
    this.functions.adminAuthCheckUserStatus = adminAuthCheckUserStatus.function;
    
    // 18. Admin Users MFA Status
    const adminUsersMfaStatus = new BebcoLambda(this, 'AdminUsersMfaStatus', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-mfa-status',
      environment: commonEnv,
    });
    tables.users.grantReadData(adminUsersMfaStatus.function);
    this.functions.adminUsersMfaStatus = adminUsersMfaStatus.function;
    
    // 19. Admin Users MFA TOTP Begin
    const adminUsersMfaTotpBegin = new BebcoLambda(this, 'AdminUsersMfaTotpBegin', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-mfa-totp-begin',
      environment: {
        REGION: this.region,
        USERS_TABLE: tables.users.tableName,
      },
    });
    tables.users.grantReadWriteData(adminUsersMfaTotpBegin.function);
    this.functions.adminUsersMfaTotpBegin = adminUsersMfaTotpBegin.function;
    
    // 20. Admin Users MFA TOTP Verify
    const adminUsersMfaTotpVerify = new BebcoLambda(this, 'AdminUsersMfaTotpVerify', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-mfa-totp-verify',
      environment: commonEnv,
    });
    tables.users.grantReadData(adminUsersMfaTotpVerify.function);
    this.functions.adminUsersMfaTotpVerify = adminUsersMfaTotpVerify.function;
    
    // 21. Admin Users MFA TOTP Verify Login
    const adminUsersMfaTotpVerifyLogin = new BebcoLambda(this, 'AdminUsersMfaTotpVerifyLogin', {
      ...baseLambdaProps,
      sourceFunctionName: 'bebco-admin-users-mfa-totp-verify-login',
      environment: {
        REGION: this.region,
        USERS_TABLE: tables.users.tableName,
      },
    });
    tables.users.grantReadData(adminUsersMfaTotpVerifyLogin.function);
    this.functions.adminUsersMfaTotpVerifyLogin = adminUsersMfaTotpVerifyLogin.function;
    
    // Stack outputs
    new cdk.CfnOutput(this, 'UsersCreateArn', {
      value: this.functions.usersCreate.functionArn,
      description: 'ARN of the Users Create function',
    });
    
    new cdk.CfnOutput(this, 'UsersGetArn', {
      value: this.functions.usersGet.functionArn,
      description: 'ARN of the Users Get function',
    });
  }
}

