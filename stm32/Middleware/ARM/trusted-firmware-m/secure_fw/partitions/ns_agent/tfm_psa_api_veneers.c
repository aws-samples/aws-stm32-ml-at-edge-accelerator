/*
 * Copyright (c) 2018-2021, Arm Limited. All rights reserved.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 */

#include <stdbool.h>
#include <stdio.h>
#include "config_impl.h"
#include "security_defs.h"
#include "svc_num.h"
#include "utilities.h"
#include "tfm_arch.h"
#include "tfm_psa_call_pack.h"
#include "tfm_secure_api.h"

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
#include "spm_ipc.h"
#include "ffm/psa_api.h"
#endif

/*
 * Use assembly to:
 * - Explicit stack usage to perform re-entrant detection.
 * - SVC here to take hardware context management advantages.
 */

#if defined(__ICCARM__)

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL

#pragma required = tfm_spm_client_psa_framework_version
#pragma required = tfm_spm_client_psa_version
#pragma required = tfm_spm_client_psa_connect
#pragma required = tfm_spm_client_psa_call
#pragma required = tfm_spm_client_psa_close
#pragma required = spm_interface_thread_dispatcher

#endif /* CONFIG_TFM_PSA_API_THREAD_CALL */

#endif

__tfm_psa_secure_gateway_attributes__
uint32_t tfm_psa_framework_version_veneer(void)
{
    __ASM volatile(
#if !defined(__ICCARM__)
        ".syntax unified                                      \n"
#endif

#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "   ldr    r2, [sp]                                   \n"
        "   ldr    r3, ="M2S(STACK_SEAL_PATTERN)"             \n"
        "   cmp    r2, r3                                     \n"
        "   bne    reent_panic1                               \n"
#endif

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
        "   push   {r0-r4, lr}                                \n"
        "   ldr    r0, =tfm_spm_client_psa_framework_version  \n"
        "   mov    r1, sp                                     \n"
        "   movs   r2, #0                                     \n"
        "   bl     spm_interface_thread_dispatcher            \n"
        "   pop    {r0-r3}                                    \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#elif defined(CONFIG_TFM_PSA_API_SFN_CALL)
        "   push   {r4, lr}                                   \n"
        "   bl     psa_framework_version_sfn                  \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#else
        "   svc    "M2S(TFM_SVC_PSA_FRAMEWORK_VERSION)"       \n"
#endif

        "   bxns   lr                                         \n"
#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "reent_panic1:                                        \n"
        "   svc    "M2S(TFM_SVC_PSA_PANIC)"                   \n"
        "   b      .                                          \n"
#endif
    );
}

__tfm_psa_secure_gateway_attributes__
uint32_t tfm_psa_version_veneer(uint32_t sid)
{
    __ASM volatile(
#if !defined(__ICCARM__)
        ".syntax unified                                      \n"
#endif

#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "   ldr    r2, [sp]                                   \n"
        "   ldr    r3, ="M2S(STACK_SEAL_PATTERN)"             \n"
        "   cmp    r2, r3                                     \n"
        "   bne    reent_panic2                               \n"
#endif

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
        "   push   {r0-r4, lr}                                \n"
        "   ldr    r0, =tfm_spm_client_psa_version            \n"
        "   mov    r1, sp                                     \n"
        "   movs   r2, #0                                     \n"
        "   bl     spm_interface_thread_dispatcher            \n"
        "   pop    {r0-r3}                                    \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#elif defined(CONFIG_TFM_PSA_API_SFN_CALL)
        "   push   {r4, lr}                                   \n"
        "   bl     psa_version_sfn                            \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#else
        "   svc    "M2S(TFM_SVC_PSA_VERSION)"                 \n"
#endif

        "   bxns   lr                                         \n"
#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "reent_panic2:                                        \n"
        "   svc    "M2S(TFM_SVC_PSA_PANIC)"                   \n"
        "   b      .                                          \n"
#endif
    );
}

__tfm_psa_secure_gateway_attributes__
psa_handle_t tfm_psa_connect_veneer(uint32_t sid, uint32_t version)
{
    __ASM volatile(
#if !defined(__ICCARM__)
        ".syntax unified                                      \n"
#endif

#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "   ldr    r2, [sp]                                   \n"
        "   ldr    r3, ="M2S(STACK_SEAL_PATTERN)"             \n"
        "   cmp    r2, r3                                     \n"
        "   bne    reent_panic3                               \n"
#endif

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
        "   push   {r0-r4, lr}                                \n"
        "   ldr    r0, =tfm_spm_client_psa_connect            \n"
        "   mov    r1, sp                                     \n"
        "   movs   r2, #0                                     \n"
        "   bl     spm_interface_thread_dispatcher            \n"
        "   pop    {r0-r3}                                    \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#elif defined(CONFIG_TFM_PSA_API_SFN_CALL)
        "   push   {r4, lr}                                   \n"
        "   bl     psa_connect_sfn                            \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#else
        "   svc    "M2S(TFM_SVC_PSA_CONNECT)"                 \n"
#endif

        "   bxns   lr                                         \n"
#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "reent_panic3:                                        \n"
        "   svc    "M2S(TFM_SVC_PSA_PANIC)"                   \n"
        "   b      .                                          \n"
#endif
    );
}

__tfm_psa_secure_gateway_attributes__
psa_status_t tfm_psa_call_veneer(psa_handle_t handle,
                                 uint32_t ctrl_param,
                                 const psa_invec *in_vec,
                                 psa_outvec *out_vec)
{
    __ASM volatile(
#if !defined(__ICCARM__)
        ".syntax unified                                      \n"
#endif

#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "   push   {r2, r3}                                   \n"
        "   ldr    r2, [sp, #8]                               \n"
        "   ldr    r3, ="M2S(STACK_SEAL_PATTERN)"             \n"
        "   cmp    r2, r3                                     \n"
        "   bne    reent_panic4                               \n"
        "   pop    {r2, r3}                                   \n"
#endif

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
        "   push   {r0-r4, lr}                                \n"
        "   ldr    r0, =tfm_spm_client_psa_call               \n"
        "   mov    r1, sp                                     \n"
        "   movs   r2, #0                                     \n"
        "   bl     spm_interface_thread_dispatcher            \n"
        "   pop    {r0-r3}                                    \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#elif defined(CONFIG_TFM_PSA_API_SFN_CALL)
        "   push   {r4, lr}                                   \n"
        "   bl     psa_call_pack_sfn                          \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#else
        "   svc    "M2S(TFM_SVC_PSA_CALL)"                    \n"
#endif

        "   bxns   lr                                         \n"
#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "reent_panic4:                                        \n"
        "   svc    "M2S(TFM_SVC_PSA_PANIC)"                   \n"
        "   b      .                                          \n"
#endif
    );
}

__tfm_psa_secure_gateway_attributes__
void tfm_psa_close_veneer(psa_handle_t handle)
{
    __ASM volatile(
#if !defined(__ICCARM__)
        ".syntax unified                                      \n"
#endif

#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "   ldr    r2, [sp]                                   \n"
        "   ldr    r3, ="M2S(STACK_SEAL_PATTERN)"             \n"
        "   cmp    r2, r3                                     \n"
        "   bne    reent_panic5                               \n"
#endif

#ifdef CONFIG_TFM_PSA_API_THREAD_CALL
        "   push   {r0-r4, lr}                                \n"
        "   ldr    r0, =tfm_spm_client_psa_close              \n"
        "   mov    r1, sp                                     \n"
        "   movs   r2, #0                                     \n"
        "   bl     spm_interface_thread_dispatcher            \n"
        "   pop    {r0-r3}                                    \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#elif defined(CONFIG_TFM_PSA_API_SFN_CALL)
        "   push   {r4, lr}                                   \n"
        "   bl     psa_close_sfn                              \n"
        "   pop    {r2, r3}                                   \n"
        "   mov    lr, r3                                     \n"
#else
        "   svc    "M2S(TFM_SVC_PSA_CLOSE)"                   \n"
#endif

        "   bxns   lr                                         \n"
#if !defined(__ARM_ARCH_8_1M_MAIN__)
        "reent_panic5:                                        \n"
        "   svc    "M2S(TFM_SVC_PSA_PANIC)"                   \n"
        "   b      .                                          \n"
#endif
    );
}
