// 시장/상점가 이름 -> 좌표(위경도) 변환 (카카오 로컬 키워드 검색)
// 사용법: node data/geocode_markets.mjs
// 결과: data/markets.json 의 각 항목 lat/lng/geo_precise 를 채워서 덮어씀 (이어하기 지원)
//
// 개선점:
//  - "골목형상점가/상인회/종합상가" 등 카카오에 없는 접미어를 제거한 후보로 재시도
//  - 괄호 안 부가설명 제거
//  - 여러 후보 쿼리를 순서대로 시도, 결과가 실제 해당 시/도인지 검증
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, required } from "./_env.mjs";

loadEnv();
const KAKAO_REST_KEY = required("KAKAO_REST_KEY");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKETS = path.join(__dirname, "markets.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 카카오에 POI 로 존재하지 않는 조직/유형 접미어
const SUFFIXES = [
  "골목형상점가", "문화관광형시장", "활성화구역", "종합상가", "상점가",
  "상인회", "번영회", "시장상가", "지하상가", "지하도상점가", "먹자골목", "먹거리촌",
];

function buildQueries(name, region) {
  const q = new Set();
  const noParen = name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  let core = noParen;
  for (const s of SUFFIXES) core = core.replace(new RegExp(s + "\\s*$"), "").trim();
  // 접미어 제거 후 남은 마지막 토큰(랜드마크: 초/대/역/동 등)도 후보로
  const lastToken = core.split(/\s+/).slice(-1)[0];

  const add = (s) => { if (s && s.length >= 2) { q.add(`${region} ${s}`); q.add(s); } };
  add(name);
  add(noParen);
  add(core);
  if (lastToken !== core) add(lastToken);
  return [...q];
}

async function searchKeyword(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
  if (res.status === 429) { await sleep(1000); return searchKeyword(query); }
  if (!res.ok) throw new Error(`Kakao ${res.status}`);
  const data = await res.json();
  return data.documents ?? [];
}

// 후보 쿼리들을 순서대로 시도. 해당 시/도와 일치하는 결과만 채택.
// (지역 검증 실패 시엔 틀린 위치에 핀을 꽂지 않도록 null 반환)
async function geocode(name, region) {
  for (const query of buildQueries(name, region)) {
    let docs = [];
    try { docs = await searchKeyword(query); } catch { /* skip */ }
    await sleep(35);
    if (!docs.length) continue;
    const match = docs.find((d) => (d.address_name || "").includes(region));
    if (match) return { lat: +match.y, lng: +match.x, precise: true };
  }
  return null;
}

async function main() {
  const markets = JSON.parse(fs.readFileSync(MARKETS, "utf-8"));
  const total = markets.length;
  let done = 0, hit = 0, loose = 0, miss = 0, skipped = 0;

  for (const m of markets) {
    done++;
    if (m.lat != null && m.lng != null && m.geo_precise !== false) { skipped++; continue; }
    let r = null;
    try { r = await geocode(m.name, m.region); } catch (e) { console.error(`  [err] ${m.name}: ${e.message}`); }
    if (r) {
      m.lat = r.lat; m.lng = r.lng; m.geo_precise = r.precise;
      if (r.precise) hit++; else loose++;
    } else { m.lat = null; m.lng = null; m.geo_precise = null; miss++; }

    if (done % 100 === 0) {
      console.log(`  진행 ${done}/${total}  정확 ${hit}  느슨 ${loose}  실패 ${miss}  건너뜀 ${skipped}`);
      fs.writeFileSync(MARKETS, JSON.stringify(markets, null, 1));
    }
  }
  fs.writeFileSync(MARKETS, JSON.stringify(markets, null, 1));
  const withCoords = markets.filter((x) => x.lat != null).length;
  console.log(`\n완료: 총 ${total}, 좌표확보 ${withCoords} (정확 ${hit} / 느슨 ${loose}), 실패 ${miss}`);
}

main();
