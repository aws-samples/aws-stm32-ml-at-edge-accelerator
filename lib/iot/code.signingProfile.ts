// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Signer } from 'aws-sdk';
import { CloudFormationCustomResourceEvent } from 'aws-lambda';

const signer = new Signer();

export async function handler(event: CloudFormationCustomResourceEvent): Promise<any> {
  console.log(JSON.stringify(event));
  const { certificateArn, codeSigningLabel, platformId } = event.ResourceProperties;
  switch (event.RequestType) {
    case 'Create': {
      const profileName = 'stmicro_profile_' + Date.now();
      await signer
        .putSigningProfile({
          platformId,
          profileName,
          signingMaterial: {
            certificateArn,
          },
          signingParameters: {
            certname: codeSigningLabel,
          },
        })
        .promise();

      return {
        PhysicalResourceId: profileName,
        Data: {
          profileName,
        },
      };
    }
    case 'Delete': {
      const profileName = event.PhysicalResourceId;
      await signer.cancelSigningProfile({ profileName }).promise();
      return {};
    }

    default:
  }
}
