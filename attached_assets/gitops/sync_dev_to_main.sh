#!/bin/bash
# sync_dev_to_main.sh — Weekly sync: fast-forward main from dev

set -e
source ./pushlib.sh

# Ensure dev is current
git checkout dev
git pull --rebase origin dev

# Ensure main is current
git checkout main
git pull --rebase origin main

# Try fast-forward merge
fast_forward_merge dev main
