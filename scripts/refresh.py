#!/usr/bin/env python3
"""Save a Township of Langley business-licence file. No API key is used."""
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
LAYER = "https://services5.arcgis.com/frpHL0Fv8koQRVWY/arcgis/rest/services/Business_Licenses/FeatureServer/0/query"
FIELDS = ",".join([
    "FID", "Business_Name", "Civic_Unit", "Civic_House", "Civic_Street",
    "CommunityName", "Phone", "Licence_Desc", "NAICS_Primary", "NAICS_Primary_Desc",
    "Latitude", "Longitude",
])


def clean(value):
    return " ".join(str(value or "").replace("\n", " ").split())


def trade_name(naics):
    parts = [part.strip() for part in clean(naics).split("/") if part.strip()]
    return parts[-1] if parts else ""


def point(lat, lon):
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None, None
    if not (48 <= lat <= 50 and -124 <= lon <= -121):
        return None, None
    return round(lat, 5), round(lon, 5)


def rows_from(features):
    rows = []
    for feature in features:
        attr = feature.get("attributes") or {}
        name = clean(attr.get("Business_Name"))
        if not name:
            continue
        lat, lon = point(attr.get("Latitude"), attr.get("Longitude"))
        rows.append({
            "id": str(attr.get("FID")),
            "name": name,
            "unit": clean(attr.get("Civic_Unit")),
            "house": clean(attr.get("Civic_House")),
            "street": clean(attr.get("Civic_Street")),
            "community": clean(attr.get("CommunityName")),
            "phone": clean(attr.get("Phone")),
            "trade": clean(attr.get("Licence_Desc")),
            "naics": trade_name(attr.get("NAICS_Primary_Desc")),
            "code": clean(attr.get("NAICS_Primary")),
            "lat": lat,
            "lon": lon,
        })
    rows.sort(key=lambda row: (row["name"].casefold(), row["community"].casefold(), row["id"]))
    return rows


def fetch_all():
    features = []
    offset = 0
    while True:
        query = urlencode({
            "where": "1=1",
            "outFields": FIELDS,
            "returnGeometry": "false",
            "orderByFields": "FID",
            "resultOffset": offset,
            "resultRecordCount": 2000,
            "f": "json",
        })
        with urlopen(f"{LAYER}?{query}", timeout=90) as response:
            payload = json.load(response)
        if payload.get("error"):
            raise SystemExit(f"Township layer refused the request: {payload['error'].get('message', 'error')}")
        batch = payload.get("features") or []
        features.extend(batch)
        if not payload.get("exceededTransferLimit") or not batch:
            break
        offset += len(batch)
        if offset > 20000:
            raise SystemExit("The licence layer returned more pages than expected")
    if len(features) < 1000:
        raise SystemExit(f"Only {len(features)} licence rows came back; the previous file was left in place")
    return features


def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def publish(retrieved, licences):
    config = json.loads((ROOT / "web" / "config.json").read_text(encoding="utf-8"))
    retain = int(config.get("retain", 6))
    capture_id = retrieved
    folder = ROOT / "web" / "data" / "captures"
    folder.mkdir(parents=True, exist_ok=True)
    capture = {
        "id": capture_id,
        "retrieved": retrieved,
        "coverage": "full",
        "source": LAYER.split("/query")[0],
        "licences": licences,
    }
    atomic(folder / f"{capture_id}.json", json.dumps(capture, ensure_ascii=False, separators=(",", ":")))
    index_path = ROOT / "web" / "data" / "index.json"
    previous = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"captures": []}
    captures = [item for item in previous.get("captures", []) if item.get("id") != capture_id]
    captures.insert(0, {
        "id": capture_id,
        "file": f"captures/{capture_id}.json",
        "retrieved": retrieved,
        "licences": len(licences),
        "coverage": "full",
    })
    kept = {item["id"] for item in captures[:retain]}
    for stale in folder.glob("*.json"):
        if stale.stem not in kept:
            stale.unlink()
    atomic(index_path, json.dumps({
        "source": "https://data-tol.opendata.arcgis.com/datasets/c80ce8a03364426aa301ca888f149272",
        "captures": captures[:retain],
    }, indent=2))
    mapped = sum(1 for row in licences if row["lat"] is not None)
    atomic(ROOT / "web" / "data" / "status.json", json.dumps({
        "retrieved": retrieved,
        "licences": len(licences),
        "mapped": mapped,
        "coverage": "full",
    }, indent=2))


def main():
    from datetime import datetime, timezone
    retrieved = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    licences = rows_from(fetch_all())
    if len(licences) < 1000:
        raise SystemExit("Too few named licences; the previous file was left in place")
    publish(retrieved, licences)
    print(f"Saved {len(licences)} licences as {retrieved}")


if __name__ == "__main__":
    main()
