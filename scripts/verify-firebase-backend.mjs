import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
assert(!existsSync(path.join(root, 'server')), 'The retired standalone backend must not be restored');
const pkg = JSON.parse(read('package.json'));
assert(!existsSync(path.join(root, 'migrations')), 'Retired SQL migrations must not be restored');
assert(!existsSync(path.join(root, 'drizzle.config.ts')), 'Retired database configuration must not be restored');
assert(!/postgresql|javascript_database|javascript_log_in_with_replit|STORAGE_MODE/.test(read('.replit')), 'Retired database/login integrations must not be restored');
for (const name of ['pg', 'postgres', '@neondatabase/serverless', 'connect-pg-simple', 'drizzle-kit', 'stripe-replit-sync']) {
  assert(!pkg.dependencies?.[name] && !pkg.devDependencies?.[name], `Retired backend dependency: ${name}`);
}
assert(!pkg.scripts['db:push'], 'Retired database push command must not be restored');

for (const [name, command] of Object.entries(pkg.scripts)) {
  assert(!/server\/|dist\/index\.js/.test(command), `${name} launches or builds the retired backend`);
}
assert(!JSON.parse(read('tsconfig.json')).include.some(item => item.startsWith('server/')), 'Root TypeScript must not include the retired backend');
const firebase = JSON.parse(read('firebase.json'));
assert.equal(firebase.functions.source, 'functions');
assert.equal(firebase.hosting.public, 'dist/public');
for (const prefix of ['/api/**', '/webhooks/**', '/qr/d/**']) {
  assert.equal(firebase.hosting.rewrites.find(rule => rule.source === prefix)?.function, 'api', `${prefix} must use the canonical Firebase API`);
}
function walk(directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
let checked = 0;
for (const dir of ['client/src', 'shared', 'functions/src', 'scripts', 'tests']) {
  for (const file of walk(dir).filter(file => /\.(?:[cm]?[jt]sx?)$/.test(file))) {
    const text = read(file);
    const imports = text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g);
    for (const [, specifier] of imports) {
      const resolved = specifier.startsWith('.') ? path.relative(root, path.resolve(root, path.dirname(file), specifier)) : specifier;
      assert(!/^(?:@?server)(?:\/|$)/.test(resolved), `${file} imports the retired backend: ${specifier}`);
    }
    checked++;
  }
}
console.log(`PASS: Firebase is the sole backend; ${checked} source/test/script files have no retired backend imports.`);
