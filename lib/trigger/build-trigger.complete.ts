// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CodeBuild } from 'aws-sdk';

const codebuild = new CodeBuild();

export async function handler(event: any): Promise<any> {
  console.log(JSON.stringify(event));
  if (event.RequestType === 'Delete') return { IsComplete: true };
  const { buildId } = event;
  const response = await codebuild.batchGetBuilds({ ids: [buildId] }).promise();
  const [{ buildStatus }] = response.builds!;
  if (buildStatus === 'SUCCEEDED') return { IsComplete: true };
  if (buildStatus === 'IN_PROGRESS') return { IsComplete: false };
  throw new Error(`Something went wrong with the build id: ${buildId}, with status: ${buildStatus}`);
}
