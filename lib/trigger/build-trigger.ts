// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import {
  aws_codebuild,
  aws_iam,
  aws_lambda_nodejs,
  CustomResource,
  custom_resources,
  Duration,
} from 'aws-cdk-lib';

type BuildTriggerProps = {
  buildProject: aws_codebuild.Project;
  state?: any;
};

export class BuildTrigger extends Construct {
  constructor(scope: Construct, id: string, props: BuildTriggerProps) {
    super(scope, id);
    const { buildProject, state = '' } = props;

    const buildPolicy = new aws_iam.PolicyStatement({
      actions: ['codebuild:StartBuild', 'codebuild:batchGetBuilds'],
      resources: [buildProject.projectArn],
    });
    const buildProvidor = new custom_resources.Provider(this, 'BuildProvider', {
      onEventHandler: new aws_lambda_nodejs.NodejsFunction(this, 'build', {
        initialPolicy: [buildPolicy],
      }),
      isCompleteHandler: new aws_lambda_nodejs.NodejsFunction(this, 'complete', {
        environment: {
          projectName: buildProject.projectName,
        },
        initialPolicy: [buildPolicy],
      }),
      queryInterval: Duration.minutes(1),
      totalTimeout: Duration.minutes(60),
    });

    const buildCr = new CustomResource(this, 'BuildCr', {
      serviceToken: buildProvidor.serviceToken,
      properties: {
        projectName: buildProject.projectName,
        state,
      },
    });
  }
}
