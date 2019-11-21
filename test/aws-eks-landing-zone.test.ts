import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import AwsEksLandingZone = require('../lib/aws-eks-landing-zone-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AwsEksLandingZone.AwsEksLandingZoneStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});