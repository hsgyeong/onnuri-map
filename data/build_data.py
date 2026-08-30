"""
온누리상품권 가맹점 CSV -> 정규화된 markets.json / stores.json 생성

원본 CSV 컬럼:
  가맹점명, 소속 시장명(또는 상점가), 소재지(시/도), 취급품목,
  지류형 가맹 여부(Y/N), 디지털형 가맹 여부(Y/N), 등록년도

출력:
  data/markets.json : 시장/상점가 단위 집계 (지도 핀 후보) - 좌표는 이후 지오코딩 단계에서 채움
  data/stores.json  : 개별 가맹점 (market_id 로 시장에 연결)
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "소상공인시장진흥공단_전국 온누리상품권 가맹점 현황_20250731.csv"
OUT_DIR = ROOT / "data"


def slugify(text: str) -> str:
    t = re.sub(r"\s+", "-", text.strip())
    t = re.sub(r"[^0-9A-Za-z가-힣\-]", "", t)
    return t


def market_key(name: str, region: str) -> str:
    # 같은 이름의 시장이 다른 시/도에 있을 수 있으므로 (이름, 시도) 조합을 키로 사용
    return f"{region}::{name}"


def main() -> None:
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        rows = list(reader)

    print(f"원본 레코드 수: {len(rows):,}")

    markets: dict[str, dict] = {}
    stores: list[dict] = []

    for i, row in enumerate(rows):
        if len(row) < 7:
            continue
        name, market_name, region, items, paper, digital, year = [c.strip() for c in row[:7]]
        key = market_key(market_name, region)

        if key not in markets:
            markets[key] = {
                "id": len(markets) + 1,
                "name": market_name,
                "region": region,
                "store_count": 0,
                "digital_count": 0,   # 디지털형(Y) 가맹점 수
                "paper_only_count": 0,  # 지류 전용(디지털 N) 수
                # 좌표는 지오코딩 단계에서 채움
                "lat": None,
                "lng": None,
                "geocode_query": f"{region} {market_name}",
            }
        m = markets[key]
        m["store_count"] += 1
        is_digital = digital.upper() == "Y"
        if is_digital:
            m["digital_count"] += 1
        else:
            m["paper_only_count"] += 1

        stores.append({
            "id": i + 1,
            "market_id": m["id"],
            "name": name,
            "region": region,
            "items": items,
            "paper": paper.upper() == "Y",
            "digital": is_digital,
            "year": year,
        })

    market_list = sorted(markets.values(), key=lambda x: x["id"])

    (OUT_DIR / "markets.json").write_text(
        json.dumps(market_list, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (OUT_DIR / "stores.json").write_text(
        json.dumps(stores, ensure_ascii=False), encoding="utf-8"
    )

    print(f"시장/상점가 수: {len(market_list):,}")
    print(f"가맹점 수: {len(stores):,}")
    print("\n지역별 시장 수 상위:")
    by_region: dict[str, int] = {}
    for m in market_list:
        by_region[m["region"]] = by_region.get(m["region"], 0) + 1
    for r, c in sorted(by_region.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c:,}개 시장")
    print("\n출력 완료: data/markets.json, data/stores.json")


if __name__ == "__main__":
    main()
