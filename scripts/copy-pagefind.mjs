import { cpSync, existsSync, rmSync } from "node:fs";

const source = "dist/pagefind";
const target = "public/pagefind";

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}

cpSync(source, target, { recursive: true });
