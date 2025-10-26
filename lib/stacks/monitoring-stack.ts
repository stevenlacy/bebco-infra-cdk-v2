import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ResourceNames } from '../config/resource-names';

interface MonitoringStackProps extends cdk.StackProps {
  config: any;
  resourceNames: ResourceNames;
  lambdaFunctions: { [key: string]: lambda.IFunction };
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config, resourceNames, lambdaFunctions } = props;

    // ============================================================
    // LAMBDA LOG GROUPS
    // ============================================================
    // Lambda functions automatically create log groups, but we can
    // set retention policies for critical functions
    
    const criticalFunctions = [
      'lambda-backup-function',
      'plaid-daily-sync',
      'monthly-reports-scheduler',
      'payments-ach-batches',
    ];

    criticalFunctions.forEach((funcKey) => {
      const func = lambdaFunctions[funcKey];
      if (func) {
        new logs.LogGroup(this, `${funcKey}LogGroup`, {
          logGroupName: `/aws/lambda/${func.functionName}`,
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
      }
    });

    // ============================================================
    // CLOUDWATCH ALARMS
    // ============================================================

    // 1. Lambda Backup Function - Duration Alarm
    if (lambdaFunctions['lambda-backup-function']) {
      const backupFunc = lambdaFunctions['lambda-backup-function'];
      
      new cloudwatch.Alarm(this, 'LambdaBackupDurationAlarm', {
        alarmName: 'bebco-lambda-backup-function-duration',
        alarmDescription: 'Alert when Lambda backup function duration exceeds threshold',
        metric: backupFunc.metricDuration({
          statistic: 'Average',
        }),
        threshold: 300000, // 5 minutes in milliseconds
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // 2. Lambda Backup Function - Errors Alarm
      new cloudwatch.Alarm(this, 'LambdaBackupErrorsAlarm', {
        alarmName: 'bebco-lambda-backup-function-errors',
        alarmDescription: 'Alert when Lambda backup function has errors',
        metric: backupFunc.metricErrors({
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    const dashboard = new cloudwatch.Dashboard(this, 'BebcoDashboard', {
      dashboardName: `${config.naming.prefix}-${config.naming.environmentSuffix}-overview`,
    });

    // Add Lambda metrics
    const lambdaWidgets: cloudwatch.IWidget[] = [];
    
    // Group Lambda functions by domain for better organization
    const domains = [
      { name: 'Plaid', functions: ['plaid-link-token-create', 'plaid-webhook-handler', 'plaid-daily-sync'] },
      { name: 'Payments', functions: ['payments-create', 'payments-ach-batches'] },
      { name: 'Users', functions: ['users-create', 'users-list', 'users-update'] },
    ];

    domains.forEach((domain) => {
      const metrics: cloudwatch.IMetric[] = [];
      
      domain.functions.forEach((funcKey) => {
        const func = lambdaFunctions[funcKey];
        if (func) {
          metrics.push(func.metricInvocations({ label: funcKey, statistic: 'Sum' }));
        }
      });

      if (metrics.length > 0) {
        lambdaWidgets.push(
          new cloudwatch.GraphWidget({
            title: `${domain.name} - Lambda Invocations`,
            left: metrics,
            width: 12,
            height: 6,
          })
        );
      }
    });

    // Add widgets to dashboard
    if (lambdaWidgets.length > 0) {
      dashboard.addWidgets(...lambdaWidgets);
    }

    // ============================================================
    // OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${config.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}

