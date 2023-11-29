import { Construct } from 'constructs';
import { aws_grafana, Duration, aws_iam, aws_secretsmanager, aws_lambda_nodejs } from 'aws-cdk-lib';
import { TimeStreamDataSource } from './datasource/datasource';
import { Dashboard } from './dashboard/dashboard';

type GrafanaProps = {
  timestream: { database: string; table: string };
};

export class Grafana extends Construct {
  public url: string;

  constructor(scope: Construct, id: string, props: GrafanaProps) {
    super(scope, id);
    const { timestream } = props;

    const role = new aws_iam.Role(this, 'WorkspaceRole', {
      assumedBy: new aws_iam.ServicePrincipal('grafana.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTimestreamReadOnlyAccess'),
      ],
    });

    const workspace = new aws_grafana.CfnWorkspace(this, 'Workspace', {
      grafanaVersion: '8.4',
      accountAccessType: 'CURRENT_ACCOUNT',
      authenticationProviders: ['AWS_SSO'],
      permissionType: 'SERVICE_MANAGED',
      dataSources: ['TIMESTREAM'],
      roleArn: role.roleArn,
    });

    const apiKeySecret = new aws_secretsmanager.Secret(this, 'ApiKeySecret', {});
    apiKeySecret.node.addDependency(workspace);
    const rotationFn = new aws_lambda_nodejs.NodejsFunction(this, 'key-rotation', {
      environment: { SECRET_NAME: apiKeySecret.secretName, WORKSPACE_ID: workspace.attrId },
    });
    rotationFn.grantInvoke(new aws_iam.ServicePrincipal('secretsmanager.amazonaws.com'));
    apiKeySecret.grantWrite(rotationFn);
    rotationFn.role?.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSGrafanaAccountAdministrator')
    );

    apiKeySecret.addRotationSchedule('RotationSchedule', {
      rotationLambda: rotationFn,
      automaticallyAfter: Duration.days(29),
      rotateImmediatelyOnUpdate: true,
    });

    const datasource = new TimeStreamDataSource(this, 'TimeStreamDataSource', {
      endpoint: workspace.attrEndpoint,
      apiKeySecret: apiKeySecret,
      database: timestream.database,
      table: timestream.table,
    });

    const dashboard = new Dashboard(this, 'Dashboard', {
      endpoint: workspace.attrEndpoint,
      apiKeySecret: apiKeySecret,
      database: timestream.database,
      table: timestream.table,
      datasourceId: datasource.id,
    });

    this.url = workspace.attrEndpoint;
  }
}
