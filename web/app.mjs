import {
  boundsFor, communityOptions, compareLicences, formatAddress, formatWhen, project, searchLicences,
} from "./model.mjs";

const queryInput = document.querySelector("#query");
const communitySelect = document.querySelector("#community");
const changeSelect = document.querySelector("#change");
const trades = document.querySelector("#trades");
const finding = document.querySelector("#finding");
const map = document.querySelector("#map");
const mapNote = document.querySelector("#map-note");
const rows = document.querySelector("#rows");
const caption = document.querySelector("#table-caption");
const more = document.querySelector("#more");
const PAGE = 40;
const state = { config: { query: "", trades: [] }, index: null, captures: new Map(), shown: PAGE };

function text(node, value) {
  node.textContent = value;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read ${url}`);
  return response.json();
}

function remember(key, value) {
  try { localStorage.setItem(`coolcode:langleytrades:${key}`, value); } catch { /* private mode */ }
}

function recall(key) {
  try { return localStorage.getItem(`coolcode:langleytrades:${key}`) || ""; } catch { return ""; }
}

function communityName(row) {
  return row.community?.trim() || "Community not listed";
}

function selectedCapture() {
  const listed = state.index?.captures || [];
  return state.captures.get(listed[0]?.id) || null;
}

function previousCapture() {
  const listed = state.index?.captures || [];
  return listed[1] ? state.captures.get(listed[1].id) || null : null;
}

function matchingRows() {
  const current = selectedCapture();
  if (!current) return [];
  const previous = previousCapture();
  const diff = compareLicences(previous, current);
  let pool = current.licences || [];
  if (changeSelect.value === "appeared") pool = diff.reliable ? diff.appeared : [];
  if (changeSelect.value === "left") pool = diff.reliable ? diff.left : [];
  let matched = searchLicences(pool, queryInput.value);
  const community = communitySelect.value;
  if (community) matched = matched.filter((row) => communityName(row) === community);
  return matched;
}

function drawMap(matched) {
  clear(map);
  const placed = matched.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
  const bounds = boundsFor(placed);
  text(mapNote, placed.length
    ? `${placed.length.toLocaleString("en-CA")} of ${matched.length.toLocaleString("en-CA")} have a published location. The list is the record.`
    : "None of these licences have a published location.");
  if (!bounds) return;
  const width = 800;
  const height = 420;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const gone = changeSelect.value === "left";
  for (const row of placed) {
    const [x, y] = project(row, bounds, width, height);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
    dot.setAttribute("r", "4");
    if (gone) dot.classList.add("gone");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${row.name}, ${formatAddress(row)}`;
    dot.append(title);
    svg.append(dot);
  }
  map.append(svg);
}

function drawTable(matched) {
  clear(rows);
  const visible = matched.slice(0, state.shown);
  for (const row of visible) {
    const tr = document.createElement("tr");
    for (const value of [row.name, row.trade || row.naics || "Licence description not published", formatAddress(row), communityName(row), row.phone || "—"]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    rows.append(tr);
  }
  more.hidden = visible.length >= matched.length;
  text(more, `Show more (${(matched.length - visible.length).toLocaleString("en-CA")} left)`);
  text(caption, `${matched.length.toLocaleString("en-CA")} matching licences`);
}

function render() {
  const current = selectedCapture();
  if (!current) {
    text(finding, "The licence file is not in this copy of the page.");
    return;
  }
  const previous = previousCapture();
  const diff = compareLicences(previous, current);
  const matched = matchingRows();
  const when = formatWhen(current.retrieved);
  const asked = queryInput.value.trim();
  const lead = asked
    ? `${matched.length.toLocaleString("en-CA")} licences match “${asked}”`
    : `${matched.length.toLocaleString("en-CA")} licences are in this file`;
  let comparison = `The Township file was saved ${when}. Only one full file is saved here, so names cannot yet be marked as new or gone.`;
  if (diff.reliable) {
    const previousWhen = formatWhen(previous.retrieved);
    comparison = `${diff.appeared.length.toLocaleString("en-CA")} names in this file were not in the ${previousWhen} file. ${diff.left.length.toLocaleString("en-CA")} names from that file are no longer listed. A name missing from a partial extract is not treated as closed.`;
  } else if (previous && previous.coverage !== "full") {
    comparison = `The ${formatWhen(previous.retrieved)} file is a partial extract, so missing names are not treated as closed.`;
  }
  if (changeSelect.value !== "all" && !diff.reliable) {
    text(finding, `${lead}. ${comparison}`);
  } else {
    text(finding, `${lead}. ${comparison}`);
  }
  for (const button of trades.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.dataset.query === queryInput.value.trim().toLowerCase() ? "true" : "false");
  }
  drawMap(matched);
  drawTable(matched);
  remember("query", queryInput.value);
  remember("community", communitySelect.value);
  remember("change", changeSelect.value);
}

function fillCommunities() {
  const current = communitySelect.value || recall("community");
  clear(communitySelect);
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All communities";
  communitySelect.append(all);
  const currentFile = selectedCapture();
  for (const [name, count] of communityOptions(currentFile?.licences || [])) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} (${count.toLocaleString("en-CA")})`;
    communitySelect.append(option);
  }
  if ([...communitySelect.options].some((option) => option.value === current)) communitySelect.value = current;
}

async function main() {
  try {
    state.config = await loadJson(new URL("./config.json", import.meta.url));
    state.index = await loadJson(new URL("./data/index.json", import.meta.url));
    for (const item of state.index.captures || []) {
      state.captures.set(item.id, await loadJson(new URL(`./data/${item.file}`, import.meta.url)));
    }
  } catch {
    text(finding, "The licence file could not be read. The last good copy was not replaced.");
    return;
  }
  const presets = Array.isArray(state.config.trades) ? state.config.trades : [];
  for (const trade of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.query = String(trade).toLowerCase();
    button.textContent = trade;
    button.addEventListener("click", () => {
      queryInput.value = trade;
      state.shown = PAGE;
      render();
    });
    trades.append(button);
  }
  fillCommunities();
  const saved = recall("query");
  queryInput.value = saved || state.config.query || "";
  const savedChange = recall("change");
  if ([...changeSelect.options].some((option) => option.value === savedChange)) changeSelect.value = savedChange;
  queryInput.addEventListener("input", () => { state.shown = PAGE; render(); });
  communitySelect.addEventListener("change", () => { state.shown = PAGE; render(); });
  changeSelect.addEventListener("change", () => { state.shown = PAGE; render(); });
  more.addEventListener("click", () => { state.shown += PAGE; render(); });
  render();
}

main();
