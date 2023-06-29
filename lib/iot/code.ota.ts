// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { S3Event } from 'aws-lambda';
import { Iot } from 'aws-sdk';

const iot = new Iot();

const signingProfileName = process.env.signingProfileName!;
const thingNamePrefix = process.env.thingNamePrefix!;
const destBucketName = process.env.destBucketName!;
const roleArn = process.env.roleArn!;

async function listThingArns(): Promise<string[]> {
  let things: any[] = [];
  let nextToken;
  do {
    const result: any = await iot.listThings({ maxResults: 1, nextToken }).promise();
    nextToken = result.nextToken;
    things = [...things, ...result.things];
  } while (nextToken);

  return things.filter((thing) => thing.thingName.startsWith(thingNamePrefix)).map((thing) => thing.thingArn);
}

export async function handler(event: S3Event): Promise<any> {
  console.log(JSON.stringify(event));

  const [{ s3 }] = event.Records;
  const { bucket, object } = s3;

  const thingArns = await listThingArns();

  const params = {
    otaUpdateId: Date.now().toString(),
    targets: thingArns,
    targetSelection: 'SNAPSHOT',
    files: [
      {
        fileName: object.key.split('/').pop(),
        fileVersion: object.versionId,
        fileLocation: {
          s3Location: {
            bucket: bucket.name,
            key: object.key,
            version: object.versionId,
          },
        },
        codeSigning: {
          startSigningJobParameter: {
            signingProfileName,
            destination: {
              s3Destination: {
                bucket: destBucketName,
              },
            },
          },
        },
      },
    ],
    roleArn,
  };

  const response = await iot.createOTAUpdate(params).promise();
  console.log(JSON.stringify(response));
}
