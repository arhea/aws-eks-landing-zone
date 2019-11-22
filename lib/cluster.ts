import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import { CfnOutput } from '@aws-cdk/core';
import { ClusterAutoscaler } from './cluster-autoscaler';

export interface LandingZoneClusterProps {

  vpc: ec2.IVpc,

  instanceType: ec2.InstanceType,

  desiredCapacity: number;

  minCapacity: number;

  maxCapacity: number;

};

export class LandingZoneCluster extends cdk.Construct {

  public readonly cluster: eks.Cluster;

  public readonly adminRole: iam.Role;

  constructor(stack: cdk.Stack, id: string, props: LandingZoneClusterProps) {
    super(stack, id);

    this.adminRole = new iam.Role(stack, 'KubernetesAdmins', {
      assumedBy: new iam.AccountRootPrincipal()
    });

    this.cluster = new eks.Cluster(stack, 'LandingZoneCluster', {
      vpc: props.vpc,
      clusterName: 'LandingZoneCluster',
      defaultCapacity: 0,
      mastersRole: this.adminRole
    });

    const ng1 = this.cluster.addCapacity('LandingZoneCapacity', {
      instanceType: props.instanceType,
      desiredCapacity: props.desiredCapacity,
      minCapacity: props.minCapacity,
      maxCapacity: props.maxCapacity
    });

    new CfnOutput(stack, 'MastersAdminRole', {
      value: this.adminRole.roleArn
    });

    new ClusterAutoscaler(stack, 'ClusterAutoscaler', {
      cluster: this.cluster,
      nodeGroups: [ ng1 ]
    });

  }

};
