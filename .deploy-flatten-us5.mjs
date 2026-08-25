import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shared = path.join(root, 'supabase/functions/_shared/billing');

function rewrite(source) {
  return source
    .replaceAll('../_shared/billing/bexio/', './')
    .replaceAll('../_shared/billing/', './')
    .replaceAll('./bexio/', './')
    .replaceAll('../accounting-provider.ts', './accounting-provider.ts');
}

function writeBundle(outDir, files) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, from] of files) {
    const raw = fs.readFileSync(from, 'utf8');
    fs.writeFileSync(path.join(outDir, name), rewrite(raw));
  }
}

const sharedFiles = [
  ['accounting-provider.ts', path.join(shared, 'accounting-provider.ts')],
  ['vault.ts', path.join(shared, 'vault.ts')],
  ['financial-service.ts', path.join(shared, 'financial-service.ts')],
  ['bexio-adapter.ts', path.join(shared, 'bexio/bexio-adapter.ts')],
  ['bexio-client.ts', path.join(shared, 'bexio/bexio-client.ts')],
  ['bexio-mappers.ts', path.join(shared, 'bexio/bexio-mappers.ts')],
];

writeBundle(path.join(root, '.deploy-billing-cancel'), [
  ['index.ts', path.join(root, 'supabase/functions/billing-cancel-invoice/index.ts')],
  ...sharedFiles,
]);

writeBundle(path.join(root, '.deploy-bexio-reconcile'), [
  ['index.ts', path.join(root, 'supabase/functions/bexio-reconcile/index.ts')],
  ['reconciliation-service.ts', path.join(shared, 'reconciliation-service.ts')],
  ...sharedFiles,
]);

console.log('flattened .deploy-billing-cancel and .deploy-bexio-reconcile');
