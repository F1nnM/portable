#!/bin/sh
set -e

cd /build/packages/pod-server
exec npx tsx watch src/index.ts
