import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');

export interface LandingZoneNetworkProps {

  maxAzs: number

};

export class LandingZoneNetwork extends cdk.Construct {

  public readonly vpc: ec2.IVpc;

  constructor(stack: cdk.Stack, id: string, props: LandingZoneNetworkProps) {
    super(stack, id);

    const vpcCidr = '10.0.0.0/16';

    this.vpc = new ec2.Vpc(stack, 'LandingZoneVpc', {
      cidr: vpcCidr,
      maxAzs: props.maxAzs
   });

   const securityGroup = new ec2.SecurityGroup(stack, 'VPCEndpointSecurityGroup', {
     vpc: this.vpc,
     allowAllOutbound: true,
     description: 'allow endpoints to communicate with services'
   });

   securityGroup.addIngressRule(
     ec2.Peer.ipv4(vpcCidr),
     ec2.Port.allTcp(),
     'allow all local traffic'
   );

   this.vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      securityGroups: [ securityGroup ]
    });

    this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      securityGroups: [ securityGroup ]
    });

    this.vpc.addInterfaceEndpoint('CloudwatchEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH,
      securityGroups: [ securityGroup ]
    });

    this.vpc.addInterfaceEndpoint('CloudwatchEventsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS,
      securityGroups: [ securityGroup ]
    });

  }
};
