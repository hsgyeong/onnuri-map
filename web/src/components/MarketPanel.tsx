"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, type Market, type Store } from "@/lib/supabase";
import { classify, MAJORS } from "@/lib/categories";

type Props = {
  market: Market | null;
  onClose: () => void;
  presetMajor?: string;
  presetSub?: string;
};

export default function MarketPanel({ market, onClose, presetMajor = "전체", presetSub = "전체" }: Props) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [onlyDigital, setOnlyDigital] = useState(false);
  const [major, setMajor] = useState("전체");
  const [sub, setSub] = useState("전체");

  useEffect(() => {
    if (!market) return;
    setQ(""); setOnlyDigital(false); setMajor(presetMajor); setSub(presetSub);
    setLoading(true);
    supabase
      .from("stores")
      .select("*")
      .eq("market_id", market.id)
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setStores((data as Store[]) ?? []);
        setLoading(false);
      });
  }, [market]);

  // 가게별 카테고리 (한 번만 계산)
  const cats = useMemo(
    () => new Map(stores.map((s) => [s.id, classify(s.items)])),
    [stores]
  );

  // 이 시장에 존재하는 대분류 + 건수
  const majorsPresent = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of stores) {
      const m = cats.get(s.id)!.major;
      count.set(m, (count.get(m) ?? 0) + 1);
    }
    return MAJORS.filter((m) => count.has(m.name)).map((m) => ({
      ...m,
      count: count.get(m.name)!,
    }));
  }, [stores, cats]);

  // 선택된 대분류 안의 소분류 + 건수
  const subsPresent = useMemo(() => {
    if (major === "전체") return [];
    const count = new Map<string, number>();
    for (const s of stores) {
      const c = cats.get(s.id)!;
      if (c.major !== major) continue;
      count.set(c.sub, (count.get(c.sub) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [stores, cats, major]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const c = cats.get(s.id)!;
      if (major !== "전체" && c.major !== major) return false;
      if (sub !== "전체" && c.sub !== sub) return false;
      if (onlyDigital && !s.digital) return false;
      if (q && !`${s.name} ${s.items ?? ""}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [stores, cats, q, onlyDigital, major, sub]);

  if (!market) return null;

  const pickMajor = (m: string) => { setMajor(m); setSub("전체"); };

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[85%] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-2xl">
      {/* 모바일 드래그 핸들 */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />
      <div className="flex items-start justify-between border-b border-slate-100 px-4 pb-3 pt-3 sm:pt-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{market.name}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {market.region} · 가맹점 {market.store_count.toLocaleString()}곳
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* 대분류 칩 (여러 줄로 감싸 모두 보이도록) */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2.5">
        <Chip active={major === "전체"} onClick={() => pickMajor("전체")}>
          전체 {stores.length}
        </Chip>
        {majorsPresent.map((m) => (
          <Chip key={m.name} active={major === m.name} onClick={() => pickMajor(m.name)}>
            {m.emoji} {m.name} {m.count}
          </Chip>
        ))}
      </div>

      {/* 소분류 칩 (대분류 선택 시) */}
      {subsPresent.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2.5">
          <Chip small active={sub === "전체"} onClick={() => setSub("전체")}>
            전체
          </Chip>
          {subsPresent.map(([name, c]) => (
            <Chip key={name} small active={sub === name} onClick={() => setSub(name)}>
              {name} {c}
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-2 border-b border-slate-100 p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="가게 이름·품목 검색 (예: 떡, 정육)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyDigital}
            onChange={(e) => setOnlyDigital(e.target.checked)}
          />
          디지털(모바일·카드) 온누리 사용 가능만 보기
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">조건에 맞는 가맹점이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtered.map((s) => {
              const c = cats.get(s.id)!;
              return (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <div className="flex shrink-0 gap-1">
                      <Badge on>지류</Badge>
                      <Badge on={s.digital}>디지털</Badge>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {c.sub !== "기타" && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                        {c.sub}
                      </span>
                    )}
                    {s.items && <p className="text-sm text-slate-500">{s.items}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
        {filtered.length.toLocaleString()}곳 표시 중
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  small,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full font-medium transition ${
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      } ${
        active
          ? "bg-blue-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ children, on }: { children: React.ReactNode; on: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        on ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-300 line-through"
      }`}
    >
      {children}
    </span>
  );
}
