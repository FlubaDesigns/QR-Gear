#!/bin/bash
# pull_main.sh — Pull main with rebase

set -e
source ./pushlib.sh

pull_rebase main

echo "OK: pulled main (rebased)"
