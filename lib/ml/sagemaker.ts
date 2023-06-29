// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import {
  CfnParameter,
  Names,
  Stack,
  aws_iam,
  aws_sagemaker,
  aws_servicecatalog,
  aws_ec2,
} from 'aws-cdk-lib';
import { PersistantUniqueNameGen } from './persistant-unique-name-gen';

export class Sagmaker extends Construct {
  project: aws_sagemaker.CfnProject;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { account, region } = Stack.of(this);

    const serviceCatalogLaunchRole = new aws_iam.Role(this, 'ServiceCatalogLaunchRole', {
      assumedBy: new aws_iam.ServicePrincipal('servicecatalog.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSageMakerAdmin-ServiceCatalogProductsServiceRolePolicy'
        ),
      ],
    });

    const portfolio = new aws_servicecatalog.Portfolio(this, 'Portfolio', {
      displayName: Names.uniqueResourceName(this, {}),
      providerName: 'Providor',
    });
    portfolio.giveAccessToRole(
      aws_iam.Role.fromRoleName(
        this,
        'cdkExecRole',
        `cdk-${this.node.tryGetContext(
          '@aws-cdk/core:bootstrapQualifier'
        )}-cfn-exec-role-${account}-${region}`
      )
    );

    const product = new aws_servicecatalog.CloudFormationProduct(this, 'Product', {
      productName: Names.uniqueResourceName(this, {}),
      owner: 'Owner',
      productVersions: [
        {
          productVersionName: 'v1',
          cloudFormationTemplate: aws_servicecatalog.CloudFormationTemplate.fromProductStack(
            new ServiceCatalogProduct(this, 'ServiceCatalogProduct')
          ),
        },
      ],
    });
    portfolio.addProduct(product);
    portfolio.setLaunchRole(product, serviceCatalogLaunchRole);

    const vpc = aws_ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });
    const sagemakerDomainRole = new aws_iam.Role(this, 'SagemakerDomainRole', {
      assumedBy: new aws_iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });
    const sagemakerDomain = new aws_sagemaker.CfnDomain(this, 'SagemakerDomain', {
      authMode: 'IAM',
      defaultUserSettings: { executionRole: sagemakerDomainRole.roleArn },
      domainName: 'stmicro',
      vpcId: vpc.vpcId,
      subnetIds: [vpc.publicSubnets[0].subnetId],
    });
    portfolio.giveAccessToRole(sagemakerDomainRole);

    const userProfile = new aws_sagemaker.CfnUserProfile(this, 'UserProfile', {
      domainId: sagemakerDomain.attrDomainId,
      userProfileName: Names.uniqueResourceName(this, {}),
    });
    userProfile.addDependency(sagemakerDomain);

    const project = new aws_sagemaker.CfnProject(this, 'Project', {
      projectName: new PersistantUniqueNameGen(this, 'StmProject').uniqueName(),
      serviceCatalogProvisioningDetails: { ProductId: product.productId },
    });
    project.node.addDependency(portfolio);
    project.node.addDependency(product);
    project.node.addDependency(userProfile);
    project.node.addDependency(sagemakerDomain);
    project.node.addDependency(sagemakerDomainRole);

    const sagemakerApp = new aws_sagemaker.CfnApp(this, 'SagemakerApp', {
      appName: 'default',
      appType: 'JupyterServer',
      domainId: sagemakerDomain.attrDomainId,
      userProfileName: userProfile.userProfileName,
    });
    sagemakerApp.addDependency(sagemakerDomain);
    sagemakerApp.addDependency(userProfile);

    this.project = project;
  }
}

class ServiceCatalogProduct extends aws_servicecatalog.ProductStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new CfnParameter(this, 'SageMakerProjectName', {
      type: 'String',
      description: 'Name of Project',
    });
    new CfnParameter(this, 'SageMakerProjectId', {
      type: 'String',
      description: 'Service generated Id of the project',
    });
  }
}
