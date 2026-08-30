// data/markets.json, data/stores.json -> Supabase 적재 (REST API, 의존성 없음)
// 사용법: node data/load_supabase.mjs
// 선행 조건: web/supabase/schema.sql 을 Supabase SQL Editor 에서 실행해 테이블 생성
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, required } from "./_env.mjs";

loadEnv();
const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = required("SUPABASE_SERVICE_KEY");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function upsert(table, rows, chunkSize = 1000) {
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`\n[${table}] ${res.status} 실패:`, await res.text());
      process.exit(1);
    }
    done += chunk.length;
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  const markets = JSON.parse(fs.readFileSync(path.join(__dirname, "markets.json"), "utf-8"));
  const stores = JSON.parse(fs.readFileSync(path.join(__dirname, "stores.json"), "utf-8"));

  const withCoords = markets.filter((m) => m.lat != null).length;
  console.log(`시장 ${markets.length}개 (좌표 있음 ${withCoords}), 가맹점 ${stores.length}개 적재 시작`);

  // markets: DB에 없는 보조 필드(geocode_query, geo_precise)는 제거
  const marketRows = markets.map(({ geocode_query, geo_precise, ...rest }) => rest);
  await upsert("markets", marketRows);
  await upsert("stores", stores);

  console.log("적재 완료 ✅");
}

main();
