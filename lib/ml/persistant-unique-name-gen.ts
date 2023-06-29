// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Names, custom_resources } from 'aws-cdk-lib';

export class PersistantUniqueNameGen extends Construct {
  private getNameCr: custom_resources.AwsCustomResource;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const paramName = Names.uniqueResourceName(this, {});

    const putNameCr = new custom_resources.AwsCustomResource(this, 'PutNameCr', {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: paramName,
          Value: id + '-' + Date.now(),
          Type: 'String',
          Overwrite: false,
        },
        // ignoreErrorCodesMatching: '400',
        physicalResourceId: custom_resources.PhysicalResourceId.of('PutName'),
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: paramName,
        },
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const getNameCr = new custom_resources.AwsCustomResource(this, 'GetNameCr', {
      onCreate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: {
          Name: paramName,
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of('GetName'),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    getNameCr.node.addDependency(putNameCr);

    this.getNameCr = getNameCr;
  }

  uniqueName() {
    return this.getNameCr.getResponseField('Parameter.Value');
  }
}
