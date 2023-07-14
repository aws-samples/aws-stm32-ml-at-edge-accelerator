import { Construct } from 'constructs';
import { aws_grafana, custom_resources, aws_iam } from 'aws-cdk-lib';
import { TimeStreamDataSource } from './datasource/datasource';
import { Dashboard } from './dashboard/dashboard';

type GrafanaProps = {
  timestream: { database: string; table: string };
};

export class Grafana extends Construct {
  constructor(scope: Construct, id: string, props: GrafanaProps) {
    super(scope, id);
    const { timestream } = props;

    const role = new aws_iam.Role(this, 'WorkspaceRole', {
      assumedBy: new aws_iam.ServicePrincipal('grafana.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTimestreamReadOnlyAccess'),
        // aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    const workspace = new aws_grafana.CfnWorkspace(this, 'Workspace', {
      accountAccessType: 'CURRENT_ACCOUNT',
      authenticationProviders: ['AWS_SSO'],
      permissionType: 'SERVICE_MANAGED',
      dataSources: ['TIMESTREAM'],
      roleArn: role.roleArn,
    });

    const apiKeyCr = new custom_resources.AwsCustomResource(this, 'ApiKeyCr', {
      onUpdate: {
        service: 'Grafana',
        action: 'createWorkspaceApiKey',
        parameters: {
          workspaceId: workspace.attrId,
          keyName: 'key-' + Date.now(),
          keyRole: 'ADMIN',
          secondsToLive: 60 * 60,
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of(Date.now().toString()),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const datasource = new TimeStreamDataSource(this, 'TimeStreamDataSource', {
      endpoint: workspace.attrEndpoint,
      apiKey: apiKeyCr.getResponseField('key'),
      database: timestream.database,
      table: timestream.table,
    });

    new Dashboard(this, 'Dashboard', {
      endpoint: workspace.attrEndpoint,
      apiKey: apiKeyCr.getResponseField('key'),
      database: timestream.database,
      table: timestream.table,
      datasourceId: datasource.id,
    });
  }
}
