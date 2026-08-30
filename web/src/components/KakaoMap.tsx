"use client";

import { useEffect, useRef } from "react";
import type { Market } from "@/lib/supabase";

declare global {
  interface Window {
    kakao: any;
  }
}

type Props = {
  markets: Market[];
  onSelect: (m: Market) => void;
  userPos: { lat: number; lng: number } | null;
  fitToken?: string; // 값이 바뀌면 현재 마커들에 맞춰 지도 범위 조정 (지역 필터용)
};

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

export default function KakaoMap({ markets, onSelect, userPos, fitToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const marketsRef = useRef<Market[]>(markets);
  marketsRef.current = markets;

  // SDK 로드 + 지도 생성
  useEffect(() => {
    if (!KAKAO_KEY) return;
    const scriptId = "kakao-map-sdk";

    const init = () => {
      window.kakao.maps.load(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(36.5, 127.8), // 대한민국 중심
          level: 13,
        });
        mapRef.current = map;
        clustererRef.current = new window.kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 7,
          gridSize: 80,
        });
        renderMarkers();
      });
    };

    if (window.kakao?.maps) {
      init();
      return;
    }
    if (document.getElementById(scriptId)) {
      document.getElementById(scriptId)!.addEventListener("load", init);
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=clusterer`;
    script.addEventListener("load", init);
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커 렌더
  const renderMarkers = () => {
    const kakao = window.kakao;
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (!kakao || !map || !clusterer) return;

    clusterer.clear();
    const markers = markets
      .filter((m) => m.lat != null && m.lng != null)
      .map((m) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(m.lat, m.lng),
          title: m.name,
        });
        kakao.maps.event.addListener(marker, "click", () => {
          map.panTo(new kakao.maps.LatLng(m.lat, m.lng));
          onSelect(m);
        });
        return marker;
      });
    clusterer.addMarkers(markers);
  };

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets]);

  // 지역 필터 변경 시 해당 마커들에 맞춰 지도 범위 조정
  useEffect(() => {
    if (fitToken === undefined) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    const pts = marketsRef.current.filter((m) => m.lat != null && m.lng != null);
    if (fitToken === "" || pts.length === 0) {
      // 필터 해제: 전국 뷰로
      map.setLevel(13);
      map.panTo(new kakao.maps.LatLng(36.5, 127.8));
      return;
    }
    const bounds = new kakao.maps.LatLngBounds();
    pts.forEach((m) => bounds.extend(new kakao.maps.LatLng(m.lat, m.lng)));
    map.setBounds(bounds);
  }, [fitToken]);

  // 내 위치로 이동 + 표시
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !userPos) return;
    const pos = new kakao.maps.LatLng(userPos.lat, userPos.lng);
    map.setLevel(6);
    map.panTo(pos);
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    userMarkerRef.current = new kakao.maps.Marker({
      position: pos,
      map,
      image: new kakao.maps.MarkerImage(
        "data:image/svg+xml;base64," +
          btoa(
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#2563eb" stroke="white" stroke-width="3"/></svg>`
          ),
        new kakao.maps.Size(24, 24)
      ),
    });
  }, [userPos]);

  if (!KAKAO_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-8 text-center text-slate-500">
        NEXT_PUBLIC_KAKAO_MAP_KEY 가 설정되지 않았습니다.
        <br />
        web/.env.local 에 카카오맵 JavaScript 키를 넣어주세요.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
