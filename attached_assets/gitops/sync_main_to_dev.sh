#!/bin/bash
# sync_main_to_dev.sh — Reverse sync: fast-forward dev from main (rare)

set -e
source ./pushlib.sh

# Ensure main is current
git checkout main
git pull --rebase origin main

# Ensure dev is current
git checkout dev
git pull --rebase origin dev

# Try fast-forward merge
fast_forward_merge main dev
