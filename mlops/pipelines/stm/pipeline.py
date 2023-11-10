"""Example workflow pipeline script for abalone pipeline.

                                               . -ModelStep
                                              .
    Process-> Train -> Evaluate -> Condition .
                                              .
                                               . -(stop)

Implements a get_pipeline(**kwargs) method.
"""
import os
import sys
import boto3
import sagemaker
import sagemaker.session

from sagemaker.estimator import Estimator
from sagemaker.inputs import TrainingInput
from sagemaker.model_metrics import (
    MetricsSource,
    ModelMetrics,
)
from sagemaker.processing import (
    ProcessingInput,
    ProcessingOutput,
    ScriptProcessor,
)
from sagemaker.sklearn.processing import SKLearnProcessor
from sagemaker.workflow.conditions import ConditionGreaterThanOrEqualTo
from sagemaker.workflow.condition_step import (
    ConditionStep,
)
from sagemaker.workflow.functions import JsonGet, Join

from sagemaker.model_metrics import MetricsSource, ModelMetrics
from sagemaker.workflow.step_collections import RegisterModel
from sagemaker.workflow.parameters import (
    ParameterInteger,
    ParameterString,
    ParameterFloat,
)
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.properties import PropertyFile
from sagemaker.workflow.steps import ProcessingStep, TrainingStep
from sagemaker.workflow.model_step import ModelStep
from sagemaker.model import Model
from sagemaker.workflow.pipeline_context import PipelineSession

from sagemaker.tensorflow import TensorFlow
from sagemaker.inputs import TrainingInput
from sagemaker.tensorflow import TensorFlowProcessor
from sagemaker.tensorflow.model import TensorFlowModel
from sagemaker.processing import ProcessingInput, ProcessingOutput

from sagemaker.workflow.steps import CacheConfig
from sagemaker.workflow.execution_variables import ExecutionVariables
from sagemaker.workflow.step_collections import CreateModelStep
from sagemaker.workflow.fail_step import FailStep


BASE_DIR = os.path.dirname(os.path.realpath(__file__))


def get_sagemaker_client(region):
    """Gets the sagemaker client.

    Args:
        region: the aws region to start the session
        default_bucket: the bucket to use for storing the artifacts

    Returns:
        `sagemaker.session.Session instance
    """
    boto_session = boto3.Session(region_name=region)
    sagemaker_client = boto_session.client("sagemaker")
    return sagemaker_client


def get_session(region, default_bucket):
    """Gets the sagemaker session based on the region.

    Args:
        region: the aws region to start the session
        default_bucket: the bucket to use for storing the artifacts

    Returns:
        `sagemaker.session.Session instance
    """

    boto_session = boto3.Session(region_name=region)

    sagemaker_client = boto_session.client("sagemaker")
    runtime_client = boto_session.client("sagemaker-runtime")
    return sagemaker.session.Session(
        boto_session=boto_session,
        sagemaker_client=sagemaker_client,
        sagemaker_runtime_client=runtime_client,
        default_bucket=default_bucket,
    )


def get_pipeline_session(region, default_bucket):
    """Gets the pipeline session based on the region.

    Args:
        region: the aws region to start the session
        default_bucket: the bucket to use for storing the artifacts

    Returns:
        PipelineSession instance
    """

    boto_session = boto3.Session(region_name=region)
    sagemaker_client = boto_session.client("sagemaker")

    return PipelineSession(
        boto_session=boto_session,
        sagemaker_client=sagemaker_client,
        default_bucket=default_bucket,
    )


def get_pipeline_custom_tags(new_tags, region, sagemaker_project_name=None):
    try:
        sm_client = get_sagemaker_client(region)
        response = sm_client.describe_project(ProjectName=sagemaker_project_name)
        sagemaker_project_arn = response["ProjectArn"]
        response = sm_client.list_tags(ResourceArn=sagemaker_project_arn)
        project_tags = response["Tags"]
        for project_tag in project_tags:
            new_tags.append(project_tag)
    except Exception as e:
        print(f"Error getting project tags: {e}")
    return new_tags


def get_pipeline(
    region,
    sagemaker_project_name=None,
    role=None,
    default_bucket=None,
    model_package_group_name="STM32ai",
    pipeline_name="STMicroMLPipeline",
    base_job_prefix="STM32ai",
):
    """Gets a SageMaker ML Pipeline instance working with on abalone data.

    Args:
        region: AWS region to create and run the pipeline.
        role: IAM role to create and run steps and pipeline.
        default_bucket: the bucket to use for storing the artifacts

    Returns:
        an instance of a pipeline
    """

    SRC_DIR = os.environ["CODEBUILD_SRC_DIR"]

    sagemaker_session = get_session(region, default_bucket)
    if role is None:
        role = sagemaker.session.get_execution_role(sagemaker_session)

    pipeline_session = get_pipeline_session(region, default_bucket)

    step_cache_config = CacheConfig(enable_caching=True, expire_after="T12H")

    # parameters for pipeline execution
    model_approval_status = ParameterString(
        name="ModelApprovalStatus", default_value="Approved"
    )
    input_data = ParameterString(
        name="InputDataUrl",
        default_value=f"s3://{default_bucket}/train/",
    )

    train_input_data = ParameterString(
        name="TrainInputDataUrl",
        default_value=f"s3://{default_bucket}/train/",
    )

    processing_instance_type = ParameterString(
        name="ProcessingInstanceType",
        default_value="ml.m5.2xlarge",
    )

    train_instance_type = ParameterString(
        name="TrainInstanceType",
        default_value="ml.m5.2xlarge",
    )

    eval_instance_type = ParameterString(
        name="EvalInstanceType",
        default_value="ml.m5.2xlarge",
    )

    q_clip_level_acc_threshold = ParameterFloat(
        name="q_clip_level_acc_threshold",
        default_value=0.5,
    )

    q_patch_level_acc_threshold = ParameterFloat(
        name="q_patch_level_acc_threshold",
        default_value=0.5,
    )

    stdevcloud_username_secret = ParameterString(
        name="STDevCloudUsernameSecret",
        default_value=os.environ["STDEVCLOUD_USERNAME_SECRET"],
    )

    stdevcloud_password_secret = ParameterString(
        name="STDevCloudPasswordSecret",
        default_value=os.environ["STDEVCLOUD_PASSWORD_SECRET"],
    )

    # ====================================================================
    #  Preprocessing Step
    # ====================================================================

    sklearn_processor = SKLearnProcessor(
        framework_version="0.23-1",
        instance_type=processing_instance_type,
        instance_count=1,
        base_job_name=f"{base_job_prefix}/preprocess",
        sagemaker_session=pipeline_session,
        role=role,
    )
    step_args = sklearn_processor.run(
        outputs=[
            ProcessingOutput(output_name="train", source="/opt/ml/processing/train"),
        ],
        code=os.path.join(BASE_DIR, "preprocess.py"),
        arguments=["--input-data", input_data],
    )
    step_process = ProcessingStep(
        name="PreprocessFSD50K", step_args=step_args, cache_config=step_cache_config
    )

    # ====================================================================
    #  Training Step
    # ====================================================================

    tf2_estimator = TensorFlow(
        entry_point="train.py",
        source_dir=os.path.join(SRC_DIR, "pipelines/stm/stm32ai-modelzoo/"),
        # dependencies=[os.path.join(BASE_DIR, "stm32ai-modelzoo/requirements.txt")],
        role=role,
        instance_count=1,
        instance_type=train_instance_type,
        volume_size=100,
        framework_version="2.8.0",
        sagemaker_session=pipeline_session,
        py_version="py39",
        enable_sagemaker_metrics=True,
        metric_definitions=[
            {
                "Name": "validation:loss",
                "Regex": "loss: ([0-9\\.]+) - accuracy: [0-9\\.]+",
            },
            {
                "Name": "validation:accuracy",
                "Regex": "loss: [0-9\\.]+ - accuracy: ([0-9\\.]+)",
            },
            {
                "Name": "patch:accuracy",
                "Regex": "Patch-level accuracy on test set : ([0-9\\.]+)",
            },
            {
                "Name": "clip:accuracy",
                "Regex": "Clip-level accuracy on test set : ([0-9\\.]+)",
            },
        ],
        environment={
            "STDEVCLOUD_USERNAME_SECRET": stdevcloud_username_secret,
            "STDEVCLOUD_PASSWORD_SECRET": stdevcloud_password_secret,
            "REGION": region,
        },
    )

    step_train = TrainingStep(
        name="TrainTensorFlowModel",
        estimator=tf2_estimator,
        inputs={
            "train": TrainingInput(s3_data=train_input_data)
            # "train": TrainingInput(
            #     s3_data=step_process.properties.ProcessingOutputConfig.Outputs[
            #         "train"
            #     ].S3Output.S3Uri,
            # ),
        },
        cache_config=step_cache_config,
    )

    # ====================================================================
    #  Evaluation Step
    # ====================================================================

    # Initialize the TensorFlowProcessor
    evaluate_model_processor = TensorFlowProcessor(
        framework_version="2.8.0",
        role=role,
        instance_type=eval_instance_type,
        instance_count=1,
        base_job_name=f"{base_job_prefix}/evaluate",
        py_version="py39",
        sagemaker_session=pipeline_session,
        env={
            "EXPERIMENT_NAME": ExecutionVariables.PIPELINE_NAME,
            "RUN_NAME": ExecutionVariables.PIPELINE_EXECUTION_ID,
            "STDEVCLOUD_USERNAME_SECRET": stdevcloud_username_secret,
            "STDEVCLOUD_PASSWORD_SECRET": stdevcloud_password_secret,
            "REGION": region,
        },
    )

    # Run the processing job
    step_args = evaluate_model_processor.run(
        code="evaluate.py",
        source_dir=os.path.join(SRC_DIR, "pipelines/stm/stm32ai-modelzoo/"),
        inputs=[
            ProcessingInput(
                input_name="input",
                source=train_input_data,
                destination="/opt/ml/processing/input",
            ),
            ProcessingInput(
                input_name="model",
                source=step_train.properties.ModelArtifacts.S3ModelArtifacts,
                destination="/opt/ml/processing/input/model",
            ),
        ],
        outputs=[
            ProcessingOutput(
                output_name="evaluation-outputs",
                source="/opt/ml/processing/outputs",
                destination=f"s3://{default_bucket}/evaluation",
            ),
            ProcessingOutput(
                output_name="evaluation", source="/opt/ml/processing/evaluation"
            ),
        ],
    )

    # Create a PropertyFile
    # A PropertyFile is used to be able to reference outputs from a processing step, for instance to use in a condition step.
    # For more information, visit https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-propertyfile.html
    evaluation_report = PropertyFile(
        name="EvaluationReport", output_name="evaluation", path="evaluation.json"
    )

    # Use the evaluate_model_processor in a Sagemaker pipelines ProcessingStep.
    step_eval = ProcessingStep(
        name="Evaluate",
        step_args=step_args,
        property_files=[evaluation_report],
        cache_config=step_cache_config,
    )

    # ====================================================================
    #  Register Step
    # ====================================================================

    # Create ModelMetrics object using the evaluation report from the evaluation step
    # A ModelMetrics object contains metrics captured from a model.
    model_metrics = ModelMetrics(
        model_statistics=MetricsSource(
            s3_uri="{}/evaluation.json".format(
                step_eval.arguments["ProcessingOutputConfig"]["Outputs"][0]["S3Output"][
                    "S3Uri"
                ]
            ),
            content_type="application/json",
        )
    )

    model = TensorFlowModel(
        role=role,
        model_data=step_train.properties.ModelArtifacts.S3ModelArtifacts,
        framework_version="2.8.0",
        sagemaker_session=pipeline_session,
    )

    step_args = model.register(
        content_types=["text/csv"],
        response_types=["text/csv"],
        inference_instances=["ml.m5.2xlarge"],
        transform_instances=["ml.m5.2xlarge"],
        model_package_group_name=model_package_group_name,
        approval_status=model_approval_status,
        model_metrics=model_metrics,
    )

    step_register = ModelStep(
        name="RegisterAbaloneModel",
        step_args=step_args,
    )

    # ====================================================================
    #  Fail Step
    # ====================================================================

    step_fail = FailStep(
        name="FailStep",
        error_message=Join(
            on=" ",
            values=[
                "Execution failed due to clip level acc <",
                q_clip_level_acc_threshold,
                "or",
                "Execution failed due to patch level acc <",
                q_patch_level_acc_threshold,
            ],
        ),
    )

    # ====================================================================
    #  Condition Step
    # ====================================================================

    # Create accuracy condition to ensure the model meets performance requirements.
    # Models with a test accuracy higher than the condition will be registered with the model registry.
    cond_lte_patch = ConditionGreaterThanOrEqualTo(
        left=JsonGet(
            step_name=step_eval.name,
            property_file=evaluation_report,
            json_path="multiclass_classification_metrics.patch_acc.value",
        ),
        right=q_patch_level_acc_threshold,
    )

    cond_lte_clip = ConditionGreaterThanOrEqualTo(
        left=JsonGet(
            step_name=step_eval.name,
            property_file=evaluation_report,
            json_path="multiclass_classification_metrics.clip_acc.value",
        ),
        right=q_clip_level_acc_threshold,
    )

    # Create a Sagemaker Pipelines ConditionStep, using the condition above.
    # Enter the steps to perform if the condition returns True / False.
    step_cond = ConditionStep(
        name="Accuracy-Greater-Than-Threshold-Condition",
        conditions=[cond_lte_patch, cond_lte_clip],
        if_steps=[step_register],
        else_steps=[step_fail],
    )

    # pipeline instance
    pipeline = Pipeline(
        name=pipeline_name,
        parameters=[
            processing_instance_type,
            train_instance_type,
            eval_instance_type,
            q_patch_level_acc_threshold,
            q_clip_level_acc_threshold,
            model_approval_status,
            input_data,
            train_input_data,
            stdevcloud_username_secret,
            stdevcloud_password_secret,
        ],
        steps=[step_process, step_train, step_eval, step_cond],
        sagemaker_session=pipeline_session,
    )
    return pipeline
