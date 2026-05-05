import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const REQUIRED_FILES = [
  'README.md',
  'REPLIT.md',
  'SKILLS.md',
  'METHODOLOGY.md',
  'NAMING_STANDARDS.md',
  'BLD.md',
  'GRF.md',
  'QRG.md',
  'ASSEMBLY.md',
  'SYSTEM_KEYS.md',
];

const OPTIONAL_FILES = [
  'ARCHITECTURE_IDENTITY.md',
  'ARCHITECTURE_VIEWER.md',
  'FIREBASE_SCHEMA.md',
  'ASSET_LIBRARY_SPEC.md',
  'PRODUCTION_INVENTORY.md',
  'ADMIN_MANUAL.md',
  'design_guidelines.md',
];

function sha256File(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function run() {
  const missingRequired = REQUIRED_FILES.filter(f => !existsSync(join(ROOT, f)));
  if (missingRequired.length > 0) {
    console.error('MANIFEST GENERATE FAILED');
    console.error('Missing required files:');
    missingRequired.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  const allFiles = [...REQUIRED_FILES];

  for (const f of OPTIONAL_FILES) {
    if (existsSync(join(ROOT, f))) {
      allFiles.push(f);
    }
  }

  allFiles.sort();

  const files = {};
  for (const f of allFiles) {
    files[f] = sha256File(join(ROOT, f));
  }

  const hashList = allFiles.map(f => `${f}:${files[f]}`).join('\n');
  const packageHash = createHash('sha256').update(hashList).digest('hex');

  const manifest = {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    algorithm: 'sha256',
    extraFilePolicy: 'flag',
    requiredFiles: REQUIRED_FILES,
    files,
    packageHash,
  };

  writeFileSync(join(ROOT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log('MANIFEST GENERATED');
  console.log(`  Tracked : ${allFiles.length} files`);
  console.log(`  Required: ${REQUIRED_FILES.length} files`);
  console.log(`  Optional: ${allFiles.length - REQUIRED_FILES.length} files included`);
  console.log(`  Package hash: ${packageHash}`);
  console.log(`  Written to: MANIFEST.json`);
}

run();
