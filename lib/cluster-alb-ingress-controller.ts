import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import { CfnOutput } from '@aws-cdk/core';

export interface ClusterAlbIngressControllerProps {

  /**
   * The EKS cluster to deploy the ALB Ingress Controller to.
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
   * The version of the ALB Ingress Controller to deploy.
   *
   * @default v1.1.3
   */
  version?: String;


};

export class ClusterAlbIngressController extends cdk.Construct {

  constructor(stack: cdk.Stack, id: string, props: ClusterAlbIngressControllerProps) {
    super(stack, id);

    // default the version to the latest version
    if(!props.version) {
      props.version = 'v1.1.3';
    }

    // define the cluster autoscaler policy statements
    // https://docs.aws.amazon.com/en_pv/eks/latest/userguide/alb-ingress.html
    const policyStatement = new iam.PolicyStatement();
    policyStatement.addResources('*');
    policyStatement.addActions(
      'acm:DescribeCertificate',
      'acm:ListCertificates',
      'acm:GetCertificate',
      'ec2:AuthorizeSecurityGroupIngress',
      'ec2:CreateSecurityGroup',
      'ec2:CreateTags',
      'ec2:DeleteTags',
      'ec2:DeleteSecurityGroup',
      'ec2:DescribeAccountAttributes',
      'ec2:DescribeAddresses',
      'ec2:DescribeInstances',
      'ec2:DescribeInstanceStatus',
      'ec2:DescribeInternetGateways',
      'ec2:DescribeNetworkInterfaces',
      'ec2:DescribeSecurityGroups',
      'ec2:DescribeSubnets',
      'ec2:DescribeTags',
      'ec2:DescribeVpcs',
      'ec2:ModifyInstanceAttribute',
      'ec2:ModifyNetworkInterfaceAttribute',
      'ec2:RevokeSecurityGroupIngress',
      'elasticloadbalancing:AddListenerCertificates',
      'elasticloadbalancing:AddTags',
      'elasticloadbalancing:CreateListener',
      'elasticloadbalancing:CreateLoadBalancer',
      'elasticloadbalancing:CreateRule',
      'elasticloadbalancing:CreateTargetGroup',
      'elasticloadbalancing:DeleteListener',
      'elasticloadbalancing:DeleteLoadBalancer',
      'elasticloadbalancing:DeleteRule',
      'elasticloadbalancing:DeleteTargetGroup',
      'elasticloadbalancing:DeregisterTargets',
      'elasticloadbalancing:DescribeListenerCertificates',
      'elasticloadbalancing:DescribeListeners',
      'elasticloadbalancing:DescribeLoadBalancers',
      'elasticloadbalancing:DescribeLoadBalancerAttributes',
      'elasticloadbalancing:DescribeRules',
      'elasticloadbalancing:DescribeSSLPolicies',
      'elasticloadbalancing:DescribeTags',
      'elasticloadbalancing:DescribeTargetGroups',
      'elasticloadbalancing:DescribeTargetGroupAttributes',
      'elasticloadbalancing:DescribeTargetHealth',
      'elasticloadbalancing:ModifyListener',
      'elasticloadbalancing:ModifyLoadBalancerAttributes',
      'elasticloadbalancing:ModifyRule',
      'elasticloadbalancing:ModifyTargetGroup',
      'elasticloadbalancing:ModifyTargetGroupAttributes',
      'elasticloadbalancing:RegisterTargets',
      'elasticloadbalancing:RemoveListenerCertificates',
      'elasticloadbalancing:RemoveTags',
      'elasticloadbalancing:SetIpAddressType',
      'elasticloadbalancing:SetSecurityGroups',
      'elasticloadbalancing:SetSubnets',
      'elasticloadbalancing:SetWebACL',
      'iam:CreateServiceLinkedRole',
      'iam:GetServerCertificate',
      'iam:ListServerCertificates',
      'cognito-idp:DescribeUserPoolClient',
      'waf-regional:GetWebACLForResource',
      'waf-regional:GetWebACL',
      'waf-regional:AssociateWebACL',
      'waf-regional:DisassociateWebACL',
      'tag:GetResources',
      'tag:TagResources',
      'waf:GetWebACL'
    );

    // create the policy based on the statements
    const policy = new iam.Policy(stack, 'AlbIngressControllerIamPolicy', {
      policyName: 'AlbIngressControllerIamPolicy',
      statements: [ policyStatement ]
    });

    // loop through all of the node groups and attach the policy
    props.nodeGroups.forEach(element => {
      policy.attachToRole(element.role);
    });

    const metadata = {
      name: 'alb-ingress-controller',
      namespace: 'kube-system',
      labels: {
        'app.kubernetes.io/name': 'alb-ingress-controller'
      }
    };

    // define the Kubernetes manifests
    const manifest = new eks.KubernetesResource(stack, 'ClusterAutoscalerManifest', {
      cluster: props.cluster,
      manifest: [
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata,
          rules: [
            {
              apiGroups: [
                '',
                'extensions'
              ],
              resources: [
                'configmaps',
                'endpoints',
                'events',
                'ingresses',
                'ingresses/status',
                'services'
              ],
              verbs: [
                'create',
                'get',
                'list',
                'update',
                'watch',
                'patch'
              ]
            },
            {
              apiGroups: [
                '',
                'extensions'
              ],
              resources: [
                'nodes',
                'pods',
                'secrets',
                'services',
                'namespaces'
              ],
              verbs: [
                'get',
                'list',
                'watch'
              ]
            }
          ],
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'ClusterRole',
            name: metadata.name
          },
          subjects: [
            {
              kind: 'ServiceAccount',
              name: metadata.name,
              namespace: metadata.namespace
            }
          ]
        },
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRoleBinding',
          metadata: {
            labels: metadata.labels,
            name: metadata.name
          },
          roleRef: {
           apiGroup: 'rbac.authorization.k8s.io',
            kind: 'ClusterRole',
            name: metadata.name
          },
          subjects: [
            {
              kind: 'ServiceAccount',
              name: metadata.name,
              namespace: metadata.namespace
            }
          ]
        },
        {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata
        },
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata,
          spec: {
            selector: {
              matchLabels: metadata.labels
            },
            template: {
              metadata: {
                labels: metadata.labels
              },
              spec: {
                containers: [
                  {
                    name: metadata.name,
                    args: [
                      '--ingress-class=alb',
                      '--cluster-name=' + props.cluster.clusterArn,
                      '--aws-vpc-id=' + props.cluster.vpc.vpcId,
                      '--aws-region=' + stack.region
                    ],
                    image: 'docker.io/amazon/aws-alb-ingress-controller:' + props.version
                  }
                ],
                serviceAccountName: metadata.name
              }
            }
          }
        }
      ]
    });
  }

};
