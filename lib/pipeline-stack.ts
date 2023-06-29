// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, StackProps, Stage, StageProps, pipelines, aws_logs } from 'aws-cdk-lib';
import { MlStack } from './ml/ml-stack';
import { IotStack } from './iot/iot-stack';

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const config = this.node.tryGetContext('config');

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'StMicroPipeline',
      synth: new pipelines.ShellStep('SynthStep', {
        input: pipelines.CodePipelineSource.connection(config.repo.name, config.repo.branch, {
          connectionArn: config.repo.connectionArn,
        }),
        commands: ['npm ci', 'npm run cdk synth', 'ls'],
      }),
      codeBuildDefaults: {
        logging: {
          cloudWatch: {
            logGroup: new aws_logs.LogGroup(this, `PipelineLogGroup`),
          },
        },
      },
      crossAccountKeys: true,
      dockerEnabledForSynth: true,
      enableKeyRotation: true,
    });

    const mlStage = new MlStage(this, 'MlStage', { env: { ...config.envs.ml } });
    pipeline.addStage(mlStage);

    for (const env of config.envs.iot) {
      const { name, account, region } = env;
      const iotStage = new IotStage(this, 'IotStage-' + name, { env: { account, region } });
      const stage = pipeline.addStage(iotStage);
      if (name === 'prod') {
        stage.addPre(new pipelines.ManualApprovalStep('Approve'));
      }
    }
  }
}

export class MlStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new MlStack(this, 'MlStack');
  }
}

export class IotStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new IotStack(this, 'IotStack');
  }
}
