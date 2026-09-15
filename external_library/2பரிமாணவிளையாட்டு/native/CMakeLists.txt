# 2பரிமாணவிளையாட்டு native backend — build.
# Usage:
#   cmake -S native -B native/build && cmake --build native/build
# Outputs (in native/build/): y2d_backend, mkassets.
# Vendored SDL3/SDL3_ttf headers+libs in native/vendor are used; the
# backend binary carries an $ORIGIN-relative rpath so it runs anywhere
# the package directory goes. Fails clearly when compiler/CMake/vendor
# files are missing.

cmake_minimum_required(VERSION 3.16)
project(y2d_backend C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/vendor/include/SDL3/SDL.h")
    message(FATAL_ERROR "native/vendor headers missing (see native/vendor/PROVENANCE.md)")
endif()

add_executable(y2d_backend src/y2d_backend.c src/stb_impl.c src/stb_vorbis.c)
target_include_directories(y2d_backend PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor")
target_link_directories(y2d_backend PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor/lib")
target_link_libraries(y2d_backend PRIVATE SDL3 SDL3_ttf plutosvg plutovg m)
set_target_properties(y2d_backend PROPERTIES
    BUILD_RPATH_USE_ORIGIN ON
    INSTALL_RPATH "$ORIGIN/../vendor/lib"
    BUILD_WITH_INSTALL_RPATH ON)

add_executable(mkassets src/mkassets.c)
target_include_directories(mkassets PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor")
target_link_libraries(mkassets PRIVATE m)

if(NOT CMAKE_C_COMPILER)
    message(FATAL_ERROR "No C compiler found (gcc required)")
endif()
