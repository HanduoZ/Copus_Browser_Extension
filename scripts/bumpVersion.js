const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');

function readManifest() {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function writeManifest(manifest) {
  const formatted = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath, formatted, 'utf8');
}

function bumpPatch(version) {
  const segments = version.split('.').map((segment) => Number.parseInt(segment, 10));

  while (segments.length < 3) {
    segments.push(0);
  }

  if (segments.some((segment) => Number.isNaN(segment) || segment < 0)) {
    throw new Error(`Invalid semantic version provided: ${version}`);
  }

  segments[2] += 1;
  return segments.join('.');
}

function main() {
  const manifest = readManifest();
  const currentVersion = manifest.version;

  if (!currentVersion) {
    throw new Error('Manifest file does not contain a version field.');
  }

  const nextVersion = bumpPatch(currentVersion);
  manifest.version = nextVersion;
  manifest.version_name = nextVersion;
  writeManifest(manifest);

  console.log(`Bumped manifest version from ${currentVersion} to ${nextVersion}.`);
}

main();
