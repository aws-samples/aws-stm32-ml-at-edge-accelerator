// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { SecretsManager, Grafana } from 'aws-sdk';

const secretName = process.env.SECRET_NAME!;
const workspaceId = process.env.WORKSPACE_ID!;

const secretsmanager = new SecretsManager();
const grafana = new Grafana();

export async function handler(event: any): Promise<any> {
  console.log(JSON.stringify(event));
  const { key } = await grafana
    .createWorkspaceApiKey({
      workspaceId,
      keyName: 'key-' + Date.now(),
      keyRole: 'ADMIN',
      secondsToLive: 30 * 24 * 60 * 60,
    })
    .promise();

  await secretsmanager
    .putSecretValue({
      SecretId: secretName,
      SecretString: key,
    })
    .promise();
}
