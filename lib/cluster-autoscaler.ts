import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import { CfnOutput } from '@aws-cdk/core';

export interface ClusterAutoscalerProps {

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
   * @default v1.14.6
   */
  version?: String;

};

export class ClusterAutoscaler extends cdk.Construct {

  constructor(stack: cdk.Stack, id: string, props: ClusterAutoscalerProps) {
    super(stack, id);

    // default the version to the latest version
    if(!props.version) {
      props.version = 'v1.14.6';
    }

    // define the cluster autoscaler policy statements
    // https://docs.aws.amazon.com/en_pv/eks/latest/userguide/cluster-autoscaler.html#ca-create-ngs
    const policyStatement = new iam.PolicyStatement();
    policyStatement.addResources('*');
    policyStatement.addActions(
      'autoscaling:DescribeAutoScalingGroups',
      'autoscaling:DescribeAutoScalingInstances',
      'autoscaling:DescribeLaunchConfigurations',
      'autoscaling:DescribeTags',
      'autoscaling:SetDesiredCapacity',
      'autoscaling:TerminateInstanceInAutoScalingGroup',
      'ec2:DescribeLaunchTemplateVersions'
    );

    // create the policy based on the statements
    const policy = new iam.Policy(stack, 'ClusterAutoscalerPolicy', {
      policyName: 'ClusterAutoscalerPolicy',
      statements: [ policyStatement ]
    });

    // loop through all of the node groups and attach the policy
    props.nodeGroups.forEach(element => {
      cdk.Tag.add(element, 'k8s.io/cluster-autoscaler/' + props.cluster.clusterName, 'owned', { applyToLaunchedInstances: true });
      cdk.Tag.add(element, 'k8s.io/cluster-autoscaler/enabled', 'true', { applyToLaunchedInstances: true });
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
    const manifest = new eks.KubernetesResource(stack, 'ClusterAutoscalerManifest', {
      cluster: props.cluster,
      manifest: [
        {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata
        },
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata,
          rules: [
            {
              apiGroups: [''],
              resources: ['events', 'endpoints'],
              verbs: ['create', 'patch']
            },
            {
              apiGroups: [''],
              resources: ['pods/eviction'],
              verbs: ['create']
            },
            {
              apiGroups: [''],
              resources: ['pods/status'],
              verbs: ['update']
            },
            {
              apiGroups: [''],
              resources: ['endpoints'],
              resourceNames: ['cluster-autoscaler'],
              verbs: ['get', 'update']
            },
            {
              apiGroups: [''],
              resources: ['nodes'],
              verbs: ['watch', 'list', 'get', 'update']
            },
            {
              apiGroups: [''],
              resources: ['pods', 'services', 'replicationcontrollers', 'persistentvolumeclaims', 'persistentvolumes' ],
              verbs: ['watch', 'list', 'get']
            },
            {
              apiGroups: ['extensions'],
              resources: ['replicasets', 'daemonsets'],
              verbs: ['watch', 'list', 'get']
            },
            {
              apiGroups: ['policy'],
              resources: ['poddisruptionbudgets'],
              verbs: ['watch', 'list']
            },
            {
              apiGroups: ['apps'],
              resources: ['statefulsets', 'replicasets', 'daemonsets'],
              verbs: ['watch', 'list', 'get']
            },
            {
              apiGroups: ['storage.k8s.io'],
              resources: ['storageclasses', 'csinodes'],
              verbs: ['watch', 'list', 'get']
            },
            {
              apiGroups: ['batch', 'extensions'],
              resources: ['jobs'],
              verbs: ['get', 'list', 'watch', 'patch']
            }
          ]
        },
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'Role',
          metadata,
          rules: [
            {
              apiGroups: [''],
              resources: ['configmaps'],
              verbs: ['create','list','watch']
            },
            {
              apiGroups: [''],
              resources: ['configmaps'],
              resourceNames: ['cluster-autoscaler-status', 'cluster-autoscaler-priority-expander'],
              verbs: ['delete', 'get', 'update', 'watch']
            }
          ]
        },
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRoleBinding',
          metadata,
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
          kind: 'RoleBinding',
          metadata,
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'Role',
            name: metadata.name
          },
          subjects: [
            {
              kind: 'ServiceAccount',
              name: metadata.name,
              namespace:metadata.namespace
            }
          ]
        },
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'RoleBinding',
          metadata,
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'Role',
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
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: metadata.name,
            namespace: metadata.namespace,
            labels: {
              app: metadata.name
            },
            annotations: {
              'cluster-autoscaler.kubernetes.io/safe-to-evict': 'false'
            }
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: metadata.name
              }
            },
            template: {
              metadata: {
                labels: {
                  app: metadata.name
                },
                annotations: {
                  'prometheus.io/scrape': 'true',
                  'prometheus.io/port': '8085'
                }
              },
              spec: {
                serviceAccountName: metadata.name,
                containers: [
                   {
                      image: 'k8s.gcr.io/cluster-autoscaler:' + props.version,
                      name: metadata.name,
                      resources: {
                         limits: {
                            cpu: '100m',
                            memory: '300Mi'
                         },
                         requests: {
                            cpu: '100m',
                            memory: '300Mi'
                         }
                      },
                      command: [
                        './cluster-autoscaler',
                        '--v=4',
                        '--stderrthreshold=info',
                        '--cloud-provider=aws',
                        '--skip-nodes-with-local-storage=false',
                        '--expander=least-waste',
                        '--node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/' + props.cluster.clusterName,
                        '--balance-similar-node-groups',
                        '--skip-nodes-with-system-pods=false'
                      ],
                      volumeMounts: [
                         {
                            name: 'ssl-certs',
                            mountPath: '/etc/ssl/certs/ca-certificates.crt',
                            readOnly: true
                         }
                      ],
                      imagePullPolicy: 'Always'
                   }
                ],
                volumes: [
                   {
                    name: 'ssl-certs',
                    hostPath: {
                      path: '/etc/ssl/certs/ca-bundle.crt'
                    }
                   }
                ]
             }
            }
          }
        }
      ]
    });
  }

};
