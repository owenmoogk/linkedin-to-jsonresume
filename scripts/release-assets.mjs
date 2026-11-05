/**
 * Prepares release assets after `web-ext sign` (run in CI for `v*` tags):
 *  - `linkedin-to-jsonresume.xpi`: copy of the signed .xpi with a stable name,
 *    so `releases/latest/download/linkedin-to-jsonresume.xpi` always works
 *  - `updates.json`: Firefox update manifest for self-distributed add-ons
 *    (see `gecko.update_url` in src/manifest.json)
 *
 * @see https://extensionworkshop.com/documentation/manage/updating-your-extension/
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS_DIR = 'web-ext-artifacts';
const STABLE_XPI_NAME = 'linkedin-to-jsonresume.xpi';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
const addonId = manifest.browser_specific_settings.gecko.id;
const version = pkg.version;
const tag = process.env.GITHUB_REF_NAME ?? `v${version}`;
const repo =
  process.env.GITHUB_REPOSITORY ?? 'owenmoogk/linkedin-to-jsonresume';

if (tag !== `v${version}`) {
  throw new Error(
    `Tag ${tag} does not match package.json version ${version}. Release with \`yarn ver:patch\` (or minor / major).`
  );
}

const signedXpi = readdirSync(ARTIFACTS_DIR).find(
  (f) => f.endsWith(`-${version}.xpi`) && f !== STABLE_XPI_NAME
);
if (!signedXpi) {
  throw new Error(
    `No signed .xpi for version ${version} found in ${ARTIFACTS_DIR}/`
  );
}

const xpiPath = join(ARTIFACTS_DIR, signedXpi);
const hash = createHash('sha256').update(readFileSync(xpiPath)).digest('hex');

copyFileSync(xpiPath, join(ARTIFACTS_DIR, STABLE_XPI_NAME));

const updates = {
  addons: {
    [addonId]: {
      updates: [
        {
          version,
          update_link: `https://github.com/${repo}/releases/download/${tag}/${signedXpi}`,
          update_hash: `sha256:${hash}`,
        },
      ],
    },
  },
};
writeFileSync(
  join(ARTIFACTS_DIR, 'updates.json'),
  `${JSON.stringify(updates, null, 2)}\n`
);

console.warn(
  `Prepared ${STABLE_XPI_NAME} and updates.json for ${addonId} ${version}`
);
