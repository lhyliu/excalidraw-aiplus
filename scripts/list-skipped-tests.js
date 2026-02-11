/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const { ROOT, getAllTestFiles, lineOfIndex } = require("./test-audit-utils");
const SKIP_RE = /\b(?:it|test|describe)\.skip\s*\(/g;
const SKIP_WITH_TITLE_RE =
  /\b(?:it|test|describe)\.skip\s*\(\s*(["'`])([^"'`]+)\1/g;

const getLine = (content, lineNo) =>
  content.split(/\r?\n/)[lineNo - 1]?.trim() || "";

const classify = (title, line) => {
  const source = `${title} ${line}`.toLowerCase();
  if (source.includes("perf")) {
    return "perf-placeholder";
  }
  if (source.includes("todo") || source.includes("fix")) {
    return "todo-fixme";
  }
  return "generic";
};

const skips = [];
for (const file of getAllTestFiles()) {
  const content = fs.readFileSync(file, "utf8");
  SKIP_RE.lastIndex = 0;
  let match;
  const titleByLine = new Map();
  SKIP_WITH_TITLE_RE.lastIndex = 0;
  let titledMatch;
  while ((titledMatch = SKIP_WITH_TITLE_RE.exec(content)) !== null) {
    titleByLine.set(lineOfIndex(content, titledMatch.index), titledMatch[2]);
  }

  while ((match = SKIP_RE.exec(content)) !== null) {
    const line = lineOfIndex(content, match.index);
    const sourceLine = getLine(content, line);
    const title = titleByLine.get(line) || "";
    skips.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      line,
      snippet: match[0],
      title,
      category: classify(title, sourceLine),
    });
  }
}

if (skips.length === 0) {
  console.log("No skipped tests found.");
  process.exit(0);
}

console.log(`Found ${skips.length} skipped tests:`);
for (const skip of skips) {
  const title = skip.title ? ` "${skip.title}"` : "";
  console.log(
    `- ${skip.file}:${skip.line} (${skip.snippet}${title}) [${skip.category}]`,
  );
}
