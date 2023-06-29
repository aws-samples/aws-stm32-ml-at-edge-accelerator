// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Sagmaker } from './sagemaker';
import { SagmakerPipeline } from './sagemaker-pipeline';

export class MlStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const { project } = new Sagmaker(this, 'Sagmaker');
    new SagmakerPipeline(this, 'SagemakerPipeline', { project });
  }
}
