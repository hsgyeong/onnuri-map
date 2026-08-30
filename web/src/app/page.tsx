"use client";

import { useEffect, useMemo, useState } from "react";
import { type Market } from "@/lib/supabase";
import { MAJORS, SUBS_BY_MAJOR } from "@/lib/categories";
import KakaoMap from "@/components/KakaoMap";
import MarketPanel from "@/components/MarketPanel";

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<Market | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 필터 상태
  const [sido, setSido] = useState("전체");
  const [sigungu, setSigungu] = useState("전체");
  const [catMajor, setCatMajor] = useState("전체");
  const [catSub, setCatSub] = useState("전체");

  useEffect(() => {
    // 시장 데이터는 정적 파일에서 (2,700행 · 자주 안 바뀜). 가맹점만 Supabase.
    fetch("/markets.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("markets.json 로드 실패"))))
      .then((data: Market[]) => setMarkets(data.filter((m) => m.lat != null)))
      .catch((e) => setLoadError(e.message));
  }, []);

  // 지역: 시/도 목록
  const sidoList = useMemo(() => {
    const s = new Set(markets.map((m) => m.region));
    return ["전체", ...Array.from(s).sort()];
  }, [markets]);

  // 지역: 선택된 시/도 안의 시/군/구 목록
  const sigunguList = useMemo(() => {
    if (sido === "전체") return ["전체"];
    const s = new Set(
      markets.filter((m) => m.region === sido && m.sigungu).map((m) => m.sigungu as string)
    );
    return ["전체", ...Array.from(s).sort()];
  }, [markets, sido]);

  // 카테고리: 소분류 목록
  const subList = useMemo(() => {
    if (catMajor === "전체") return ["전체"];
    return ["전체", ...(SUBS_BY_MAJOR[catMajor] ?? [])];
  }, [catMajor]);

  const visible = useMemo(() => {
    return markets.filter((m) => {
      if (sido !== "전체" && m.region !== sido) return false;
      if (sigungu !== "전체" && m.sigungu !== sigungu) return false;
      if (catMajor !== "전체" && !m.majors.includes(catMajor)) return false;
      if (catSub !== "전체" && !m.subs.includes(catSub)) return false;
      return true;
    });
  }, [markets, sido, sigungu, catMajor, catSub]);

  const locate = () => {
    if (!navigator.geolocation) return alert("이 브라우저는 위치 조회를 지원하지 않습니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert("위치 권한을 허용해주세요."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <main className="relative flex h-dvh flex-col">
      <header className="z-20 border-b border-slate-100 bg-white">
        {/* 1행: 타이틀 + 내 위치 */}
        <div className="flex items-center gap-3 px-4 pt-3">
          <h1 className="text-base font-bold text-slate-900">
            온누리맵 <span className="hidden font-normal text-slate-400 sm:inline">| 내 주변 온누리 사용처</span>
          </h1>
          <button
            onClick={locate}
            className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            📍 내 위치
          </button>
        </div>

        {/* 2행: 필터 바 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <FilterGroup label="지역">
            <Select value={sido} onChange={(v) => { setSido(v); setSigungu("전체"); }} options={sidoList} />
            <Select
              value={sigungu}
              onChange={setSigungu}
              options={sigunguList}
              disabled={sido === "전체"}
              placeholder="시/군/구"
            />
          </FilterGroup>

          <FilterGroup label="업종">
            <Select
              value={catMajor}
              onChange={(v) => { setCatMajor(v); setCatSub("전체"); }}
              options={["전체", ...MAJORS.map((m) => m.name)]}
              render={(v) => {
                const e = MAJORS.find((m) => m.name === v)?.emoji;
                return v === "전체" ? "전체" : `${e ?? ""} ${v}`;
              }}
            />
            <Select
              value={catSub}
              onChange={setCatSub}
              options={subList}
              disabled={catMajor === "전체"}
              placeholder="소분류"
            />
          </FilterGroup>

          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {visible.length.toLocaleString()}개 시장
          </span>
        </div>
      </header>

      <div className="relative flex-1">
        {loadError ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-slate-500">
            데이터를 불러오지 못했습니다: {loadError}
          </div>
        ) : (
          <KakaoMap
            markets={visible}
            onSelect={setSelected}
            userPos={userPos}
            fitToken={sido === "전체" ? "" : `${sido}|${sigungu}`}
          />
        )}

        <MarketPanel
          market={selected}
          onClose={() => setSelected(null)}
          presetMajor={catMajor}
          presetSub={catSub}
        />
      </div>
    </main>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  render?: (v: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-300"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "전체" && disabled && placeholder ? placeholder : render ? render(o) : o}
        </option>
      ))}
    </select>
  );
}
