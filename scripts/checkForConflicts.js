const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function listTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function fileContainsConflictMarkers(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const conflictPattern = /^(<{7}|={7}|>{7})\s/m;
  return conflictPattern.test(content);
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const files = listTrackedFiles();
  const conflictedFiles = [];

  files.forEach((relativeFile) => {
    const absoluteFile = path.join(repoRoot, relativeFile);
    if (!fs.existsSync(absoluteFile) || fs.statSync(absoluteFile).isDirectory()) {
      return;
    }

    if (fileContainsConflictMarkers(absoluteFile)) {
      conflictedFiles.push(relativeFile);
    }
  });

  if (conflictedFiles.length > 0) {
    console.error('Conflict markers detected in the following files:');
    conflictedFiles.forEach((file) => console.error(` - ${file}`));
    process.exitCode = 1;
    return;
  }

  console.log('No conflict markers detected.');
}

main();
