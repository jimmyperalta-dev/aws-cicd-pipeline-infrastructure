const { Stack, Duration } = require('aws-cdk-lib');
const ec2 = require('aws-cdk-lib/aws-ec2');
const ecs = require('aws-cdk-lib/aws-ecs');
const ecs_patterns = require('aws-cdk-lib/aws-ecs-patterns');
const iam = require('aws-cdk-lib/aws-iam');
const logs = require('aws-cdk-lib/aws-logs');
const elb = require('aws-cdk-lib/aws-elasticloadbalancingv2');

// This stack represents the infrastructure that will be deployed by the pipeline
// It's similar to your previous AWS CDK infrastructure project

class InfrastructureStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // =====================================================
    // Create VPC with 2 public subnets
    // =====================================================
    const vpc = new ec2.Vpc(this, 'AppVPC', {
      maxAzs: 2,
      natGateways: 0, // To stay in the free tier, we're not using NAT gateways
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });

    // =====================================================
    // Create ECS Cluster and Fargate Service
    // =====================================================
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: vpc,
      clusterName: 'cicd-demo-cluster'
    });

    // Create a load-balanced Fargate service using the convenience pattern
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster: cluster,
      memoryLimitMiB: 512, // Minimum for Fargate
      cpu: 256, // Minimum for Fargate
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('nginx:latest'),
        containerPort: 80,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'cicd-demo-app',
          logRetention: logs.RetentionDays.ONE_WEEK, // Free tier friendly
        }),
      },
      assignPublicIp: true,
      publicLoadBalancer: true,
    });

    // Configure health check for the target group
    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      interval: Duration.seconds(60), // Free tier friendly
      timeout: Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
    });

    // =====================================================
    // Add permissions to the task execution role
    // =====================================================
    // This is the IAM role that the ECS agent and Fargate use to download container images and logs
    fargateService.taskDefinition.executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );

    // =====================================================
    // Configure security groups
    // =====================================================
    // Fargate security group already configured by the pattern
    // But we can add additional rules if needed
    fargateService.service.connections.allowFrom(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );

    // =====================================================
    // Outputs
    // =====================================================
    // Output the load balancer DNS name
    this.exportValue(fargateService.loadBalancer.loadBalancerDnsName, {
      name: 'WebsiteURL',
      description: 'URL of the load balancer',
    });
  }
}

module.exports = { InfrastructureStack }
