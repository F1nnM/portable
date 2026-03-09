#!/bin/sh
set -e

cd /build/packages/pod-server
exec bun --watch src/index.ts
