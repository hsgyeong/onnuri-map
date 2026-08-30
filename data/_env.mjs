// web/.env.local 을 읽어 process.env 에 주입하는 초경량 로더 (dotenv 대체)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "web", ".env.local");

export function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error(`\n[env] ${envPath} 이 없습니다. web/.env.local.example 을 복사해 값을 채우세요.\n`);
    process.exit(1);
  }
  const text = fs.readFileSync(envPath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    // 인라인 주석 제거 (# 앞 공백 있는 경우)
    val = val.replace(/\s+#.*$/, "").trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

export function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n[env] ${name} 가 비어 있습니다. web/.env.local 을 확인하세요.\n`);
    process.exit(1);
  }
  return v;
}
