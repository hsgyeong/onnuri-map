import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 개발 초기에 키를 안 넣었을 때 원인을 바로 알 수 있도록
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. web/.env.local 을 확인하세요."
  );
}

// 키가 비어 있어도 createClient 가 throw 하지 않도록 플레이스홀더 사용
// (실제 데이터 조회는 유효한 키가 있어야 동작)
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);

export type Market = {
  id: number;
  name: string;
  region: string;        // 시/도
  sigungu: string | null; // 시/군/구
  store_count: number;
  digital_count: number;
  paper_only_count: number;
  lat: number | null;
  lng: number | null;
  majors: string[];      // 이 시장에 존재하는 업종 대분류
  subs: string[];        // 소분류
};

export type Store = {
  id: number;
  market_id: number;
  name: string;
  region: string;
  items: string | null;
  paper: boolean;
  digital: boolean;
  year: string | null;
};
