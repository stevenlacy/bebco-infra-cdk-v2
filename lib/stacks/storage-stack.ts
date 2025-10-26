import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceNames } from '../config/resource-names';

export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  resourceNames: ResourceNames;
}

export class StorageStack extends cdk.Stack {
  public readonly buckets: { [key: string]: s3.IBucket } = {};
  
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    
    const { resourceNames } = props;
    
    // Documents bucket
    this.buckets.documents = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: resourceNames.bucket('borrower-documents'),
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });
    
    // Statements bucket
    this.buckets.statements = new s3.Bucket(this, 'StatementsBucket', {
      bucketName: resourceNames.bucket('borrower-statements'),
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(2555), // ~7 years
        },
      ],
    });
    
    // Change tracking bucket
    this.buckets.changeTracking = new s3.Bucket(this, 'ChangeTrackingBucket', {
      bucketName: resourceNames.bucket('change-tracking'),
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Lambda deployments bucket (for future builds)
    this.buckets.lambdaDeployments = new s3.Bucket(this, 'LambdaDeploymentsBucket', {
      bucketName: resourceNames.bucket('lambda-deployments'),
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.buckets.documents.bucketName,
      description: 'Documents S3 Bucket Name',
    });
    
    new cdk.CfnOutput(this, 'StatementsBucketName', {
      value: this.buckets.statements.bucketName,
      description: 'Statements S3 Bucket Name',
    });
  }
}

