import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, join, resolve } from "node:path";

const runtimePath = resolve(".next/server/webpack-runtime.js");
const serverDir = resolve(".next/server");
const chunksDir = resolve(".next/server/chunks");

if (existsSync(runtimePath)) {
  const original = readFileSync(runtimePath, "utf8");
  const currentPattern = 'require("./" + __webpack_require__.u(chunkId))';
  const patchedPattern = 'require("./chunks/" + __webpack_require__.u(chunkId))';

  if (original.includes(currentPattern) && !original.includes(patchedPattern)) {
    writeFileSync(runtimePath, original.replaceAll(currentPattern, patchedPattern));
  }
}

if (!existsSync(chunksDir)) {
  process.exit(0);
}

mkdirSync(serverDir, { recursive: true });

for (const entry of readdirSync(chunksDir)) {
  const sourcePath = join(chunksDir, entry);

  if (!statSync(sourcePath).isFile() || !entry.endsWith(".js")) {
    continue;
  }

  const targetPath = join(serverDir, basename(entry));
  copyFileSync(sourcePath, targetPath);
}
