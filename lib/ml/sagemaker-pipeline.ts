// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import {
  SecretValue,
  Stack,
  RemovalPolicy,
  aws_s3,
  aws_secretsmanager,
  aws_iam,
  aws_s3_assets,
  aws_codebuild,
  aws_kms,
  aws_logs,
  aws_sagemaker,
  Duration,
  aws_lambda_nodejs,
  aws_lambda,
  aws_cloudformation,
  aws_events_targets,
  triggers,
  aws_ssm,
} from 'aws-cdk-lib';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';

type SageMakerPipelineProps = {
  project: aws_sagemaker.CfnProject;
};

export class SagmakerPipeline extends Construct {
  constructor(scope: Construct, id: string, props: SageMakerPipelineProps) {
    super(scope, id);
    const { project } = props;

    const config = this.node.tryGetContext('config');
    const { region } = Stack.of(this);

    const mlOutputBucket = new aws_s3.Bucket(this, 'MlOutput', {
      versioned: true,
      enforceSSL: true,
      encryption: aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: new aws_s3.Bucket(this, 'MlOutputAccessLog', {
        versioned: true,
        enforceSSL: true,
        encryption: aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const mlOpsCode = new aws_s3_assets.Asset(this, 'MlOpsAsset', {
      path: 'mlops',
    });

    const dataSetsBucket = new aws_s3.Bucket(this, 'DataSetsBucket', {
      versioned: true,
      enforceSSL: true,
      encryption: aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: new aws_s3.Bucket(this, 'DataSetsAccessLog', {
        versioned: true,
        enforceSSL: true,
        encryption: aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const sageMakerPipelineRole = new aws_iam.Role(this, 'ServiceCatalogProductRole', {
      assumedBy: new aws_iam.CompositePrincipal(
        new aws_iam.ServicePrincipal('sagemaker.amazonaws.com')
      ),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
      ],
    });
    dataSetsBucket.grantReadWrite(sageMakerPipelineRole);

    const buildEncryptionKey = new aws_kms.Key(this, 'BuildEncryptionKey', {
      removalPolicy: RemovalPolicy.DESTROY,
      enableKeyRotation: true,
    });

    const build = new aws_codebuild.Project(this, 'MlBuild', {
      environment: { computeType: ComputeType.X2_LARGE },
      timeout: Duration.minutes(120),
      encryptionKey: buildEncryptionKey,
      source: aws_codebuild.Source.s3({
        bucket: mlOpsCode.bucket,
        path: mlOpsCode.s3ObjectKey,
      }),
      artifacts: aws_codebuild.Artifacts.s3({
        bucket: mlOutputBucket,
        includeBuildId: false,
        packageZip: false,
      }),
      environmentVariables: {
        SAGEMAKER_PROJECT_NAME: { value: project.projectName },
        SAGEMAKER_PROJECT_ID: { value: project.attrProjectId },
        ARTIFACT_BUCKET: { value: dataSetsBucket.bucketName },
        SAGEMAKER_PIPELINE_NAME: { value: 'sagemaker-' + project.projectName },
        SAGEMAKER_PIPELINE_ROLE_ARN: { value: sageMakerPipelineRole.roleArn },
        AWS_REGION: { value: region },
        STDEVCLOUD_USERNAME_SECRET: { value: config.stUsernameSecret },
        STDEVCLOUD_PASSWORD_SECRET: { value: config.stPasswordSecret },
      },
      buildSpec: aws_codebuild.BuildSpec.fromAsset('lib/ml/buildspec.yml'),
      logging: {
        cloudWatch: {
          logGroup: new aws_logs.LogGroup(this, `MlBuildLogGroup`),
        },
      },
    });
    dataSetsBucket.grantReadWrite(build);
    mlOpsCode.bucket.grantReadWrite(build);
    build.role?.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
    );

    const param = new aws_ssm.StringParameter(this, 'StringParameter', {
      stringValue: '0',
    });

    const role = new aws_iam.Role(this, 'FnRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildAdminAccess'),
      ],
    });

    const { ref: waitCompletionUrl } = new aws_cloudformation.CfnWaitConditionHandle(
      this,
      'CfnWaitConditionHandle' + Date.now()
    );

    const fn = new aws_lambda_nodejs.NodejsFunction(this, 'wait-handler', {
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      environment: {
        assetHash: mlOpsCode.assetHash,
        paramName: param.parameterName,
        projectName: build.projectName,
        waitCompletionUrl,
        runEveryTime: Date.now().toString(),
      },
      role,
    });

    new aws_cloudformation.CfnWaitCondition(this, 'CfnWaitCondition' + Date.now(), {
      handle: waitCompletionUrl,
      timeout: '7200',
      count: 1,
    });

    build.onBuildSucceeded('BuildSucceed', {
      target: new aws_events_targets.LambdaFunction(fn),
    });
    build.onBuildFailed('BuildFail', {
      target: new aws_events_targets.LambdaFunction(fn),
    });

    new triggers.Trigger(this, 'BuildTrigger', {
      handler: fn,
      invocationType: triggers.InvocationType.EVENT,
      executeAfter: [build],
    });

    const key = new aws_kms.Key(this, 'KMS', {
      removalPolicy: RemovalPolicy.DESTROY,
      enableKeyRotation: true,
    });
    const mlBucketSecret = new aws_secretsmanager.Secret(this, 'MlOutputSecret', {
      secretName: 'MlBucketArn',
      secretStringValue: SecretValue.unsafePlainText(mlOutputBucket.bucketArn),
      encryptionKey: key,
    });

    for (const { account } of config.envs.iot) {
      const remotePrincipal = new aws_iam.ArnPrincipal(`arn:aws:iam::${account}:root`);
      key.grantDecrypt(remotePrincipal);
      mlBucketSecret.grantRead(remotePrincipal);
      mlOutputBucket.grantRead(remotePrincipal);
      buildEncryptionKey.grantDecrypt(remotePrincipal);
    }
  }
}
