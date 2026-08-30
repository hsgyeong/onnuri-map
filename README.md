# 온누리맵 — 내 주변 온누리상품권 사용처 찾기

전국 온누리상품권 가맹점(약 15만 곳)을 **시장·상점가 단위로 지도에서** 쉽게 찾는 웹앱.
공공데이터포털 「소상공인시장진흥공단_전국 온누리상품권 가맹점 현황」 기반.

## 구성

```
onnuri/
├─ 소상공인..._20250731.csv   # 원본 공공데이터 (약 15만 행)
├─ data/                       # 데이터 파이프라인 (Python + Node 스크립트)
│  ├─ build_data.py            # CSV → markets.json / stores.json 정규화
│  ├─ geocode_markets.mjs      # 시장명 → 좌표 (카카오 REST)
│  ├─ load_supabase.mjs        # Supabase 적재 (REST)
│  ├─ markets.json             # 시장 2,698개 (좌표는 지오코딩 후 채워짐)
│  └─ stores.json              # 가맹점 150,541개
└─ web/                        # Next.js 웹앱 (지도 UI)
   ├─ supabase/schema.sql      # DB 테이블 생성 SQL
   └─ src/…                    # 지도·패널·페이지
```

## 데이터 특성 (중요)

원본 CSV의 `소재지`는 **시/도(17개)** 뿐 — 정확한 도로명 주소·좌표가 없습니다.
그래서 개별 점포 대신 **소속 시장·상점가(2,698개)를 지오코딩**해 지도에 표시하고,
시장을 선택하면 소속 가맹점 목록·품목·상품권 종류(지류/디지털)를 보여줍니다.

## 실행 순서

### 1. 계정·키 준비 (각각 무료, 5분)

- **Supabase**: [supabase.com](https://supabase.com) 프로젝트 생성 → Project Settings > API 에서
  `Project URL`, `anon public` 키, `service_role` 키 확보
- **카카오 개발자**: [developers.kakao.com](https://developers.kakao.com) 앱 생성 →
  앱 키에서 `JavaScript 키`, `REST API 키` 확보.
  또한 **플랫폼 > Web** 에 `http://localhost:3000` 등록 (지도 표시에 필수)

### 2. 환경변수 설정

```bash
cp web/.env.local.example web/.env.local
# web/.env.local 을 열어 위 5개 값을 채운다
```

### 3. DB 테이블 생성

Supabase 대시보드 > SQL Editor 에 `web/supabase/schema.sql` 내용을 붙여넣고 실행.

### 4. 데이터 파이프라인 실행

```bash
python data/build_data.py          # CSV → markets.json / stores.json 정규화
node   data/geocode_markets.mjs    # 시장 좌표 채우기 (수 분, 이어하기 지원)
python data/categorize.py          # 취급품목 → 업종 대분류/소분류 분류
node   data/enrich_markets.mjs     # 역지오코딩(시/군/구) + 업종 집계 → web/public/markets.json
node   data/load_supabase.mjs      # Supabase 에 가맹점(stores) 적재
```

> 시장(markets)은 `web/public/markets.json` 정적 파일로 서빙되고, 가맹점(stores)만 Supabase 에서 조회합니다.

### 5. 웹앱 실행

```bash
cd web
npm run dev
# http://localhost:3000
```

## 기능

- 전국 시장·상점가 지도 표시 (클러스터링)
- 📍 내 위치 기반 이동
- **지역 필터** (상단): 시/도 → 시/군/구, 선택 시 지도 자동 이동
- **업종 필터** (상단): 대분류(외식/식품·농수축산/패션·잡화/뷰티·건강/생활·기타) → 소분류
- 시장 선택 → 소속 가맹점 목록
  - 업종 대분류·소분류 칩 필터 (상단 선택이 이어짐)
  - 가게명·품목 검색
  - 디지털(모바일·카드) 사용 가능 가맹점만 보기

## 기술 스택

Next.js 16 · TypeScript · Tailwind · Supabase(PostgreSQL) · 카카오맵
