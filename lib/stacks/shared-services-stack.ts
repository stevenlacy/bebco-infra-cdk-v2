import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceNames } from '../config/resource-names';

export interface SharedServicesStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
  buckets: { [key: string]: s3.IBucket };
}

export class SharedServicesStack extends cdk.Stack {
  public readonly textractRole: iam.IRole;
  public readonly textractResultsTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: SharedServicesStackProps) {
    super(scope, id, props);

    const { config, resourceNames, buckets } = props;

    if (!config.textract) {
      throw new Error('Textract configuration is required to provision shared services.');
    }

    const documentsBucket = buckets.documents;

    if (!documentsBucket) {
      throw new Error('Documents bucket is required to configure Textract integrations.');
    }

    if (config.textract.snsTopicArn) {
      this.textractResultsTopic = sns.Topic.fromTopicArn(this, 'TextractResultsTopic', config.textract.snsTopicArn);
    } else {
      this.textractResultsTopic = new sns.Topic(this, 'TextractResultsTopic', {
        topicName: resourceNames.topic(config.textract.snsTopicName),
        displayName: 'BEBCO Textract Results',
      });
    }

    if (config.textract.roleArn) {
      this.textractRole = iam.Role.fromRoleArn(this, 'TextractRole', config.textract.roleArn, {
        mutable: true,
      });
    } else {
      this.textractRole = new iam.Role(this, 'TextractRole', {
        roleName: resourceNames.iamRole(config.textract.roleName),
        assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
        description: 'Role assumed by Textract to process borrower documents and publish SNS notifications.',
      });
    }

    documentsBucket.grantReadWrite(this.textractRole);
    this.textractRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [documentsBucket.bucketArn],
    }));

    this.textractResultsTopic.grantPublish(this.textractRole);

    new cdk.CfnOutput(this, 'TextractResultsTopicArn', {
      value: this.textractResultsTopic.topicArn,
      description: 'SNS topic ARN for Textract job completion notifications.',
    });

    new cdk.CfnOutput(this, 'TextractRoleArn', {
      value: this.textractRole.roleArn,
      description: 'IAM role used by Textract asynchronous jobs.',
    });
  }
}

