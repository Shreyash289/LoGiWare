const fs = require("fs");
const path = require("path");

const root = process.cwd();
const source = path.join(root, "frontend", "public");
const target = path.join(root, "dist");

fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true, force: true });

console.log("Built static frontend into dist/");
