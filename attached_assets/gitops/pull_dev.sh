#!/bin/bash
# pull_dev.sh — Pull dev with rebase

set -e
source ./pushlib.sh

pull_rebase dev

echo "OK: pulled dev (rebased)"
