// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, CustomResource, custom_resources, aws_lambda_nodejs } from 'aws-cdk-lib';
import generatePayload from './generatePayload';

type TimeStreamDataSourceProps = {
  endpoint: string;
  apiKey: string;
  database: string;
  table: string;
};

export class TimeStreamDataSource extends Construct {
  public readonly id: string;

  constructor(scope: Construct, id: string, props: TimeStreamDataSourceProps) {
    super(scope, id);
    const region = Stack.of(this).region;
    const { endpoint, apiKey, database, table } = props;

    const datasourceProvider = new custom_resources.Provider(this, 'DataSourceProvider', {
      onEventHandler: new aws_lambda_nodejs.NodejsFunction(this, 'handler'),
    });

    const payload = generatePayload({ region, database, table });

    const datasourceCr = new CustomResource(this, 'DataSourceCr', {
      serviceToken: datasourceProvider.serviceToken,
      properties: {
        endpoint,
        apiKey,
        payload: JSON.stringify(payload),
      },
    });
    this.id = datasourceCr.getAttString('id');
  }
}
