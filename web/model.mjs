// Keep transformations separate from the DOM so they can be tested directly.

export function licenceKey(row) {
  return ["name", "unit", "house", "street", "trade"]
    .map((field) => String(row?.[field] || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export function formatAddress(row) {
  const street = [row?.house, row?.street].filter(Boolean).join(" ");
  if (row?.unit && street) return `${row.unit}–${street}`;
  return row?.unit || street || "Address not published";
}

export function formatWhen(value) {
  const text = String(value || "");
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  const iso = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`
    : text;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return text || "date not published";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date).replace(/\./g, "");
}

export function searchLicences(rows, query) {
  const terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...(rows || [])];
  return (rows || []).filter((row) => {
    const haystack = [row.name, row.trade, row.naics, row.code, row.community, row.street, row.house, row.unit]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function communityOptions(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const name = row.community?.trim() || "Community not listed";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en-CA"));
}

function counts(rows) {
  const tally = new Map();
  for (const row of rows || []) {
    const key = licenceKey(row);
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return tally;
}

function excess(rows, other) {
  const seen = new Map();
  const extra = [];
  for (const row of rows || []) {
    const key = licenceKey(row);
    const used = (seen.get(key) || 0) + 1;
    seen.set(key, used);
    if (used > (other.get(key) || 0)) extra.push(row);
  }
  return extra;
}

export function compareLicences(older, newer) {
  if (!older || !newer || older.coverage !== "full" || newer.coverage !== "full") {
    return { reliable: false, appeared: [], left: [] };
  }
  return {
    reliable: true,
    appeared: excess(newer.licences, counts(older.licences)),
    left: excess(older.licences, counts(newer.licences)),
  };
}

export function boundsFor(rows) {
  const placed = (rows || []).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
  if (!placed.length) return null;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const row of placed) {
    minLat = Math.min(minLat, row.lat);
    maxLat = Math.max(maxLat, row.lat);
    minLon = Math.min(minLon, row.lon);
    maxLon = Math.max(maxLon, row.lon);
  }
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.012);
  const lonPad = Math.max((maxLon - minLon) * 0.12, 0.012);
  return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLon: minLon - lonPad, maxLon: maxLon + lonPad };
}

export function project(row, bounds, width, height) {
  const x = ((row.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
  const y = ((bounds.maxLat - row.lat) / (bounds.maxLat - bounds.minLat)) * height;
  return [x, y];
}
