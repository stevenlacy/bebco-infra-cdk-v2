import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';

export interface AdminApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}

export class AdminApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props: AdminApiStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool } = props;
    
    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: resourceNames.apiGateway('adminapi'),
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      cloudWatchRole: true,
    });
    
    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    
    // Lambda functions

    const fn0 = lambda.Function.fromFunctionName(this, 'Fn0', 'bebco-admin-users-change-password');
    const fn1 = lambda.Function.fromFunctionName(this, 'Fn1', 'bebco-admin-users-mfa-status');
    const fn2 = lambda.Function.fromFunctionName(this, 'Fn2', 'bebco-admin-users-mfa-totp-begin');
    const fn3 = lambda.Function.fromFunctionName(this, 'Fn3', 'bebco-admin-users-mfa-totp-verify');
    const fn4 = lambda.Function.fromFunctionName(this, 'Fn4', 'bebco-admin-users-mfa-totp-verify-login');
    const fn5 = lambda.Function.fromFunctionName(this, 'Fn5', 'bebco-admin-users-update-name');
    const fn6 = lambda.Function.fromFunctionName(this, 'Fn6', 'bebco-borrower-dev-admin-account-statements-download');
    const fn7 = lambda.Function.fromFunctionName(this, 'Fn7', 'bebco-borrower-dev-admin-nacha-download');
    const fn8 = lambda.Function.fromFunctionName(this, 'Fn8', 'bebco-borrower-dev-payments-update');
    const fn9 = lambda.Function.fromFunctionName(this, 'Fn9', 'bebco-dev-account-transaction-counts');
    const fn10 = lambda.Function.fromFunctionName(this, 'Fn10', 'bebco-dev-admin-borrower-settings');
    const fn11 = lambda.Function.fromFunctionName(this, 'Fn11', 'bebco-dev-admin-borrowers-create-borrower-function');
    const fn12 = lambda.Function.fromFunctionName(this, 'Fn12', 'bebco-dev-admin-borrowers-get-borrower-function');
    const fn13 = lambda.Function.fromFunctionName(this, 'Fn13', 'bebco-dev-admin-borrowers-get-borrower-summary-function');
    const fn14 = lambda.Function.fromFunctionName(this, 'Fn14', 'bebco-dev-admin-borrowers-get-borrower-transactions-function');
    const fn15 = lambda.Function.fromFunctionName(this, 'Fn15', 'bebco-dev-admin-borrowers-list-borrowers-function');
    const fn16 = lambda.Function.fromFunctionName(this, 'Fn16', 'bebco-dev-admin-borrowers-loan-summary-function');
    const fn17 = lambda.Function.fromFunctionName(this, 'Fn17', 'bebco-dev-admin-borrowers-update-borrower-function');
    const fn18 = lambda.Function.fromFunctionName(this, 'Fn18', 'bebco-dev-admin-list-statements');
    const fn19 = lambda.Function.fromFunctionName(this, 'Fn19', 'bebco-dev-admin-notes-monthly-reports');
    const fn20 = lambda.Function.fromFunctionName(this, 'Fn20', 'bebco-dev-admin-payments-waive');
    const fn21 = lambda.Function.fromFunctionName(this, 'Fn21', 'bebco-dev-admin-upload-statements');
    const fn22 = lambda.Function.fromFunctionName(this, 'Fn22', 'bebco-dev-analyze-documents');
    const fn23 = lambda.Function.fromFunctionName(this, 'Fn23', 'bebco-dev-annual-reports-create-annual-report');
    const fn24 = lambda.Function.fromFunctionName(this, 'Fn24', 'bebco-dev-annual-reports-delete-annual-report');
    const fn25 = lambda.Function.fromFunctionName(this, 'Fn25', 'bebco-dev-annual-reports-list-annual-reports');
    const fn26 = lambda.Function.fromFunctionName(this, 'Fn26', 'bebco-dev-annual-reports-update-annual-report');
    const fn27 = lambda.Function.fromFunctionName(this, 'Fn27', 'bebco-dev-cases-create');
    const fn28 = lambda.Function.fromFunctionName(this, 'Fn28', 'bebco-dev-cases-list');
    const fn29 = lambda.Function.fromFunctionName(this, 'Fn29', 'bebco-dev-cases-update');
    const fn30 = lambda.Function.fromFunctionName(this, 'Fn30', 'bebco-dev-draws-list');
    const fn31 = lambda.Function.fromFunctionName(this, 'Fn31', 'bebco-dev-invoices-create');
    const fn32 = lambda.Function.fromFunctionName(this, 'Fn32', 'bebco-dev-invoices-list');
    const fn33 = lambda.Function.fromFunctionName(this, 'Fn33', 'bebco-dev-payments-ach-batches');
    const fn34 = lambda.Function.fromFunctionName(this, 'Fn34', 'bebco-dev-plaid-account-transactions');
    const fn35 = lambda.Function.fromFunctionName(this, 'Fn35', 'bebco-dev-plaid-transactions-sync');
    const fn36 = lambda.Function.fromFunctionName(this, 'Fn36', 'bebco-dev-users-create');
    const fn37 = lambda.Function.fromFunctionName(this, 'Fn37', 'bebco-dev-users-list');
    const fn38 = lambda.Function.fromFunctionName(this, 'Fn38', 'bebco-dev-users-password-complete');
    const fn39 = lambda.Function.fromFunctionName(this, 'Fn39', 'bebco-dev-users-password-start');
    const fn40 = lambda.Function.fromFunctionName(this, 'Fn40', 'bebco-dev-users-send2fa');
    const fn41 = lambda.Function.fromFunctionName(this, 'Fn41', 'bebco-dev-users-verify2fa');
    const fn42 = lambda.Function.fromFunctionName(this, 'Fn42', 'bebcoborroweradmin-known-accounts-dev');
    const fn43 = lambda.Function.fromFunctionName(this, 'Fn43', 'bebcoborroweradmin-update-loan-dev');

    // API Resources

    const admin = this.api.root.addResource('admin');
    const auth = this.api.root.addResource('auth');
    const banks = this.api.root.addResource('banks');
    const profile = this.api.root.addResource('profile');
    const admin_accounts = admin.addResource('accounts');
    const admin_analyze_documents = admin.addResource('analyze-documents');
    const admin_annual_reports = admin.addResource('annual-reports');
    const admin_borrowers = admin.addResource('borrowers');
    const admin_companies = admin.addResource('companies');
    const admin_invoices = admin.addResource('invoices');
    const admin_monthly_reports = admin.addResource('monthly-reports');
    const admin_payments = admin.addResource('payments');
    const admin_plaid = admin.addResource('plaid');
    const admin_statements = admin.addResource('statements');
    const admin_users = admin.addResource('users');
    const auth_password = auth.addResource('password');
    const banks_bankId = banks.addResource('{bankId}');
    const profile_mfa = profile.addResource('mfa');
    const profile_name = profile.addResource('name');
    const profile_password = profile.addResource('password');
    const admin_accounts_transaction_counts = admin_accounts.addResource('transaction-counts');
    const admin_accounts_accountId = admin_accounts.addResource('{accountId}');
    const admin_annual_reports_reportId = admin_annual_reports.addResource('{reportId}');
    const admin_borrowers_summary = admin_borrowers.addResource('summary');
    const admin_borrowers_borrower_id = admin_borrowers.addResource('{borrower_id}');
    const admin_companies_companyId = admin_companies.addResource('{companyId}');
    const admin_monthly_reports_reportId = admin_monthly_reports.addResource('{reportId}');
    const admin_payments_nacha = admin_payments.addResource('nacha');
    const admin_payments_process_batch = admin_payments.addResource('process-batch');
    const admin_payments_paymentId = admin_payments.addResource('{paymentId}');
    const admin_plaid_sync = admin_plaid.addResource('sync');
    const admin_statements_download = admin_statements.addResource('download');
    const admin_statements_upload = admin_statements.addResource('upload');
    const admin_users_userId = admin_users.addResource('{userId}');
    const auth_password_send_code = auth_password.addResource('send-code');
    const auth_password_verify_code = auth_password.addResource('verify-code');
    const banks_bankId_borrowers = banks_bankId.addResource('borrowers');
    const banks_bankId_draws = banks_bankId.addResource('draws');
    const profile_mfa_status = profile_mfa.addResource('status');
    const profile_mfa_totp = profile_mfa.addResource('totp');
    const admin_accounts_accountId_sync = admin_accounts_accountId.addResource('sync');
    const admin_borrowers_borrower_id_transactions = admin_borrowers_borrower_id.addResource('transactions');
    const admin_companies_companyId_cases = admin_companies_companyId.addResource('cases');
    const admin_companies_companyId_known_accounts = admin_companies_companyId.addResource('known-accounts');
    const admin_companies_companyId_loans = admin_companies_companyId.addResource('loans');
    const admin_companies_companyId_settings = admin_companies_companyId.addResource('settings');
    const admin_companies_companyId_statements = admin_companies_companyId.addResource('statements');
    const admin_companies_companyId_users = admin_companies_companyId.addResource('users');
    const admin_monthly_reports_reportId_notes = admin_monthly_reports_reportId.addResource('notes');
    const admin_monthly_reports_reportId_waive = admin_monthly_reports_reportId.addResource('waive');
    const admin_payments_nacha_latest = admin_payments_nacha.addResource('latest');
    const admin_payments_nacha_batch_id = admin_payments_nacha.addResource('{batch_id}');
    const admin_payments_paymentId_allocations = admin_payments_paymentId.addResource('allocations');
    const admin_users_userId_approve = admin_users_userId.addResource('approve');
    const admin_users_userId_deny = admin_users_userId.addResource('deny');
    const admin_users_userId_password = admin_users_userId.addResource('password');
    const banks_bankId_borrowers_borrowerId = banks_bankId_borrowers.addResource('{borrowerId}');
    const banks_bankId_draws_drawId = banks_bankId_draws.addResource('{drawId}');
    const profile_mfa_totp_begin = profile_mfa_totp.addResource('begin');
    const profile_mfa_totp_verify = profile_mfa_totp.addResource('verify');
    const profile_mfa_totp_verify_login = profile_mfa_totp.addResource('verify-login');
    const admin_companies_companyId_cases_key = admin_companies_companyId_cases.addResource('key');
    const admin_companies_companyId_known_accounts_accountId = admin_companies_companyId_known_accounts.addResource('{accountId}');
    const admin_companies_companyId_loans_loanNo = admin_companies_companyId_loans.addResource('{loanNo}');
    const admin_companies_companyId_users_userId = admin_companies_companyId_users.addResource('{userId}');
    const admin_payments_nacha_batch_id_download = admin_payments_nacha_batch_id.addResource('download');
    const admin_users_userId_password_complete = admin_users_userId_password.addResource('complete');
    const admin_users_userId_password_start = admin_users_userId_password.addResource('start');
    const banks_bankId_borrowers_borrowerId_accounts = banks_bankId_borrowers_borrowerId.addResource('accounts');
    const banks_bankId_borrowers_borrowerId_invoices = banks_bankId_borrowers_borrowerId.addResource('invoices');
    const banks_bankId_borrowers_borrowerId_users = banks_bankId_borrowers_borrowerId.addResource('users');
    const banks_bankId_draws_drawId_approve = banks_bankId_draws_drawId.addResource('approve');
    const banks_bankId_draws_drawId_reject = banks_bankId_draws_drawId.addResource('reject');
    const banks_bankId_draws_drawId_return_to_pending = banks_bankId_draws_drawId.addResource('return-to-pending');
    const admin_companies_companyId_loans_loanNo_summary = admin_companies_companyId_loans_loanNo.addResource('summary');
    const admin_companies_companyId_users_userId_approve = admin_companies_companyId_users_userId.addResource('approve');
    const banks_bankId_borrowers_borrowerId_accounts_accountId = banks_bankId_borrowers_borrowerId_accounts.addResource('{accountId}');
    const banks_bankId_borrowers_borrowerId_accounts_accountId_transactions = banks_bankId_borrowers_borrowerId_accounts_accountId.addResource('transactions');

    // API Methods

    admin_analyze_documents.addMethod('POST', new apigateway.LambdaIntegration(fn22), { authorizer });
    admin_annual_reports.addMethod('GET', new apigateway.LambdaIntegration(fn25), { authorizer });
    admin_annual_reports.addMethod('POST', new apigateway.LambdaIntegration(fn23), { authorizer });
    admin_borrowers.addMethod('GET', new apigateway.LambdaIntegration(fn15), { authorizer });
    admin_borrowers.addMethod('POST', new apigateway.LambdaIntegration(fn11), { authorizer });
    admin_invoices.addMethod('GET', new apigateway.LambdaIntegration(fn32), { authorizer });
    admin_payments.addMethod('GET', new apigateway.LambdaIntegration(fn8), { authorizer });
    admin_users.addMethod('GET', new apigateway.LambdaIntegration(fn36), { authorizer });
    admin_users.addMethod('POST', new apigateway.LambdaIntegration(fn36), { authorizer });
    profile_name.addMethod('PATCH', new apigateway.LambdaIntegration(fn5), { authorizer });
    profile_password.addMethod('POST', new apigateway.LambdaIntegration(fn0), { authorizer });
    admin_accounts_transaction_counts.addMethod('POST', new apigateway.LambdaIntegration(fn9), { authorizer });
    admin_annual_reports_reportId.addMethod('DELETE', new apigateway.LambdaIntegration(fn24), { authorizer });
    admin_annual_reports_reportId.addMethod('PUT', new apigateway.LambdaIntegration(fn26), { authorizer });
    admin_borrowers_summary.addMethod('GET', new apigateway.LambdaIntegration(fn13), { authorizer });
    admin_borrowers_borrower_id.addMethod('GET', new apigateway.LambdaIntegration(fn12), { authorizer });
    admin_borrowers_borrower_id.addMethod('PUT', new apigateway.LambdaIntegration(fn17), { authorizer });
    admin_payments_process_batch.addMethod('POST', new apigateway.LambdaIntegration(fn33), { authorizer });
    admin_payments_paymentId.addMethod('PUT', new apigateway.LambdaIntegration(fn33), { authorizer });
    admin_plaid_sync.addMethod('POST', new apigateway.LambdaIntegration(fn35), { authorizer });
    admin_statements_download.addMethod('POST', new apigateway.LambdaIntegration(fn6), { authorizer });
    admin_statements_upload.addMethod('POST', new apigateway.LambdaIntegration(fn21), { authorizer });
    admin_users_userId.addMethod('DELETE', new apigateway.LambdaIntegration(fn36), { authorizer });
    auth_password_send_code.addMethod('POST', new apigateway.LambdaIntegration(fn40), { authorizer });
    auth_password_verify_code.addMethod('POST', new apigateway.LambdaIntegration(fn41), { authorizer });
    banks_bankId_draws.addMethod('GET', new apigateway.LambdaIntegration(fn30), { authorizer });
    profile_mfa_status.addMethod('GET', new apigateway.LambdaIntegration(fn1), { authorizer });
    admin_accounts_accountId_sync.addMethod('POST', new apigateway.LambdaIntegration(fn35), { authorizer });
    admin_borrowers_borrower_id_transactions.addMethod('GET', new apigateway.LambdaIntegration(fn14), { authorizer });
    admin_companies_companyId_cases.addMethod('GET', new apigateway.LambdaIntegration(fn28), { authorizer });
    admin_companies_companyId_cases.addMethod('POST', new apigateway.LambdaIntegration(fn27), { authorizer });
    admin_companies_companyId_known_accounts.addMethod('GET', new apigateway.LambdaIntegration(fn42), { authorizer });
    admin_companies_companyId_known_accounts.addMethod('POST', new apigateway.LambdaIntegration(fn42), { authorizer });
    admin_companies_companyId_settings.addMethod('GET', new apigateway.LambdaIntegration(fn10), { authorizer });
    admin_companies_companyId_settings.addMethod('PUT', new apigateway.LambdaIntegration(fn17), { authorizer });
    admin_companies_companyId_statements.addMethod('GET', new apigateway.LambdaIntegration(fn18), { authorizer });
    admin_companies_companyId_users.addMethod('GET', new apigateway.LambdaIntegration(fn37), { authorizer });
    admin_monthly_reports_reportId_notes.addMethod('DELETE', new apigateway.LambdaIntegration(fn19), { authorizer });
    admin_monthly_reports_reportId_notes.addMethod('GET', new apigateway.LambdaIntegration(fn19), { authorizer });
    admin_monthly_reports_reportId_notes.addMethod('POST', new apigateway.LambdaIntegration(fn19), { authorizer });
    admin_monthly_reports_reportId_waive.addMethod('GET', new apigateway.LambdaIntegration(fn20), { authorizer });
    admin_monthly_reports_reportId_waive.addMethod('POST', new apigateway.LambdaIntegration(fn20), { authorizer });
    admin_payments_nacha_latest.addMethod('GET', new apigateway.LambdaIntegration(fn7), { authorizer });
    admin_payments_paymentId_allocations.addMethod('GET', new apigateway.LambdaIntegration(fn8), { authorizer });
    admin_payments_paymentId_allocations.addMethod('PUT', new apigateway.LambdaIntegration(fn8), { authorizer });
    admin_users_userId_approve.addMethod('PUT', new apigateway.LambdaIntegration(fn36), { authorizer });
    admin_users_userId_deny.addMethod('PUT', new apigateway.LambdaIntegration(fn36), { authorizer });
    profile_mfa_totp_begin.addMethod('POST', new apigateway.LambdaIntegration(fn2), { authorizer });
    profile_mfa_totp_verify.addMethod('POST', new apigateway.LambdaIntegration(fn3), { authorizer });
    profile_mfa_totp_verify_login.addMethod('POST', new apigateway.LambdaIntegration(fn4), { authorizer });
    admin_companies_companyId_cases_key.addMethod('POST', new apigateway.LambdaIntegration(fn29), { authorizer });
    admin_companies_companyId_known_accounts_accountId.addMethod('DELETE', new apigateway.LambdaIntegration(fn42), { authorizer });
    admin_companies_companyId_known_accounts_accountId.addMethod('GET', new apigateway.LambdaIntegration(fn42), { authorizer });
    admin_companies_companyId_known_accounts_accountId.addMethod('PUT', new apigateway.LambdaIntegration(fn42), { authorizer });
    admin_companies_companyId_loans_loanNo.addMethod('GET', new apigateway.LambdaIntegration(fn43), { authorizer });
    admin_companies_companyId_loans_loanNo.addMethod('PUT', new apigateway.LambdaIntegration(fn43), { authorizer });
    admin_payments_nacha_batch_id_download.addMethod('GET', new apigateway.LambdaIntegration(fn7), { authorizer });
    admin_users_userId_password_complete.addMethod('POST', new apigateway.LambdaIntegration(fn38), { authorizer });
    admin_users_userId_password_start.addMethod('POST', new apigateway.LambdaIntegration(fn39), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices.addMethod('POST', new apigateway.LambdaIntegration(fn31), { authorizer });
    banks_bankId_borrowers_borrowerId_users.addMethod('POST', new apigateway.LambdaIntegration(fn36), { authorizer });
    banks_bankId_draws_drawId_approve.addMethod('PUT', new apigateway.LambdaIntegration(fn30), { authorizer });
    banks_bankId_draws_drawId_reject.addMethod('PUT', new apigateway.LambdaIntegration(fn30), { authorizer });
    banks_bankId_draws_drawId_return_to_pending.addMethod('PUT', new apigateway.LambdaIntegration(fn30), { authorizer });
    admin_companies_companyId_loans_loanNo_summary.addMethod('GET', new apigateway.LambdaIntegration(fn16), { authorizer });
    admin_companies_companyId_loans_loanNo_summary.addMethod('PUT', new apigateway.LambdaIntegration(fn16), { authorizer });
    admin_companies_companyId_users_userId_approve.addMethod('PUT', new apigateway.LambdaIntegration(fn36), { authorizer });
    banks_bankId_borrowers_borrowerId_accounts_accountId_transactions.addMethod('GET', new apigateway.LambdaIntegration(fn34), { authorizer });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API endpoint URL',
    });
    
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
    });
    
    // Add tags
    cdk.Tags.of(this).add('Project', 'bebco');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK-v2');
  }
}
