// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import {
  Names,
  RemovalPolicy,
  aws_s3,
  aws_lambda_nodejs,
  custom_resources,
  CustomResource,
  aws_signer,
  aws_iam,
  aws_codebuild,
  aws_s3_assets,
  aws_s3_notifications,
  aws_lambda,
  aws_logs,
} from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { BuildTrigger } from '../trigger/build-trigger';

const codeSigningLabel = 'ota_signer_pub';

export class Code extends Construct {
  firmwareBucket: aws_s3.Bucket;
  thingNamePrefix: string;
  publicKey: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = this.node.tryGetContext('config');

    const certificateFn = new PythonFunction(this, 'certificateFn', {
      entry: 'lib/iot/certificate-lambda',
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      initialPolicy: [
        new aws_iam.PolicyStatement({
          actions: ['acm:ImportCertificate', 'acm:DeleteCertificate'],
          resources: ['*'],
        }),
      ],
    });
    const certificateprovider = new custom_resources.Provider(this, 'CertificatePr', {
      onEventHandler: certificateFn,
    });
    const certificateCr = new CustomResource(this, 'CertificateCr', {
      serviceToken: certificateprovider.serviceToken,
    });
    const publicKey = certificateCr.getAttString('publicKey');
    const certificateArn = certificateCr.getAttString('certificateArn');

    const signingProfileFn = new aws_lambda_nodejs.NodejsFunction(this, 'signingProfile', {
      initialPolicy: [
        new aws_iam.PolicyStatement({
          actions: ['signer:PutSigningProfile', 'signer:CancelSigningProfile'],
          resources: ['*'],
        }),
      ],
    });
    const signingProfileProvider = new custom_resources.Provider(this, 'SigningProfilePr', {
      onEventHandler: signingProfileFn,
    });
    const signingProfileCr = new CustomResource(this, 'SigningProfileCr', {
      serviceToken: signingProfileProvider.serviceToken,
      properties: {
        certificateArn,
        codeSigningLabel,
        platformId: aws_signer.Platform.AMAZON_FREE_RTOS_DEFAULT.platformId,
      },
    });

    const firmwareBucket = new aws_s3.Bucket(this, 'Firmwares', {
      versioned: true,
      enforceSSL: true,
      encryption: aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      serverAccessLogsBucket: new aws_s3.Bucket(this, 'FirmwaresAccessLog', {
        versioned: true,
        enforceSSL: true,
        encryption: aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const signedFirmwareBucket = new aws_s3.Bucket(this, 'SignedFirmwares', {
      versioned: true,
      enforceSSL: true,
      encryption: aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      serverAccessLogsBucket: new aws_s3.Bucket(this, 'SignedFirmwaresAccessLog', {
        versioned: true,
        enforceSSL: true,
        encryption: aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const thingNamePrefix = Names.uniqueResourceName(this, {});
    const signingProfileName = signingProfileCr.getAttString('profileName');

    const modelCode = new aws_s3.Bucket(this, 'ModelCode', {
      versioned: true,
      enforceSSL: true,
      encryption: aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      serverAccessLogsBucket: new aws_s3.Bucket(this, 'ModelCodeAccessLog', {
        versioned: true,
        enforceSSL: true,
        encryption: aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const getMlBucketNameCr = new custom_resources.AwsCustomResource(this, 'GetMlBucketName', {
      onCreate: {
        service: 'SecretsManager',
        action: 'getSecretValue',
        parameters: {
          SecretId: `arn:aws:secretsmanager:${config.envs.ml.region}:${config.envs.ml.account}:secret:MlBucketArn`,
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of('MlBucketArn'),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
        new aws_iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
          resources: ['*'],
        }),
      ]),
    });
    const mlBucketArn = getMlBucketNameCr.getResponseField('SecretString');
    const mlBucket = aws_s3.Bucket.fromBucketAttributes(this, 'ImportedMlBucket', {
      bucketArn: mlBucketArn,
    });

    const stmCode = new aws_s3_assets.Asset(this, 'STMAsset', {
      path: 'stm32',
    });
    const build = new aws_codebuild.Project(this, 'IotBuild', {
      source: aws_codebuild.Source.s3({
        bucket: stmCode.bucket,
        path: stmCode.s3ObjectKey,
      }),
      secondarySources: [
        aws_codebuild.Source.s3({
          identifier: 'ml',
          bucket: mlBucket,
          path: 'ml/tmp/ml/',
        }),
      ],
      artifacts: aws_codebuild.Artifacts.s3({
        bucket: firmwareBucket,
        includeBuildId: false,
        packageZip: false,
      }),
      environment: {
        buildImage: aws_codebuild.LinuxBuildImage.fromDockerRegistry(
          'public.ecr.aws/y2t8c1e9/cube_ide_image:latest'
        ),
      },
      buildSpec: aws_codebuild.BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          files: ['Projects/b_u585i_iot02a_ntz/Debug/b_u585i_iot02a_ntz.bin'],
        },
        phases: {
          build: {
            commands: [
              'mkdir -p Middleware/STM32_AI_Library',
              `cp -r $CODEBUILD_SRC_DIR_ml/stm32ai_files/Inc Middleware/STM32_AI_Library/`,
              `cp -r $CODEBUILD_SRC_DIR_ml/stm32ai_files/Lib Middleware/STM32_AI_Library/`,
              'ls Middleware/STM32_AI_Library/Inc',
              'ls Middleware/STM32_AI_Library/Lib',
              `cp -r $CODEBUILD_SRC_DIR_ml/C_header/* Projects/Common/dpu/`,
              'ls Projects/Common/dpu',
              `mv Middleware/STM32_AI_Library/Lib/NetworkRuntime730_CM33_GCC.a Middleware/STM32_AI_Library/Lib/NetworkRuntime800_CM33_GCC.a`, //TODO: check how to sync runtime version
              `cp -r $CODEBUILD_SRC_DIR_ml/stm32ai_files/network* Projects/Common/X-CUBE-AI/App/`,
              `/opt/st/stm32cubeide_1.12.1/headless-build.sh -data . -import Projects/b_u585i_iot02a_ntz -build b_u585i_iot02a_ntz`,
            ],
          },
        },
      }),
      logging: {
        cloudWatch: {
          logGroup: new aws_logs.LogGroup(this, `IoTBuildLogGroup`),
        },
      },
    });
    build.role?.addToPrincipalPolicy(
      new aws_iam.PolicyStatement({ actions: ['kms:Decrypt'], resources: ['*'] })
    );
    stmCode.bucket.grantRead(build);
    modelCode.grantRead(build);
    firmwareBucket.grantReadWrite(build);
    mlBucket.grantReadWrite(build);

    new BuildTrigger(this, 'IotBuildTrigger', { buildProject: build, state: stmCode.assetHash });

    const otaRole = new aws_iam.Role(this, 'otaRole', {
      assumedBy: new aws_iam.ServicePrincipal('iot.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonFreeRTOSOTAUpdate'),
      ],
    });
    otaRole.addToPrincipalPolicy(
      new aws_iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [otaRole.roleArn],
      })
    );
    firmwareBucket.grantReadWrite(otaRole);
    signedFirmwareBucket.grantReadWrite(otaRole);

    const otaFn = new aws_lambda_nodejs.NodejsFunction(this, 'ota', {
      environment: {
        signingProfileName,
        thingNamePrefix,
        destBucketName: signedFirmwareBucket.bucketName,
        roleArn: otaRole.roleArn,
      },
      initialPolicy: [
        new aws_iam.PolicyStatement({
          actions: ['iot:ListThings', 'iot:CreateOTAUpdate'],
          resources: ['*'],
        }),
        new aws_iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [otaRole.roleArn],
        }),
      ],
    });

    firmwareBucket.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new aws_s3_notifications.LambdaDestination(otaFn)
    );

    this.thingNamePrefix = thingNamePrefix;
    this.publicKey = publicKey;
    this.firmwareBucket = firmwareBucket;
  }
}
