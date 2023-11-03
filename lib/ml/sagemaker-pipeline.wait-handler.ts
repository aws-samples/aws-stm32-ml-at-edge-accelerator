import { CodeBuild, SSM } from 'aws-sdk';

const codebuild = new CodeBuild();
const ssm = new SSM();

const { assetHash, projectName, paramName, waitCompletionUrl }: any = process.env;

exports.handler = async (event: any) => {
  console.log(JSON.stringify(event));

  const detail = event.detail;
  const status = detail && detail['build-status'];
  if (status) {
    return await fetch(waitCompletionUrl, {
      method: 'PUT',
      body: JSON.stringify({
        Status: (
          {
            SUCCEEDED: 'SUCCESS',
            FAILED: 'FAILURE',
          } as any
        )[status],
        UniqueId: '1',
      }),
    });
  }

  const param = await ssm.getParameter({ Name: paramName }).promise();
  const previousAssetHash = param.Parameter?.Value;

  if (assetHash === previousAssetHash) {
    return await fetch(waitCompletionUrl, {
      method: 'PUT',
      body: JSON.stringify({
        Status: 'SUCCESS',
        UniqueId: '1',
      }),
    });
  }

  await ssm.putParameter({ Name: paramName, Value: assetHash, Overwrite: true }).promise();
  await codebuild.startBuild({ projectName }).promise();
};
