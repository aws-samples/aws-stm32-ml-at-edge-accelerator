# This file is to add source files and include directories
# into variables so that it can be reused from different repositories
# in their Cmake based build system by including this file.
#
# Files specific to the repository such as test runner, platform tests
# are not added to the variables.

# 3rdparty source files.
include( ${CMAKE_CURRENT_LIST_DIR}/source/dependency/coreJSON/jsonFilePaths.cmake )

set( TINYCBOR_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborpretty.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborpretty_stdio.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborencoder.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborencoder_close_container_checked.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborerrorstrings.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborparser.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src/cborparser_dup_string.c"
)
set(TINYCBOR_INCLUDE_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/source/dependency/3rdparty/tinycbor/src"
)
# Use C99 for tinycbor as it is incompatible with C90
if(CMAKE_C_STANDARD LESS 99)
    set_source_files_properties(
        ${TINYCBOR_SOURCES}
        PROPERTIES
        COMPILE_FLAGS "-std=gnu99"
    )
endif()

# OTA library source files, including 3rdparties.
set( OTA_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_os_interface.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_platform_interface.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_private.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_interface_private.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_base64_private.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/ota.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/ota_interface.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/ota_base64.c"
    ${JSON_SOURCES}
    ${TINYCBOR_SOURCES}
)

# OTA library public include directories.
set( OTA_INCLUDE_PUBLIC_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/source/include"
    "${CMAKE_CURRENT_LIST_DIR}/source/portable"
)

# OTA library private include directories.
set( OTA_INCLUDE_PRIVATE_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/source"
    ${JSON_INCLUDE_PUBLIC_DIRS}
    ${TINYCBOR_INCLUDE_DIRS}
)

# OTA library POSIX OS porting source files.
# Note: user needs to call find_library(LIB_RT rt REQUIRED) and link with
# ${LIB_RT} because librt is required to use OTA OS POSIX port.
set( OTA_OS_POSIX_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/portable/os/ota_os_posix.c"
)

# OTA library POSIX OS porting source files.
set( OTA_INCLUDE_OS_POSIX_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/source/portable/os"
)

# OTA library FreeRTOS OS porting source files.
set( OTA_OS_FREERTOS_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/portable/os/ota_os_freertos.c"
)

# OTA library FreeRTOS OS porting source files.
set( OTA_INCLUDE_OS_FREERTOS_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/source/portable/os"
)

# OTA library MQTT backend source files.
set( OTA_MQTT_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/ota_mqtt.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/ota_cbor.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_mqtt_private.h"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_cbor_private.h"
)

# OTA library HTTP backend source files.
set( OTA_HTTP_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/source/ota_http.c"
    "${CMAKE_CURRENT_LIST_DIR}/source/include/ota_http_private.h"
)
