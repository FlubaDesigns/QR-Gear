#!/bin/bash
set -e
npm install
yes '' | npx drizzle-kit push --force
