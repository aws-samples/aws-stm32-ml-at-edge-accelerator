// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Names, custom_resources, aws_iam } from 'aws-cdk-lib';

export class PersistantUniqueNameGen extends Construct {
  private getNameCr: custom_resources.AwsCustomResource;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const role = new aws_iam.Role(this, 'CrRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess')],
    });

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
        physicalResourceId: custom_resources.PhysicalResourceId.of('PutName'),
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: paramName,
        },
      },
      role,
    });

    const getNameCr = new custom_resources.AwsCustomResource(this, 'GetNameCr', {
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: {
          Name: paramName,
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of('GetName'),
      },
      role,
    });
    getNameCr.node.addDependency(putNameCr);

    this.getNameCr = getNameCr;
  }

  uniqueName() {
    return this.getNameCr.getResponseField('Parameter.Value');
  }
}
