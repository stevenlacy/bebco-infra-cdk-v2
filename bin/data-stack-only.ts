#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EnvironmentConfigLoader } from '../lib/config/environment-config';
import { ResourceNames } from '../lib/config/resource-names';
import { DataStack } from '../lib/stacks/data-stack';

const app = new cdk.App();

const config = EnvironmentConfigLoader.loadFromContext(app);
const resourceNames = new ResourceNames(
  config.naming.prefix,
  config.naming.environmentSuffix,
  config.region,
  config.account
);

const env = {
  account: config.account,
  region: config.region,
};

new DataStack(app, `BebcoDataStack-${config.naming.environmentSuffix}`, {
  env,
  config,
  resourceNames,
  description: 'DynamoDB tables for all bebco data',
});

app.synth();

