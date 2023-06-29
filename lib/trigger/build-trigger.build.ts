// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CodeBuild } from 'aws-sdk';
import { CloudFormationCustomResourceEvent } from 'aws-lambda';

const codebuild = new CodeBuild();

export async function handler(event: CloudFormationCustomResourceEvent): Promise<any> {
  console.log(JSON.stringify(event));
  const { projectName } = event.ResourceProperties;
  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      const { build } = await codebuild.startBuild({ projectName }).promise();
      const id = build?.id;
      return {
        buildId: id,
      };
    default:
  }
}
