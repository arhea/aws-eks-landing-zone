import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import { CfnOutput } from '@aws-cdk/core';

export interface ClusterCsiEbsProps {

  /**
   * The EKS cluster to deploy the cluster autoscaler to.
   *
   * @default none
   */
  cluster: eks.Cluster;

  /**
   * An array of Autoscaling Groups, known as node groups, to configure for autoscaling.
   *
   * @default none
   */
  nodeGroups: Array<autoscaling.AutoScalingGroup>;

  /**
   * The version of the Cluster Autoscaler to deploy.
   *
   * @default v0.4.0
   */
  version?: String;

};

export class ClusterCsiEbs extends cdk.Construct {

  constructor(stack: cdk.Stack, id: string, props: ClusterCsiEbsProps) {
    super(stack, id);

    // default the version to the latest version
    if(!props.version) {
      props.version = 'v0.4.0';
    }

    // define the cluster autoscaler policy statements
    // https://docs.aws.amazon.com/en_pv/eks/latest/userguide/cluster-autoscaler.html#ca-create-ngs
    const policyStatement = new iam.PolicyStatement();
    policyStatement.addResources('*');
    policyStatement.addActions(
      'ec2:AttachVolume',
      'ec2:CreateSnapshot',
      'ec2:CreateTags',
      'ec2:CreateVolume',
      'ec2:DeleteSnapshot',
      'ec2:DeleteTags',
      'ec2:DeleteVolume',
      'ec2:DescribeInstances',
      'ec2:DescribeSnapshots',
      'ec2:DescribeTags',
      'ec2:DescribeVolumes',
      'ec2:DetachVolume'
    );

    // create the policy based on the statements
    const policy = new iam.Policy(stack, 'EbsCsiDriverPolicy', {
      policyName: 'EbsCsiDriverPolicy',
      statements: [ policyStatement ]
    });

    // loop through all of the node groups and attach the policy
    props.nodeGroups.forEach(element => {
      policy.attachToRole(element.role);
    });

    const metadata = {
      name: 'cluster-autoscaler',
      namespace: 'kube-system',
      labels: {
        'k8s-addon': 'cluster-autoscaler.addons.k8s.io',
        'k8s-app': 'cluster-autoscaler'
      }
    };

    // define the Kubernetes Cluster Autoscaler manifests
    const manifest = new eks.KubernetesResource(stack, 'EbsCsiDriverManifest', {
      cluster: props.cluster,
      manifest: [

      ]
    });
  }

};
