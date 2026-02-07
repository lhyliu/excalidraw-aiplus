/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "packages", "excalidraw");
const ALLOWED_EXTS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["dist", "build", "node_modules", ".git"]);

const fromParentPackageRe = /\bfrom\s+["']\.\.["']/g;
const dynamicImportParentPackageRe = /\bimport\(\s*["']\.\.["']\s*\)/g;

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

const lineOfIndex = (content, index) => content.slice(0, index).split(/\r?\n/).length;

const violations = [];
for (const file of readDirRecursive(TARGET_DIR)) {
  const content = fs.readFileSync(file, "utf8");

  for (const re of [fromParentPackageRe, dynamicImportParentPackageRe]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      violations.push({
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        line: lineOfIndex(content, match.index),
        snippet: match[0],
      });
    }
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
