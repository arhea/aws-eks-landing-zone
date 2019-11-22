#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AwsEksLandingZoneStack } from '../lib';

const app = new cdk.App();
new AwsEksLandingZoneStack(app, 'AwsEksLandingZoneStack');
