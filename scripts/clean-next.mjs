import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const nextDirs = [resolve(".next"), resolve(".next-dev")];

for (const nextDir of nextDirs) {
  if (existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true });
  }
}
