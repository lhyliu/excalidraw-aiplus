/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "packages", "excalidraw");
const ALLOWED_EXTS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["dist", "build", "node_modules", ".git"]);

const fromParentPackageRe = /\bfrom\s+["']\.\.["']/g;
const dynamicImportParentPackageRe = /\bimport\(\s*["']\.\.["']\s*\)/g;
const violationPatterns = [fromParentPackageRe, dynamicImportParentPackageRe];

const readDirRecursive = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        readDirRecursive(fullPath, files);
      }
      continue;
    }
    if (ALLOWED_EXTS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
};

const buildLineStartIndices = (content) => {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
};

const lineOfIndex = (lineStarts, index) => {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = low + ((high - low) >> 1);
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high + 1;
};

const violations = [];
for (const file of readDirRecursive(TARGET_DIR)) {
  const content = fs.readFileSync(file, "utf8");
  const fileMatches = [];

  for (const re of violationPatterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      fileMatches.push({
        index: match.index,
        snippet: match[0],
      });
    }
  }

  if (fileMatches.length === 0) {
    continue;
  }

  const lineStarts = buildLineStartIndices(content);
  const relativeFile = path.relative(ROOT, file).replace(/\\/g, "/");

  for (const match of fileMatches) {
    violations.push({
      file: relativeFile,
      line: lineOfIndex(lineStarts, match.index),
      snippet: match.snippet,
    });
  }
}

if (violations.length > 0) {
  console.error(
    "Found forbidden parent-package imports (`..`) in packages/excalidraw:",
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} (${violation.snippet})`,
    );
  }
  process.exit(1);
}

console.log("No forbidden parent-package imports found.");
