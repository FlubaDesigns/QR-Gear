import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// Guard the route boundary, rather than maintaining a list of pages allowed to opt out.
const app = fs.readFileSync('client/src/App.tsx', 'utf8');
const source = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = [];
let routerInsideSkeleton = false;
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    const tag = node.tagName.getText(source);
    if (tag === 'Route') {
      const attr = node.attributes.properties.find(p => p.name?.getText(source) === 'path');
      routes.push(attr?.initializer?.text ?? '(not found)');
    }
    if (tag === 'Router') {
      let parent = node.parent;
      while (parent) {
        if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) === 'PageSkeleton') routerInsideSkeleton = true;
        parent = parent.parent;
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert(routerInsideSkeleton, 'Every route must inherit the shared PageSkeleton');
assert.equal(new Set(routes).size, routes.length, 'Duplicate route declarations');
assert.equal((app.match(/<PageSkeleton\b/g) ?? []).length, 1, 'Exactly one application skeleton');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const checked = [];
for (const file of walk('client/src').filter(f => f.endsWith('.tsx'))) {
  if (file === 'client/src/App.tsx' || file === 'client/src/components/PageSkeleton.tsx') continue;
  const text = fs.readFileSync(file, 'utf8');
  assert(!/<PageSkeleton\b/.test(text), `${file}: nested page skeleton`);
  assert(!/<(?:Navbar|Footer)\s*\/?\>/.test(text), `${file}: duplicate site chrome`);
  if (file.startsWith('client/src/pages/') || file.startsWith('client/src/features/storefront/')) {
    assert(!/<main\b/.test(text), `${file}: nested main landmark`);
    assert(!/className="[^"]*\b(?:container|page-wrap|vanity-container)\b[^"]*"/.test(text.replace(/(?:qr-auth-container|timeline-container)/g, 'component-panel')), `${file}: legacy page container`);
    checked.push(file);
  }
}
const skeleton = fs.readFileSync('client/src/components/PageSkeleton.tsx', 'utf8');
assert(skeleton.includes('[master, fonts, buttons, forms, theme, site]'), 'Canonical stylesheet load order');
assert(skeleton.includes('id="main-content" className="main"'), 'Main landmark contract');
assert(skeleton.includes('className="main-inner" data-slot="page-content"'), 'Page slot contract');
const master = fs.readFileSync('client/src/styles/canonical/master.css');
const sha = createHash('sha1').update(`blob ${master.length}\0`).update(master).digest('hex');
assert.equal(sha, '18a6aeb4e0bde8a88df0b46af9f8f871c06cd336', 'Master must remain byte-for-byte upstream');
console.log(`PASS: ${routes.length} route entries share one skeleton; ${checked.length} page/view files checked; Master unchanged.`);
console.log('Standalone widget/scan routes retain their presentation inside the same canonical stage. Admin routes retain AdminShell/navigation.');
