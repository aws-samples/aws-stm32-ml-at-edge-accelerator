// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Names, aws_iotanalytics, aws_iam, aws_iot } from 'aws-cdk-lib';

export class Analytics extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const channel = new aws_iotanalytics.CfnChannel(this, 'Channel', { channelName: Names.uniqueResourceName(this, {}) });
    const datastore = new aws_iotanalytics.CfnDatastore(this, 'Datastore', { datastoreName: Names.uniqueResourceName(this, {}) });
    const pipeline = new aws_iotanalytics.CfnPipeline(this, 'Pipeline', {
      pipelineActivities: [
        {
          channel: {
            name: 'channelActivity',
            channelName: channel.channelName!,
            next: 'storeActivity',
          },
        },
        {
          datastore: {
            name: 'storeActivity',
            datastoreName: datastore.datastoreName!,
          },
        },
      ],
    });
    pipeline.node.addDependency(channel);
    pipeline.node.addDependency(datastore);

    const role = new aws_iam.Role(this, 'IotRole', {
      assumedBy: new aws_iam.ServicePrincipal('iot.amazonaws.com'),
      managedPolicies: [aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTAnalyticsFullAccess')],
    });

    const topicRule = new aws_iot.CfnTopicRule(this, 'TopicRule', {
      topicRulePayload: {
        awsIotSqlVersion: '2016-03-23',
        sql: "SELECT *, parse_time(\"yyyy-MM-dd'T'HH:mm:ss.SSSZ\", timestamp() ) as ts FROM '+/mic_sensor_data'",
        actions: [
          {
            iotAnalytics: {
              channelName: channel.channelName!,
              roleArn: role.roleArn,
            },
          },
        ],
      },
    });
    topicRule.node.addDependency(channel);
    topicRule.node.addDependency(role);

    const dataset = new aws_iotanalytics.CfnDataset(this, 'Dataset', {
      datasetName: Names.uniqueResourceName(this, {}),
      actions: [
        {
          actionName: 'queryAction',
          queryAction: {
            sqlQuery: `select * from ${datastore.datastoreName}`,
          },
        },
      ],
      triggers: [
        {
          schedule: {
            scheduleExpression: 'rate(1 minute)',
          },
        },
      ],
    });
    dataset.node.addDependency(datastore);
  }
}
