const { Stack } = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const cdk = require('aws-cdk-lib');

class PipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create artifact bucket for the pipeline
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create source bucket where we'll upload our code
    const sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // Create pipeline artifacts
    const sourceOutput = new codepipeline.Artifact('SourceCode');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create CodeBuild project for building/testing
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        // Use Ubuntu standard image instead of Amazon Linux
        buildImage: codebuild.LinuxBuildImage.UBUNTU_20_04_X86_64_STANDARD_5_0,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '16',  // Use Node.js 16 which is compatible with Ubuntu 20.04
            },
            commands: [
              'echo Installing dependencies...',
              'node --version',
              'npm --version',
            ],
          },
          build: {
            commands: [
              'echo "Building project..."',
              'echo "Listing source files:"',
              'ls -la',
              'echo "Build completed successfully!"',
            ],
          },
        },
        artifacts: {
          files: ['**/*'],
        },
      }),
    });

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'SimpleCDKPipeline',
      artifactBucket: artifactBucket,
    });

    // Add source stage
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.S3SourceAction({
          actionName: 'S3Source',
          bucket: sourceBucket,
          bucketKey: 'source.zip',
          output: sourceOutput,
        }),
      ],
    });

    // Add build stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildAction',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // Output the source bucket name so we know where to upload code
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: sourceBucket.bucketName,
      description: 'Name of the S3 bucket for uploading source code',
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'Name of the CI/CD Pipeline',
    });
  }
}

module.exports = { PipelineStack };
