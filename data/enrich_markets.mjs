// 시장 데이터 보강:
//  1) 좌표 -> 시/군/구 (카카오 역지오코딩 coord2regioncode)
//  2) 시장별 업종(대분류/소분류) 집계 (stores.json 의 category/subcategory)
// 결과: data/markets.json 에 sigungu 저장(이어하기용) + web/public/markets.json (앱이 로드할 정적 파일)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, required } from "./_env.mjs";

loadEnv();
const KEY = required("KAKAO_REST_KEY");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKETS = path.join(__dirname, "markets.json");
const STORES = path.join(__dirname, "stores.json");
const PUBLIC = path.join(__dirname, "..", "web", "public", "markets.json");

const MAJOR_ORDER = ["외식", "식품·농수축산", "패션·잡화", "뷰티·건강", "생활·기타", "기타"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (res.status === 429) { await sleep(800); return reverseGeocode(lat, lng); }
  if (!res.ok) return null;
  const docs = (await res.json()).documents ?? [];
  const doc = docs.find((d) => d.region_type === "H") ?? docs[0];
  if (!doc) return null;
  return (doc.region_2depth_name || "").trim() || null; // 시/군/구
}

async function main() {
  const markets = JSON.parse(fs.readFileSync(MARKETS, "utf-8"));
  const stores = JSON.parse(fs.readFileSync(STORES, "utf-8"));

  // 시장별 업종 집계
  const majorsByMarket = new Map();
  const subsByMarket = new Map();
  for (const s of stores) {
    if (!majorsByMarket.has(s.market_id)) { majorsByMarket.set(s.market_id, new Set()); subsByMarket.set(s.market_id, new Set()); }
    majorsByMarket.get(s.market_id).add(s.category || "기타");
    subsByMarket.get(s.market_id).add(s.subcategory || "기타");
  }

  // 역지오코딩 (좌표 있고 sigungu 아직 없는 것만)
  const targets = markets.filter((m) => m.lat != null && m.sigungu === undefined);
  console.log(`역지오코딩 대상 ${targets.length} / 전체 ${markets.length}`);
  let done = 0;
  for (const m of markets) {
    if (m.lat != null && m.sigungu === undefined) {
      m.sigungu = await reverseGeocode(m.lat, m.lng);
      await sleep(30);
      done++;
      if (done % 200 === 0) {
        console.log(`  ${done}/${targets.length}`);
        fs.writeFileSync(MARKETS, JSON.stringify(markets, null, 1));
      }
    } else if (m.lat == null) {
      m.sigungu = null;
    }
  }
  fs.writeFileSync(MARKETS, JSON.stringify(markets, null, 1));

  // 정적 파일 생성 (필요한 필드만)
  const pub = markets.map((m) => ({
    id: m.id,
    name: m.name,
    region: m.region,          // 시/도 (대분류)
    sigungu: m.sigungu ?? null, // 시/군/구 (소분류)
    store_count: m.store_count,
    digital_count: m.digital_count,
    paper_only_count: m.paper_only_count,
    lat: m.lat,
    lng: m.lng,
    majors: [...(majorsByMarket.get(m.id) ?? [])].sort(
      (a, b) => MAJOR_ORDER.indexOf(a) - MAJOR_ORDER.indexOf(b)
    ),
    subs: [...(subsByMarket.get(m.id) ?? [])],
  }));
  fs.mkdirSync(path.dirname(PUBLIC), { recursive: true });
  fs.writeFileSync(PUBLIC, JSON.stringify(pub));

  const withSgg = pub.filter((m) => m.sigungu).length;
  console.log(`\n완료: 정적파일 ${pub.length}개 (시/군/구 확보 ${withSgg}) -> web/public/markets.json`);
}

main();
