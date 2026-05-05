import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function sha256File(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function run() {
  const manifestPath = join(ROOT, 'MANIFEST.json');
  const failures = [];

  if (!existsSync(manifestPath)) {
    console.error('MANIFEST VERIFY FAILED');
    console.error('  - MANIFEST.json is missing');
    console.error('  Run: node scripts/generate-manifest.js');
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    console.error('MANIFEST VERIFY FAILED');
    console.error('  - MANIFEST.json is corrupt or unparseable');
    process.exit(1);
  }

  for (const f of manifest.requiredFiles) {
    if (!existsSync(join(ROOT, f))) {
      failures.push(`Missing required file: ${f}`);
    }
  }

  for (const [f, expectedHash] of Object.entries(manifest.files)) {
    const filePath = join(ROOT, f);
    if (!existsSync(filePath)) {
      if (!failures.some(e => e.includes(f))) {
        failures.push(`Missing tracked file: ${f}`);
      }
      continue;
    }
    const actualHash = sha256File(filePath);
    if (actualHash !== expectedHash) {
      failures.push(`Hash mismatch: ${f}`);
    }
  }

  const sortedFiles = Object.keys(manifest.files).sort();
  const hashList = sortedFiles.map(f => `${f}:${manifest.files[f]}`).join('\n');
  const recomputedPackageHash = createHash('sha256').update(hashList).digest('hex');

  if (recomputedPackageHash !== manifest.packageHash) {
    failures.push('Package hash mismatch — manifest may be corrupt or tampered');
  }

  if (failures.length > 0) {
    console.error('MANIFEST VERIFY FAILED');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('SUCCESS:');
  console.log(`MANIFEST VERIFIED — all ${Object.keys(manifest.files).length} tracked files match.`);
  console.log(`  Generated : ${manifest.generatedAt}`);
  console.log(`  Package hash: ${manifest.packageHash}`);
  process.exit(0);
}

run();
