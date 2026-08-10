import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');
const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) yield full;
  }
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('@/') && !spec.startsWith('.')) return null;
  const base = spec.startsWith('@/')
    ? path.join(ROOT, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const allFiles = [...walk(ROOT)];
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

const importRe = /import[^'"]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
const graph = new Map();
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const deps = [];
  for (const m of content.matchAll(importRe)) {
    const spec = m[1] || m[2];
    const resolved = resolveImport(file, spec);
    if (resolved) deps.push(resolved);
  }
  graph.set(file, deps);
}

// Roots: every file NOT inside components/ui or hooks (pages, App, contexts, lib, other components)
const isUiOrHooks = (f) => /components[\\/]ui[\\/]/.test(f) || /(^|[\\/])hooks[\\/]/.test(path.relative(ROOT, f));
const roots = allFiles.filter((f) => !isUiOrHooks(f));

const reachable = new Set();
const stack = [...roots];
while (stack.length) {
  const f = stack.pop();
  if (reachable.has(f)) continue;
  reachable.add(f);
  for (const d of graph.get(f) || []) if (!reachable.has(d)) stack.push(d);
}

const dead = allFiles.filter((f) => isUiOrHooks(f) && !reachable.has(f)).map(rel).sort();
const alive = allFiles.filter((f) => isUiOrHooks(f) && reachable.has(f)).map(rel).sort();

console.log('ALIVE (ui/ + hooks/):');
console.log(alive.map((f) => '  ' + f).join('\n'));
console.log('\nDEAD (ui/ + hooks/):');
console.log(dead.map((f) => '  ' + f).join('\n'));

// Third-party deps used by surviving files only
const aliveFiles = allFiles.filter((f) => reachable.has(f));
const pkgRe = /from\s*['"]([^'".@/][^'"]*|@[^'"]+)['"]/g;
const usedPkgs = new Set();
for (const f of aliveFiles) {
  const content = fs.readFileSync(f, 'utf8');
  for (const m of content.matchAll(pkgRe)) {
    let p = m[1];
    if (p.startsWith('@')) p = p.split('/').slice(0, 2).join('/');
    else p = p.split('/')[0];
    usedPkgs.add(p);
  }
}
console.log('\nTHIRD-PARTY PACKAGES USED BY SURVIVORS:');
console.log([...usedPkgs].sort().map((p) => '  ' + p).join('\n'));
