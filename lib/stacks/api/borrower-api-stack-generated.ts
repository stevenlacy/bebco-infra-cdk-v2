import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment-config';
import { ResourceNames } from '../../config/resource-names';

export interface BorrowerApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  userPool: cognito.IUserPool;
}

export class BorrowerApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props: BorrowerApiStackProps) {
    super(scope, id, props);
    
    const { config, resourceNames, userPool } = props;
    
    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: resourceNames.apiGateway('borrowerapi'),
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

    const fn0 = lambda.Function.fromFunctionName(this, 'Fn0', 'bebco-docusign-send_envelope');
    const fn1 = lambda.Function.fromFunctionName(this, 'Fn1', 'bebco-dev-accounts-create');
    const fn2 = lambda.Function.fromFunctionName(this, 'Fn2', 'bebco-dev-accounts-get');
    const fn3 = lambda.Function.fromFunctionName(this, 'Fn3', 'bebco-dev-accounts-list');
    const fn4 = lambda.Function.fromFunctionName(this, 'Fn4', 'bebco-dev-plaid-accounts-preview');
    const fn5 = lambda.Function.fromFunctionName(this, 'Fn5', 'bebco-dev-accounts-upload-statement');
    const fn6 = lambda.Function.fromFunctionName(this, 'Fn6', 'bebco-dev-admin-borrowers-loan-summary-function');
    const fn7 = lambda.Function.fromFunctionName(this, 'Fn7', 'bebco-dev-analyze-documents');
    const fn8 = lambda.Function.fromFunctionName(this, 'Fn8', 'bebco-dev-annual-reports-create-annual-report');
    const fn9 = lambda.Function.fromFunctionName(this, 'Fn9', 'bebco-dev-annual-reports-delete-annual-report');
    const fn10 = lambda.Function.fromFunctionName(this, 'Fn10', 'bebco-dev-annual-reports-get-annual-report');
    const fn11 = lambda.Function.fromFunctionName(this, 'Fn11', 'bebco-dev-annual-reports-list-annual-reports');
    const fn12 = lambda.Function.fromFunctionName(this, 'Fn12', 'bebco-dev-annual-reports-update-annual-report');
    const fn13 = lambda.Function.fromFunctionName(this, 'Fn13', 'bebco-dev-auth-check-user-status');
    const fn14 = lambda.Function.fromFunctionName(this, 'Fn14', 'bebco-dev-auth-complete-setup');
    const fn15 = lambda.Function.fromFunctionName(this, 'Fn15', 'bebco-dev-auth-refresh-token');
    const fn16 = lambda.Function.fromFunctionName(this, 'Fn16', 'bebco-dev-auth-validate-password');
    const fn17 = lambda.Function.fromFunctionName(this, 'Fn17', 'bebco-dev-cases-close');
    const fn18 = lambda.Function.fromFunctionName(this, 'Fn18', 'bebco-dev-cases-create');
    const fn19 = lambda.Function.fromFunctionName(this, 'Fn19', 'bebco-dev-cases-docket-verification');
    const fn20 = lambda.Function.fromFunctionName(this, 'Fn20', 'bebco-dev-cases-get');
    const fn21 = lambda.Function.fromFunctionName(this, 'Fn21', 'bebco-dev-cases-list');
    const fn22 = lambda.Function.fromFunctionName(this, 'Fn22', 'bebco-dev-cases-update');
    const fn23 = lambda.Function.fromFunctionName(this, 'Fn23', 'bebco-dev-draws-approve');
    const fn24 = lambda.Function.fromFunctionName(this, 'Fn24', 'bebco-dev-draws-create');
    const fn25 = lambda.Function.fromFunctionName(this, 'Fn25', 'bebco-dev-draws-get');
    const fn26 = lambda.Function.fromFunctionName(this, 'Fn26', 'bebco-dev-draws-list');
    const fn27 = lambda.Function.fromFunctionName(this, 'Fn27', 'bebco-dev-draws-submit');
    const fn28 = lambda.Function.fromFunctionName(this, 'Fn28', 'bebco-dev-expenses-create-bulk');
    const fn29 = lambda.Function.fromFunctionName(this, 'Fn29', 'bebco-dev-expenses-get');
    const fn30 = lambda.Function.fromFunctionName(this, 'Fn30', 'bebco-dev-expenses-list');
    const fn31 = lambda.Function.fromFunctionName(this, 'Fn31', 'bebco-dev-expenses-update');
    const fn32 = lambda.Function.fromFunctionName(this, 'Fn32', 'bebco-dev-generate-loan-statements');
    const fn33 = lambda.Function.fromFunctionName(this, 'Fn33', 'bebco-dev-invoices-create');
    const fn34 = lambda.Function.fromFunctionName(this, 'Fn34', 'bebco-dev-invoices-generate-monthly');
    const fn35 = lambda.Function.fromFunctionName(this, 'Fn35', 'bebco-dev-invoices-get');
    const fn36 = lambda.Function.fromFunctionName(this, 'Fn36', 'bebco-dev-invoices-list');
    const fn37 = lambda.Function.fromFunctionName(this, 'Fn37', 'bebco-dev-invoices-update');
    const fn38 = lambda.Function.fromFunctionName(this, 'Fn38', 'bebco-dev-monthly-report-sharepoint-upload');
    const fn39 = lambda.Function.fromFunctionName(this, 'Fn39', 'bebco-dev-monthly-reports-create');
    const fn40 = lambda.Function.fromFunctionName(this, 'Fn40', 'bebco-dev-monthly-reports-get');
    const fn41 = lambda.Function.fromFunctionName(this, 'Fn41', 'bebco-dev-monthly-reports-list');
    const fn42 = lambda.Function.fromFunctionName(this, 'Fn42', 'bebco-dev-monthly-reports-submit');
    const fn43 = lambda.Function.fromFunctionName(this, 'Fn43', 'bebco-dev-monthly-reports-update');
    const fn44 = lambda.Function.fromFunctionName(this, 'Fn44', 'bebco-dev-payments-ach-consent-create');
    const fn45 = lambda.Function.fromFunctionName(this, 'Fn45', 'bebco-dev-payments-create');
    const fn46 = lambda.Function.fromFunctionName(this, 'Fn46', 'bebco-dev-payments-get');
    const fn47 = lambda.Function.fromFunctionName(this, 'Fn47', 'bebco-dev-payments-list');
    const fn48 = lambda.Function.fromFunctionName(this, 'Fn48', 'bebco-dev-plaid-accounts-preview');
    const fn49 = lambda.Function.fromFunctionName(this, 'Fn49', 'bebco-dev-plaid-link-token-create');
    const fn50 = lambda.Function.fromFunctionName(this, 'Fn50', 'bebco-dev-plaid-token-exchange');
    const fn51 = lambda.Function.fromFunctionName(this, 'Fn51', 'bebco-dev-plaid-webhook-handler');
    const fn52 = lambda.Function.fromFunctionName(this, 'Fn52', 'bebco-dev-statements-financials');
    const fn53 = lambda.Function.fromFunctionName(this, 'Fn53', 'bebco-dev-statements-get-url');
    const fn54 = lambda.Function.fromFunctionName(this, 'Fn54', 'bebco-dev-users-create');
    const fn55 = lambda.Function.fromFunctionName(this, 'Fn55', 'bebco-dev-users-delete');
    const fn56 = lambda.Function.fromFunctionName(this, 'Fn56', 'bebco-dev-users-get');
    const fn57 = lambda.Function.fromFunctionName(this, 'Fn57', 'bebco-dev-users-list');
    const fn58 = lambda.Function.fromFunctionName(this, 'Fn58', 'bebco-dev-users-password');
    const fn59 = lambda.Function.fromFunctionName(this, 'Fn59', 'bebco-dev-users-profile');
    const fn60 = lambda.Function.fromFunctionName(this, 'Fn60', 'bebco-dev-users-send2fa');
    const fn61 = lambda.Function.fromFunctionName(this, 'Fn61', 'bebco-dev-users-update');
    const fn62 = lambda.Function.fromFunctionName(this, 'Fn62', 'bebco-dev-users-verify2fa');
    const fn63 = lambda.Function.fromFunctionName(this, 'Fn63', 'bebcodev-generate-plaid-monthly-account-statement');

    // API Resources

    const analyze_documents = this.api.root.addResource('analyze-documents');
    const auth = this.api.root.addResource('auth');
    const banks = this.api.root.addResource('banks');
    const generate_account_statements = this.api.root.addResource('generate-account-statements');
    const plaid = this.api.root.addResource('plaid');
    const statements = this.api.root.addResource('statements');
    const auth_check_user_status = auth.addResource('check-user-status');
    const auth_complete_setup = auth.addResource('complete-setup');
    const auth_refresh = auth.addResource('refresh');
    const auth_send_2fa = auth.addResource('send-2fa');
    const auth_validate_password = auth.addResource('validate-password');
    const auth_verify_2fa = auth.addResource('verify-2fa');
    const banks_bankId = banks.addResource('{bankId}');
    const plaid_webhook = plaid.addResource('webhook');
    const statements_financials = statements.addResource('financials');
    const statements_generate = statements.addResource('generate');
    const banks_bankId_borrowers = banks_bankId.addResource('borrowers');
    const banks_bankId_borrowers_borrowerId = banks_bankId_borrowers.addResource('{borrowerId}');
    const banks_bankId_borrowers_borrowerId_accounts = banks_bankId_borrowers_borrowerId.addResource('accounts');
    const banks_bankId_borrowers_borrowerId_ach_consent = banks_bankId_borrowers_borrowerId.addResource('ach-consent');
    const banks_bankId_borrowers_borrowerId_annual_reports = banks_bankId_borrowers_borrowerId.addResource('annual-reports');
    const banks_bankId_borrowers_borrowerId_cases = banks_bankId_borrowers_borrowerId.addResource('cases');
    const banks_bankId_borrowers_borrowerId_change_password = banks_bankId_borrowers_borrowerId.addResource('change-password');
    const banks_bankId_borrowers_borrowerId_docusign = banks_bankId_borrowers_borrowerId.addResource('docusign');
    const banks_bankId_borrowers_borrowerId_draws = banks_bankId_borrowers_borrowerId.addResource('draws');
    const banks_bankId_borrowers_borrowerId_expenses = banks_bankId_borrowers_borrowerId.addResource('expenses');
    const banks_bankId_borrowers_borrowerId_invoices = banks_bankId_borrowers_borrowerId.addResource('invoices');
    const banks_bankId_borrowers_borrowerId_loan_summary = banks_bankId_borrowers_borrowerId.addResource('loan-summary');
    const banks_bankId_borrowers_borrowerId_monthly_reports = banks_bankId_borrowers_borrowerId.addResource('monthly-reports');
    const banks_bankId_borrowers_borrowerId_payments = banks_bankId_borrowers_borrowerId.addResource('payments');
    const banks_bankId_borrowers_borrowerId_plaid = banks_bankId_borrowers_borrowerId.addResource('plaid');
    const banks_bankId_borrowers_borrowerId_profile = banks_bankId_borrowers_borrowerId.addResource('profile');
    const banks_bankId_borrowers_borrowerId_send_2fa_code = banks_bankId_borrowers_borrowerId.addResource('send-2fa-code');
    const banks_bankId_borrowers_borrowerId_statements = banks_bankId_borrowers_borrowerId.addResource('statements');
    const banks_bankId_borrowers_borrowerId_users = banks_bankId_borrowers_borrowerId.addResource('users');
    const banks_bankId_borrowers_borrowerId_verify_2fa_code = banks_bankId_borrowers_borrowerId.addResource('verify-2fa-code');
    const banks_bankId_borrowers_borrowerId_accounts_accountId = banks_bankId_borrowers_borrowerId_accounts.addResource('{accountId}');
    const banks_bankId_borrowers_borrowerId_annual_reports_reportId = banks_bankId_borrowers_borrowerId_annual_reports.addResource('{reportId}');
    const banks_bankId_borrowers_borrowerId_cases_caseId = banks_bankId_borrowers_borrowerId_cases.addResource('{caseId}');
    const banks_bankId_borrowers_borrowerId_docusign_send_envelope = banks_bankId_borrowers_borrowerId_docusign.addResource('send-envelope');
    const banks_bankId_borrowers_borrowerId_draws_drawId = banks_bankId_borrowers_borrowerId_draws.addResource('{drawId}');
    const banks_bankId_borrowers_borrowerId_expenses_expenseId = banks_bankId_borrowers_borrowerId_expenses.addResource('{expenseId}');
    const banks_bankId_borrowers_borrowerId_invoices_generate_monthly = banks_bankId_borrowers_borrowerId_invoices.addResource('generate-monthly');
    const banks_bankId_borrowers_borrowerId_invoices_invoiceId = banks_bankId_borrowers_borrowerId_invoices.addResource('{invoiceId}');
    const banks_bankId_borrowers_borrowerId_monthly_reports_sharepoint_upload = banks_bankId_borrowers_borrowerId_monthly_reports.addResource('sharepoint-upload');
    const banks_bankId_borrowers_borrowerId_monthly_reports_reportId = banks_bankId_borrowers_borrowerId_monthly_reports.addResource('{reportId}');
    const banks_bankId_borrowers_borrowerId_payments_paymentId = banks_bankId_borrowers_borrowerId_payments.addResource('{paymentId}');
    const banks_bankId_borrowers_borrowerId_plaid_accounts = banks_bankId_borrowers_borrowerId_plaid.addResource('accounts');
    const banks_bankId_borrowers_borrowerId_plaid_link_token = banks_bankId_borrowers_borrowerId_plaid.addResource('link-token');
    const banks_bankId_borrowers_borrowerId_plaid_token_exchange = banks_bankId_borrowers_borrowerId_plaid.addResource('token-exchange');
    const banks_bankId_borrowers_borrowerId_statements_statementId = banks_bankId_borrowers_borrowerId_statements.addResource('{statementId}');
    const banks_bankId_borrowers_borrowerId_users_userId = banks_bankId_borrowers_borrowerId_users.addResource('{userId}');
    const banks_bankId_borrowers_borrowerId_accounts_accountId_statements = banks_bankId_borrowers_borrowerId_accounts_accountId.addResource('statements');
    const banks_bankId_borrowers_borrowerId_cases_caseId_close = banks_bankId_borrowers_borrowerId_cases_caseId.addResource('close');
    const banks_bankId_borrowers_borrowerId_cases_caseId_docket_verification = banks_bankId_borrowers_borrowerId_cases_caseId.addResource('docket-verification');
    const banks_bankId_borrowers_borrowerId_cases_caseId_expenses = banks_bankId_borrowers_borrowerId_cases_caseId.addResource('expenses');
    const banks_bankId_borrowers_borrowerId_draws_drawId_approve = banks_bankId_borrowers_borrowerId_draws_drawId.addResource('approve');
    const banks_bankId_borrowers_borrowerId_draws_drawId_submit = banks_bankId_borrowers_borrowerId_draws_drawId.addResource('submit');
    const banks_bankId_borrowers_borrowerId_monthly_reports_reportId_submit = banks_bankId_borrowers_borrowerId_monthly_reports_reportId.addResource('submit');
    const banks_bankId_borrowers_borrowerId_statements_statementId_url = banks_bankId_borrowers_borrowerId_statements_statementId.addResource('url');
    const banks_bankId_borrowers_borrowerId_cases_caseId_expenses_expenseId = banks_bankId_borrowers_borrowerId_cases_caseId_expenses.addResource('{expenseId}');

    // API Methods

    analyze_documents.addMethod('POST', new apigateway.LambdaIntegration(fn7), { authorizer });
    generate_account_statements.addMethod('POST', new apigateway.LambdaIntegration(fn63), { authorizer });
    auth_check_user_status.addMethod('POST', new apigateway.LambdaIntegration(fn13), { authorizer });
    auth_complete_setup.addMethod('POST', new apigateway.LambdaIntegration(fn14), { authorizer });
    auth_refresh.addMethod('POST', new apigateway.LambdaIntegration(fn15), { authorizer });
    auth_send_2fa.addMethod('POST', new apigateway.LambdaIntegration(fn60), { authorizer });
    auth_validate_password.addMethod('POST', new apigateway.LambdaIntegration(fn16), { authorizer });
    auth_verify_2fa.addMethod('POST', new apigateway.LambdaIntegration(fn62), { authorizer });
    plaid_webhook.addMethod('POST', new apigateway.LambdaIntegration(fn51), { authorizer });
    statements_financials.addMethod('GET', new apigateway.LambdaIntegration(fn52), { authorizer });
    statements_financials.addMethod('POST', new apigateway.LambdaIntegration(fn52), { authorizer });
    statements_generate.addMethod('POST', new apigateway.LambdaIntegration(fn32), { authorizer });
    banks_bankId_borrowers_borrowerId_accounts.addMethod('GET', new apigateway.LambdaIntegration(fn3), { authorizer });
    banks_bankId_borrowers_borrowerId_accounts.addMethod('POST', new apigateway.LambdaIntegration(fn1), { authorizer });
    banks_bankId_borrowers_borrowerId_ach_consent.addMethod('GET', new apigateway.LambdaIntegration(fn44), { authorizer });
    banks_bankId_borrowers_borrowerId_ach_consent.addMethod('POST', new apigateway.LambdaIntegration(fn44), { authorizer });
    banks_bankId_borrowers_borrowerId_annual_reports.addMethod('GET', new apigateway.LambdaIntegration(fn11), { authorizer });
    banks_bankId_borrowers_borrowerId_annual_reports.addMethod('POST', new apigateway.LambdaIntegration(fn8), { authorizer });
    banks_bankId_borrowers_borrowerId_cases.addMethod('GET', new apigateway.LambdaIntegration(fn21), { authorizer });
    banks_bankId_borrowers_borrowerId_cases.addMethod('POST', new apigateway.LambdaIntegration(fn18), { authorizer });
    banks_bankId_borrowers_borrowerId_change_password.addMethod('POST', new apigateway.LambdaIntegration(fn58), { authorizer });
    banks_bankId_borrowers_borrowerId_draws.addMethod('GET', new apigateway.LambdaIntegration(fn26), { authorizer });
    banks_bankId_borrowers_borrowerId_draws.addMethod('POST', new apigateway.LambdaIntegration(fn24), { authorizer });
    banks_bankId_borrowers_borrowerId_expenses.addMethod('GET', new apigateway.LambdaIntegration(fn30), { authorizer });
    banks_bankId_borrowers_borrowerId_expenses.addMethod('POST', new apigateway.LambdaIntegration(fn28), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices.addMethod('GET', new apigateway.LambdaIntegration(fn36), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices.addMethod('POST', new apigateway.LambdaIntegration(fn33), { authorizer });
    banks_bankId_borrowers_borrowerId_loan_summary.addMethod('GET', new apigateway.LambdaIntegration(fn6), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports.addMethod('GET', new apigateway.LambdaIntegration(fn41), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports.addMethod('POST', new apigateway.LambdaIntegration(fn39), { authorizer });
    banks_bankId_borrowers_borrowerId_payments.addMethod('GET', new apigateway.LambdaIntegration(fn47), { authorizer });
    banks_bankId_borrowers_borrowerId_payments.addMethod('POST', new apigateway.LambdaIntegration(fn45), { authorizer });
    banks_bankId_borrowers_borrowerId_profile.addMethod('PUT', new apigateway.LambdaIntegration(fn59), { authorizer });
    banks_bankId_borrowers_borrowerId_send_2fa_code.addMethod('POST', new apigateway.LambdaIntegration(fn60), { authorizer });
    banks_bankId_borrowers_borrowerId_users.addMethod('GET', new apigateway.LambdaIntegration(fn57), { authorizer });
    banks_bankId_borrowers_borrowerId_users.addMethod('POST', new apigateway.LambdaIntegration(fn54), { authorizer });
    banks_bankId_borrowers_borrowerId_verify_2fa_code.addMethod('POST', new apigateway.LambdaIntegration(fn62), { authorizer });
    banks_bankId_borrowers_borrowerId_accounts_accountId.addMethod('GET', new apigateway.LambdaIntegration(fn2), { authorizer });
    banks_bankId_borrowers_borrowerId_annual_reports_reportId.addMethod('DELETE', new apigateway.LambdaIntegration(fn9), { authorizer });
    banks_bankId_borrowers_borrowerId_annual_reports_reportId.addMethod('GET', new apigateway.LambdaIntegration(fn10), { authorizer });
    banks_bankId_borrowers_borrowerId_annual_reports_reportId.addMethod('PUT', new apigateway.LambdaIntegration(fn12), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId.addMethod('GET', new apigateway.LambdaIntegration(fn20), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId.addMethod('PUT', new apigateway.LambdaIntegration(fn22), { authorizer });
    banks_bankId_borrowers_borrowerId_docusign_send_envelope.addMethod('POST', new apigateway.LambdaIntegration(fn0), { authorizer });
    banks_bankId_borrowers_borrowerId_draws_drawId.addMethod('GET', new apigateway.LambdaIntegration(fn25), { authorizer });
    banks_bankId_borrowers_borrowerId_expenses_expenseId.addMethod('GET', new apigateway.LambdaIntegration(fn29), { authorizer });
    banks_bankId_borrowers_borrowerId_expenses_expenseId.addMethod('PUT', new apigateway.LambdaIntegration(fn31), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices_generate_monthly.addMethod('POST', new apigateway.LambdaIntegration(fn34), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices_invoiceId.addMethod('GET', new apigateway.LambdaIntegration(fn35), { authorizer });
    banks_bankId_borrowers_borrowerId_invoices_invoiceId.addMethod('PUT', new apigateway.LambdaIntegration(fn37), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports_sharepoint_upload.addMethod('POST', new apigateway.LambdaIntegration(fn38), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports_reportId.addMethod('GET', new apigateway.LambdaIntegration(fn40), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports_reportId.addMethod('PUT', new apigateway.LambdaIntegration(fn43), { authorizer });
    banks_bankId_borrowers_borrowerId_payments_paymentId.addMethod('GET', new apigateway.LambdaIntegration(fn46), { authorizer });
    banks_bankId_borrowers_borrowerId_plaid_accounts.addMethod('GET', new apigateway.LambdaIntegration(fn4), { authorizer });
    banks_bankId_borrowers_borrowerId_plaid_accounts.addMethod('POST', new apigateway.LambdaIntegration(fn48), { authorizer });
    banks_bankId_borrowers_borrowerId_plaid_link_token.addMethod('POST', new apigateway.LambdaIntegration(fn49), { authorizer });
    banks_bankId_borrowers_borrowerId_plaid_token_exchange.addMethod('POST', new apigateway.LambdaIntegration(fn50), { authorizer });
    banks_bankId_borrowers_borrowerId_users_userId.addMethod('DELETE', new apigateway.LambdaIntegration(fn55), { authorizer });
    banks_bankId_borrowers_borrowerId_users_userId.addMethod('GET', new apigateway.LambdaIntegration(fn56), { authorizer });
    banks_bankId_borrowers_borrowerId_users_userId.addMethod('PUT', new apigateway.LambdaIntegration(fn61), { authorizer });
    banks_bankId_borrowers_borrowerId_accounts_accountId_statements.addMethod('POST', new apigateway.LambdaIntegration(fn5), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_close.addMethod('POST', new apigateway.LambdaIntegration(fn17), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_docket_verification.addMethod('GET', new apigateway.LambdaIntegration(fn19), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_expenses.addMethod('GET', new apigateway.LambdaIntegration(fn30), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_expenses.addMethod('POST', new apigateway.LambdaIntegration(fn28), { authorizer });
    banks_bankId_borrowers_borrowerId_draws_drawId_approve.addMethod('PUT', new apigateway.LambdaIntegration(fn23), { authorizer });
    banks_bankId_borrowers_borrowerId_draws_drawId_submit.addMethod('PUT', new apigateway.LambdaIntegration(fn27), { authorizer });
    banks_bankId_borrowers_borrowerId_monthly_reports_reportId_submit.addMethod('PUT', new apigateway.LambdaIntegration(fn42), { authorizer });
    banks_bankId_borrowers_borrowerId_statements_statementId_url.addMethod('GET', new apigateway.LambdaIntegration(fn53), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_expenses_expenseId.addMethod('GET', new apigateway.LambdaIntegration(fn29), { authorizer });
    banks_bankId_borrowers_borrowerId_cases_caseId_expenses_expenseId.addMethod('PUT', new apigateway.LambdaIntegration(fn31), { authorizer });

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
