import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ResourceNames } from '../config/resource-names';

interface QueuesStackProps extends cdk.StackProps {
  config: any;
  resourceNames: ResourceNames;
  lambdaFunctions: { [key: string]: lambda.IFunction };
  textractResultsTopic: sns.ITopic;
}

export class QueuesStack extends cdk.Stack {
  public readonly queues: { [key: string]: sqs.IQueue } = {};
  public readonly topics: { [key: string]: sns.ITopic } = {};

  constructor(scope: Construct, id: string, props: QueuesStackProps) {
    super(scope, id, props);

    const { config, resourceNames, lambdaFunctions, textractResultsTopic } = props;

    // ============================================================
    // SQS QUEUES
    // ============================================================

    // 1. Document OCR Dead Letter Queue
    const documentOcrDlq = new sqs.Queue(this, 'DocumentOcrDlq', {
      queueName: resourceNames.queue('document', 'ocr-dlq'),
      retentionPeriod: cdk.Duration.seconds(1209600), // 14 days
      visibilityTimeout: cdk.Duration.seconds(300),
    });
    this.queues['document-ocr-dlq'] = documentOcrDlq;

    // 2. Document OCR Queue (with DLQ)
    const documentOcrQueue = new sqs.Queue(this, 'DocumentOcrQueue', {
      queueName: resourceNames.queue('document', 'ocr-queue'),
      retentionPeriod: cdk.Duration.seconds(1209600), // 14 days
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: documentOcrDlq,
        maxReceiveCount: 3,
      },
    });
    this.queues['document-ocr-queue'] = documentOcrQueue;

    // 3. Plaid Transactions Sync DLQ (FIFO)
    const plaidSyncDlqFifo = new sqs.Queue(this, 'PlaidSyncDlqFifo', {
      queueName: resourceNames.queueFifo('plaid', 'transactions-sync-dlq'),
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.seconds(1209600), // 14 days
      visibilityTimeout: cdk.Duration.seconds(300),
    });
    this.queues['plaid-transactions-sync-dlq-fifo'] = plaidSyncDlqFifo;

    // 4. Plaid Transactions Sync FIFO Queue (with DLQ)
    const plaidSyncFifoQueue = new sqs.Queue(this, 'PlaidSyncFifoQueue', {
      queueName: resourceNames.queueFifo('plaid', 'transactions-sync-fifo'),
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.seconds(345600), // 4 days
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: plaidSyncDlqFifo,
        maxReceiveCount: 3,
      },
    });
    this.queues['plaid-transactions-sync-fifo'] = plaidSyncFifoQueue;

    // 5. Plaid Transactions Sync (Standard)
    const plaidSyncQueue = new sqs.Queue(this, 'PlaidSyncQueue', {
      queueName: resourceNames.queue('plaid', 'transactions-sync'),
      retentionPeriod: cdk.Duration.seconds(345600), // 4 days
      visibilityTimeout: cdk.Duration.seconds(300),
    });
    this.queues['plaid-transactions-sync'] = plaidSyncQueue;

    // ============================================================
    // SNS TOPICS
    // ============================================================

    // 1. Backup Notifications Topic
    const backupNotificationsTopic = new sns.Topic(this, 'BackupNotificationsTopic', {
      topicName: resourceNames.topic('backup-notifications'),
      displayName: 'BEBCO Backup Notifications',
    });
    this.topics['backup-notifications'] = backupNotificationsTopic;

    // 2. Textract Results Topic (provided by shared services stack)
    this.topics['textract-results'] = textractResultsTopic;

    // ============================================================
    // EVENTBRIDGE RULES
    // ============================================================

    // 1. Lambda Backup Schedule (6am & 6pm UTC daily)
    if (lambdaFunctions['lambda-backup-function']) {
      new events.Rule(this, 'LambdaBackupSchedule', {
        ruleName: resourceNames.eventRule('lambda-backup-schedule'),
        description: 'Trigger Lambda backup function twice daily',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '6,18',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['lambda-backup-function'])],
      });
    }

    // 2. Portfolio Parse Daily (9am UTC) -> excel-parser
    if (lambdaFunctions['excel-parser']) {
      new events.Rule(this, 'PortfolioParseDailyRule', {
        ruleName: resourceNames.eventRule('portfolio-parse-daily'),
        description: 'Trigger portfolio parse function daily at 9am UTC',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '9',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['excel-parser'])],
      });
    }

    // 3. Portfolio Sync Daily (8am UTC) -> sharepoint-sync-portfolio
    if (lambdaFunctions['sharepoint-sync-portfolio']) {
      new events.Rule(this, 'PortfolioSyncDailyRule', {
        ruleName: resourceNames.eventRule('portfolio-sync-daily'),
        description: 'Trigger portfolio sync function daily at 8am UTC',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '8',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['sharepoint-sync-portfolio'])],
      });
    }

    // 4. NACHA Daily 4pm EST (8pm UTC) -> payments-ach-batches
    if (lambdaFunctions['payments-ach-batches']) {
      new events.Rule(this, 'NachaDailyRule', {
        ruleName: resourceNames.eventRule('nacha-daily-4pm-est'),
        description: 'Trigger NACHA ACH service daily at 4pm EST (8pm UTC)',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '20',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['payments-ach-batches'])],
      });
    }

    // 5. Generate Monthly Statements (1st of month, 10:15 UTC)
    if (lambdaFunctions['generate-plaid-monthly-account-statement']) {
      new events.Rule(this, 'GenerateMonthlyStatementsRule', {
        ruleName: resourceNames.eventRule('generate-monthly-statements'),
        description: 'Generate monthly statements on 1st of each month',
        schedule: events.Schedule.cron({
          minute: '15',
          hour: '10',
          day: '1',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['generate-plaid-monthly-account-statement'])],
      });
    }

    // 6. Monthly Reports Scheduler (1st of month, 10:05 UTC)
    if (lambdaFunctions['monthly-reports-scheduler']) {
      new events.Rule(this, 'MonthlyReportsSchedulerRule', {
        ruleName: resourceNames.eventRule('monthly-reports-scheduler'),
        description: 'Trigger monthly reports scheduler on 1st of each month',
        schedule: events.Schedule.cron({
          minute: '5',
          hour: '10',
          day: '1',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['monthly-reports-scheduler'])],
      });
    }

    // 7. Plaid Daily Sync (10am UTC)
    if (lambdaFunctions['plaid-daily-sync']) {
      new events.Rule(this, 'PlaidDailySyncRule', {
        ruleName: resourceNames.eventRule('plaid-daily-sync'),
        description: 'Trigger Plaid daily sync function at 10am UTC',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '10',
        }),
        targets: [new targets.LambdaFunction(lambdaFunctions['plaid-daily-sync'])],
      });
    }

    // ============================================================
    // OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, 'DocumentOcrQueueUrl', {
      value: documentOcrQueue.queueUrl,
      description: 'Document OCR Queue URL',
    });

    new cdk.CfnOutput(this, 'PlaidSyncFifoQueueUrl', {
      value: plaidSyncFifoQueue.queueUrl,
      description: 'Plaid Transactions Sync FIFO Queue URL',
    });

  }
}

