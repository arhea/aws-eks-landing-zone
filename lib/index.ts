import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import { LandingZoneNetwork } from './network';
import { LandingZoneCluster } from './cluster';

export class AwsEksLandingZoneStack extends cdk.Stack {

  private readonly network: LandingZoneNetwork;

  private readonly cluster: LandingZoneCluster;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.network = new LandingZoneNetwork(this, 'LandingZoneNetworkConstruct', {
      maxAzs: 3
    });

    this.cluster = new LandingZoneCluster(this, 'LandingZoneClusterConstruct', {
      vpc: this.network.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      desiredCapacity: 3,
      minCapacity: 3,
      maxCapacity: 6
    });
  }
}
