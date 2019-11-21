#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AwsEksLandingZoneStack } from '../lib/aws-eks-landing-zone-stack';

const app = new cdk.App();
new AwsEksLandingZoneStack(app, 'AwsEksLandingZoneStack');
