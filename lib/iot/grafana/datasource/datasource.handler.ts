// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { SecretsManager } from 'aws-sdk';
import {
  CdkCustomResourceHandler,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from 'aws-lambda';
import axios from 'axios';

const secretsmanager = new SecretsManager();

export const handler: CdkCustomResourceHandler = async (event) => {
  const { RequestType, ResourceProperties } = event;
  const { endpoint, apiKeySecretName } = ResourceProperties;

  const { SecretString: apiKey } = await secretsmanager
    .getSecretValue({ SecretId: apiKeySecretName })
    .promise();

  const url = 'https://' + endpoint;
  const configs = { headers: { Authorization: 'Bearer ' + apiKey } };
  const payload = JSON.parse(ResourceProperties.payload);

  switch (RequestType) {
    case 'Create': {
      const { data } = await axios.post(url + '/api/datasources', payload, configs);
      const id = data.datasource.id.toString();
      return { PhysicalResourceId: id, Data: { id } };
    }
    case 'Update':
      const { PhysicalResourceId } = event as CloudFormationCustomResourceUpdateEvent;
      await axios.put(url + '/api/datasources/' + PhysicalResourceId, payload, configs);
      return { Data: { id: PhysicalResourceId } };
    case 'Delete': {
      const { PhysicalResourceId } = event as CloudFormationCustomResourceDeleteEvent;
      axios.delete(url + '/api/datasources/' + PhysicalResourceId, configs).catch(() => {});
      return {};
    }
    default:
      throw new Error('Invalid Request Type');
  }
};
