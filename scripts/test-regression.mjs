import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const guard = path.join(root, 'scripts/test-network-guard.cjs');
const env = { ...process.env, GCLOUD_PROJECT: 'qrgear-c1ffd', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${guard}`.trim() };
for (const cwd of [root, path.join(root, 'functions')]) {
 const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', path.join(cwd, 'vitest.config.ts')], { cwd, env, stdio: 'inherit' });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status || 1);
}
