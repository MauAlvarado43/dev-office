import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error('Provide an output path for the release notes.');
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8').replace(/\r\n/g, '\n');
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headerPattern = new RegExp(`^## \\[${escapedVersion}\\](?:[ \\t]+-[ \\t]+[^\\r\\n]+)?[ \\t]*$`, 'm');
const headerMatch = headerPattern.exec(changelog);

if (!headerMatch || headerMatch.index === undefined) {
  throw new Error(`CHANGELOG.md must contain a ## [${version}] section.`);
}

const sectionStart = headerMatch.index + headerMatch[0].length;
const nextSection = changelog.indexOf('\n## ', sectionStart);
const notes = changelog.slice(sectionStart, nextSection === -1 ? undefined : nextSection).trim();

if (!notes) {
  throw new Error(`The ${version} changelog section must include release notes.`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${notes}\n`);
