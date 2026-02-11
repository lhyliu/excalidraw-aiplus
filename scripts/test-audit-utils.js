const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = ["packages", "excalidraw-app"];
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git"]);

const walkTestFiles = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walkTestFiles(path.join(dir, entry.name), files);
      }
      continue;
    }
    if (TEST_FILE_RE.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
};

const getAllTestFiles = () => {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const abs = path.join(ROOT, dir);
    if (fs.existsSync(abs)) {
      walkTestFiles(abs, files);
    }
  }
  return files;
};

const lineOfIndex = (content, index) =>
  content.slice(0, index).split(/\r?\n/).length;

module.exports = {
  ROOT,
  getAllTestFiles,
  lineOfIndex,
};
