-- 온누리상품권 사용처 서비스 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

-- 시장/상점가 (지도 핀 단위)
create table if not exists markets (
  id               integer primary key,
  name             text not null,
  region           text not null,          -- 시/도
  store_count      integer not null default 0,
  digital_count    integer not null default 0,   -- 디지털형(모바일/카드) 사용 가능 가맹점 수
  paper_only_count integer not null default 0,    -- 지류 전용 가맹점 수
  lat              double precision,        -- 지오코딩으로 채움
  lng              double precision
);

create index if not exists markets_region_idx on markets (region);
-- 지도 영역(위경도 범위) 조회용
create index if not exists markets_latlng_idx on markets (lat, lng);

-- 개별 가맹점
create table if not exists stores (
  id        integer primary key,
  market_id integer not null references markets(id),
  name      text not null,
  region    text not null,
  items     text,                 -- 취급품목
  paper     boolean not null default true,   -- 지류형 사용 가능
  digital   boolean not null default false,  -- 디지털형 사용 가능
  year      text
);

create index if not exists stores_market_id_idx on stores (market_id);
-- 취급품목 검색용 (부분 일치)
create index if not exists stores_items_idx on stores using gin (to_tsvector('simple', coalesce(items,'')));

-- 읽기 전용 공개 서비스: RLS 켜고 익명 SELECT 만 허용
alter table markets enable row level security;
alter table stores  enable row level security;

drop policy if exists "public read markets" on markets;
create policy "public read markets" on markets for select using (true);

drop policy if exists "public read stores" on stores;
create policy "public read stores" on stores for select using (true);
