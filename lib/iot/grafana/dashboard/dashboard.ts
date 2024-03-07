// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { aws_secretsmanager, CustomResource, custom_resources, aws_lambda_nodejs } from 'aws-cdk-lib';
import generatePayload from './generatePayload';

type DashboardProps = {
  endpoint: string;
  apiKeySecret: aws_secretsmanager.ISecret;
  datasourceId: string;
  database: string;
  table: string;
};

export class Dashboard extends Construct {
  public readonly id: string;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: DashboardProps) {
    super(scope, id);
    const { endpoint, apiKeySecret, ...payloadProps } = props;

    const onEventHandler = new aws_lambda_nodejs.NodejsFunction(this, 'handler');
    apiKeySecret.grantRead(onEventHandler);
    const dashboardProvider = new custom_resources.Provider(this, 'DashboardProvider', {
      onEventHandler,
    });

    const mlConfig = parse(readFileSync('mlops/pipelines/stm/stm32ai-modelzoo/audio_event_detection/scripts/training/user_config.yaml', 'utf8'));
    const colorMappings = mlConfig.dataset.class_names.reduce((mapping: any, className: string, i: number) => {
      const randomColor = Math.floor(Math.random() * 16777215).toString(16);
      mapping[className] = { index: i, color: '#' + randomColor };
      return mapping;
    }, {});

    const payload = generatePayload({ ...payloadProps, colorMappings });

    const dashboardCr = new CustomResource(this, 'DashboardCr', {
      serviceToken: dashboardProvider.serviceToken,
      properties: {
        endpoint,
        apiKeySecretName: apiKeySecret.secretName,
        payload: JSON.stringify(payload),
      },
    });
    this.url = dashboardCr.getAttString('url');
  }
}
