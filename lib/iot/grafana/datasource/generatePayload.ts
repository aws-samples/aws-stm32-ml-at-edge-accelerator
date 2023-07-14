// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

type Config = {
  region: string;
  database: string;
  table: string;
};

export default (config: Config) => ({
  name: 'Amazon Timestream',
  type: 'grafana-timestream-datasource',
  typeName: 'Amazon Timestream',
  access: 'proxy',
  basicAuth: false,
  isDefault: true,
  jsonData: {
    authType: 'ec2_iam_role',
    defaultDatabase: config.database,
    defaultMeasure: 'class',
    defaultRegion: config.region,
    defaultTable: config.table,
  },
});
