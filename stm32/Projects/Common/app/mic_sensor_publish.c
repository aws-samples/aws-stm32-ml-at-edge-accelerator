/*
 * Copyright (C) 2021 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
 * Derived from simple_sub_pub_demo.c
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * https://www.FreeRTOS.org
 * https://github.com/FreeRTOS
 *
 */

#include "logging_levels.h"
/* define LOG_LEVEL here if you want to modify the logging level from the default */

#define LOG_LEVEL LOG_DEBUG

#include "logging.h"

/* Standard includes. */
#include <string.h>
#include <stdio.h>

/* Kernel includes. */
#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"

#include "kvstore.h"

/* MQTT library includes. */
#include "core_mqtt.h"
#include "core_mqtt_agent.h"
#include "sys_evt.h"

/* Subscription manager header include. */
#include "subscription_manager.h"

/* Sensor includes */
#include "b_u585i_iot02a_audio.h"

/* Preprocessing includes */
#include "preproc_dpu.h"

/* AI includes */
#include "ai_dpu.h"

extern UBaseType_t uxRand(void);

#define MQTT_PUBLISH_MAX_LEN (512)
#define MQTT_PUBLISH_TIME_BETWEEN_MS (5000)
#define MQTT_PUBLISH_TOPIC "mic_sensor_data"
#define MQTT_PUBLICH_TOPIC_STR_LEN (256)
#define MQTT_PUBLISH_BLOCK_TIME_MS (1000)
#define MQTT_PUBLISH_NOTIFICATION_WAIT_MS (1000)

#define MQTT_NOTIFY_IDX (1)
#define MQTT_PUBLISH_QOS (MQTTQoS0)

#define MIC_EVT_DMA_HALF (1 << 0)
#define MIC_EVT_DMA_CPLT (1 << 1)

/**
 * @brief Defines the structure to use as the command callback context in this
 * demo.
 */
struct MQTTAgentCommandContext
{
	MQTTStatus_t xReturnStatus;
	TaskHandle_t xTaskToNotify;
};

/* Private variables ---------------------------------------------------------*/
static uint8_t pucAudioBuff[AUDIO_BUFF_SIZE];
static int8_t pcSpectroGram[CTRL_X_CUBE_AI_SPECTROGRAM_COL * CTRL_X_CUBE_AI_SPECTROGRAM_NMEL];
static float32_t pfAIOutput[AI_NETWORK_OUT_1_SIZE];

/**
 * Specifies the labels for the classes of the demo.
 */
static const char *sAiClassLabels[CTRL_X_CUBE_AI_MODE_CLASS_NUMBER] = CTRL_X_CUBE_AI_MODE_CLASS_LIST;
/**
 * DPUs context
 */
static AudioProcCtx_t xAudioProcCtx;
static AIProcCtx_t xAIProcCtx;
/**
 * Microphone task handle
 */
static TaskHandle_t xMicTask;

/*-----------------------------------------------------------*/
static void prvPublishCommandCallback(MQTTAgentCommandContext_t *pxCommandContext,
									  MQTTAgentReturnInfo_t *pxReturnInfo)
{
	configASSERT(pxCommandContext != NULL);
	configASSERT(pxReturnInfo != NULL);

	pxCommandContext->xReturnStatus = pxReturnInfo->returnCode;

	if (pxCommandContext->xTaskToNotify != NULL)
	{
		/* Send the context's ulNotificationValue as the notification value so
		 * the receiving task can check the value it set in the context matches
		 * the value it receives in the notification. */
		(void)xTaskNotifyGiveIndexed(pxCommandContext->xTaskToNotify,
									 MQTT_NOTIFY_IDX);
	}
}

/*-----------------------------------------------------------*/

static BaseType_t prvPublishAndWaitForAck(MQTTAgentHandle_t xAgentHandle,
										  const char *pcTopic,
										  const void *pvPublishData,
										  size_t xPublishDataLen)
{
	BaseType_t xResult = pdFALSE;
	MQTTStatus_t xStatus;

	configASSERT(pcTopic != NULL);
	configASSERT(pvPublishData != NULL);
	configASSERT(xPublishDataLen > 0);

	MQTTPublishInfo_t xPublishInfo =
		{
			.qos = MQTT_PUBLISH_QOS,
			.retain = 0,
			.dup = 0,
			.pTopicName = pcTopic,
			.topicNameLength = (uint16_t)strlen(pcTopic),
			.pPayload = pvPublishData,
			.payloadLength = xPublishDataLen};

	MQTTAgentCommandContext_t xCommandContext =
		{
			.xTaskToNotify = xTaskGetCurrentTaskHandle(),
			.xReturnStatus = MQTTIllegalState,
		};

	MQTTAgentCommandInfo_t xCommandParams =
		{
			.blockTimeMs = MQTT_PUBLISH_BLOCK_TIME_MS,
			.cmdCompleteCallback = prvPublishCommandCallback,
			.pCmdCompleteCallbackContext = &xCommandContext,
		};

	/* Clear the notification index */
	xTaskNotifyStateClearIndexed(NULL, MQTT_NOTIFY_IDX);

	xStatus = MQTTAgent_Publish(xAgentHandle,
								&xPublishInfo,
								&xCommandParams);

	if (xStatus == MQTTSuccess)
	{
		xResult = ulTaskNotifyTakeIndexed(MQTT_NOTIFY_IDX,
										  pdTRUE,
										  pdMS_TO_TICKS(MQTT_PUBLISH_NOTIFICATION_WAIT_MS));

		if (xResult == 0)
		{
			LogError("Timed out while waiting for publish ACK or Sent event. xTimeout = %d",
					 pdMS_TO_TICKS(MQTT_PUBLISH_NOTIFICATION_WAIT_MS));
			xResult = pdFALSE;
		}
		else if (xCommandContext.xReturnStatus != MQTTSuccess)
		{
			LogError("MQTT Agent returned error code: %d during publish operation.",
					 xCommandContext.xReturnStatus);
			xResult = pdFALSE;
		}
	}
	else
	{
		LogError("MQTTAgent_Publish returned error code: %d.",
				 xStatus);
	}

	return xResult;
}

static BaseType_t xIsMqttConnected(void)
{
	/* Wait for MQTT to be connected */
	EventBits_t uxEvents = xEventGroupWaitBits(xSystemEvents,
											   EVT_MASK_MQTT_CONNECTED,
											   pdFALSE,
											   pdTRUE,
											   0);

	return ((uxEvents & EVT_MASK_MQTT_CONNECTED) == EVT_MASK_MQTT_CONNECTED);
}

/* CRC init function */
static void CRC_Init(void)
{
	CRC_HandleTypeDef hcrc;
	hcrc.Instance = CRC;
	hcrc.Init.DefaultPolynomialUse = DEFAULT_POLYNOMIAL_ENABLE;
	hcrc.Init.DefaultInitValueUse = DEFAULT_INIT_VALUE_ENABLE;
	hcrc.Init.InputDataInversionMode = CRC_INPUTDATA_INVERSION_NONE;
	hcrc.Init.OutputDataInversionMode = CRC_OUTPUTDATA_INVERSION_DISABLE;
	hcrc.InputDataFormat = CRC_INPUTDATA_FORMAT_BYTES;
	__HAL_RCC_CRC_CLK_ENABLE();
	if (HAL_CRC_Init(&hcrc) != HAL_OK)
	{
		LogError("CRC Init Error");
	}
}

static BaseType_t xInitSensors(void)
{
	int32_t lBspError = BSP_ERROR_NONE;

	BSP_AUDIO_Init_t AudioInit;

	/* Select device depending on the Instance */
	AudioInit.Device = AUDIO_IN_DEVICE_DIGITAL_MIC1;
	AudioInit.SampleRate = AUDIO_FREQUENCY_16K;
	AudioInit.BitsPerSample = AUDIO_RESOLUTION_16B;
	AudioInit.ChannelsNbr = 1;
	AudioInit.Volume = 100; /* Not used */
	lBspError = BSP_AUDIO_IN_Init(0, &AudioInit);
	return (lBspError == BSP_ERROR_NONE ? pdTRUE : pdFALSE);
}

void vMicSensorPublishTask(void *pvParameters)
{
	BaseType_t xResult = pdFALSE;
	BaseType_t xExitFlag = pdFALSE;
	char payloadBuf[MQTT_PUBLISH_MAX_LEN];
	MQTTAgentHandle_t xAgentHandle = NULL;
	char pcTopicString[MQTT_PUBLICH_TOPIC_STR_LEN] = {0};
	size_t uxTopicLen = 0;
	uint32_t ulNotifiedValue = 0;

	(void)pvParameters; /* unused parameter */

	/**
	 * Initialize the CRC IP required by X-CUBE-AI.
	 * Must be called before any usage of the ai library API.
	 */
	CRC_Init();

	/**
	 * get task handle for notifications
	 */
	xMicTask = xTaskGetCurrentTaskHandle();

	xResult = xInitSensors();

	if (xResult != pdTRUE)
	{
		LogError("Error while Audio sensor.");
		vTaskDelete(NULL);
	}

	xResult = PreProc_DPUInit(&xAudioProcCtx);

	if (xResult != pdTRUE)
	{
		LogError("Error while initializing Preprocessing.");
		vTaskDelete(NULL);
	}

	/**
	 * get the AI model
	 */
	AiDPULoadModel(&xAIProcCtx, "network");

	/**
	 * transfer quantization parametres included in AI model to the Audio DPU
	 */
	xAudioProcCtx.output_Q_offset = xAIProcCtx.input_Q_offset;
	xAudioProcCtx.output_Q_inv_scale = xAIProcCtx.input_Q_inv_scale;

	uxTopicLen = KVStore_getString(CS_CORE_THING_NAME, pcTopicString, MQTT_PUBLICH_TOPIC_STR_LEN);

	if (uxTopicLen > 0)
	{
		uxTopicLen = strlcat(pcTopicString, "/" MQTT_PUBLISH_TOPIC, MQTT_PUBLICH_TOPIC_STR_LEN);
	}

	if ((uxTopicLen == 0) || (uxTopicLen >= MQTT_PUBLICH_TOPIC_STR_LEN))
	{
		LogError("Failed to construct topic string.");
		xExitFlag = pdTRUE;
	}
	vSleepUntilMQTTAgentReady();

	xAgentHandle = xGetMqttAgentHandle();

	LogDebug("start audio");
	if (BSP_AUDIO_IN_Record(0, pucAudioBuff, AUDIO_BUFF_SIZE) != BSP_ERROR_NONE)
	{
		LogError("AUDIO IN : FAILED.\n");
	}

	while (xExitFlag == pdFALSE)
	{
		TimeOut_t xTimeOut;
		vTaskSetTimeOutState(&xTimeOut);

		if (xTaskNotifyWait(0, 0xFFFFFFFF, &ulNotifiedValue, portMAX_DELAY) == pdTRUE)
		{
			/**
			 * Audio pre-processing on audio half buffer
			 */
			if (ulNotifiedValue & MIC_EVT_DMA_HALF)
				PreProc_DPU(&xAudioProcCtx, pucAudioBuff, pcSpectroGram);
			if (ulNotifiedValue & MIC_EVT_DMA_CPLT)
				PreProc_DPU(&xAudioProcCtx, pucAudioBuff + AUDIO_HALF_BUFF_SIZE, pcSpectroGram);

			/**
			 * AI processing
			 */
			AiDPUProcess(&xAIProcCtx, pcSpectroGram, pfAIOutput);
		}
		size_t bytesWritten = 0;
		if (xAudioProcCtx.S_Spectr.spectro_sum > CTRL_X_CUBE_AI_SPECTROGRAM_SILENCE_THR)
		{
			/**
			 * if not silence frame
			 */
			float max_out = pfAIOutput[0];
			uint32_t max_idx = 0;
			for (uint32_t i = 1; i < CTRL_X_CUBE_AI_MODE_CLASS_NUMBER; i++)
			{
				if (pfAIOutput[i] > max_out)
				{
					max_idx = i;
					max_out = pfAIOutput[i];
				}
			}
			/* Write to */
			bytesWritten = snprintf(payloadBuf, (size_t)MQTT_PUBLISH_MAX_LEN,
									"{\"class\":\"%s\", \"confidence\": \"%d\"}", sAiClassLabels[max_idx], (int)(100 * max_out));

			LogInfo("%s", payloadBuf);
			if (xIsMqttConnected() == pdTRUE)
			{
				if (bytesWritten < MQTT_PUBLISH_MAX_LEN)
				{
					xResult = prvPublishAndWaitForAck(xAgentHandle,
													  pcTopicString,
													  payloadBuf,
													  bytesWritten);
				}
				else if (bytesWritten > 0)
				{
					LogError("Not enough buffer space.");
				}
				else
				{
					LogError("MQTT Publish call failed.");
				}

				if (xResult == pdTRUE)
				{
					LogDebug(payloadBuf);
				}
			}
		}
		xAudioProcCtx.S_Spectr.spectro_sum = 0;
	}
}

/**
 * @brief  Manage the BSP audio in half transfer complete event.
 * @param  Instance Audio in instance.
 * @retval None.
 */

void BSP_AUDIO_IN_HalfTransfer_CallBack(uint32_t Instance)
{
	(void)Instance;
	assert_param(Instance == 0);
	BaseType_t xHigherPriorityTaskWoken = pdFALSE;
	BaseType_t rslt = pdFALSE;
	rslt = xTaskNotifyFromISR(xMicTask,
							  MIC_EVT_DMA_HALF,
							  eSetBits,
							  &xHigherPriorityTaskWoken);
	configASSERT(rslt == pdTRUE);
	portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

/**
 * @brief  Manage the BSP audio in transfer complete event.
 * @param  Instance Audio in instance.
 * @retval None.
 */
void BSP_AUDIO_IN_TransferComplete_CallBack(uint32_t Instance)
{
	(void)Instance;
	assert_param(Instance == 0);
	BaseType_t xHigherPriorityTaskWoken = pdFALSE;
	BaseType_t rslt = pdFALSE;
	rslt = xTaskNotifyFromISR(xMicTask,
							  MIC_EVT_DMA_CPLT,
							  eSetBits,
							  &xHigherPriorityTaskWoken);
	configASSERT(rslt == pdTRUE);
	portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}
