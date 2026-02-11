/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const { ROOT, getAllTestFiles, lineOfIndex } = require("./test-audit-utils");
const EMPTY_TEST_RE =
  /\b(?:it|test)\s*\(\s*(["'`])[^"'`]+\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;

const findings = [];
for (const file of getAllTestFiles()) {
  const content = fs.readFileSync(file, "utf8");
  EMPTY_TEST_RE.lastIndex = 0;
  let match;
  while ((match = EMPTY_TEST_RE.exec(content)) !== null) {
    findings.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      line: lineOfIndex(content, match.index),
    });
  }
}

if (findings.length === 0) {
  console.log("No empty tests found.");
  process.exit(0);
}

console.log(`Found ${findings.length} empty tests:`);
for (const finding of findings) {
  console.log(`- ${finding.file}:${finding.line}`);
}

process.exit(1);
