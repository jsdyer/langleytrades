import test from "node:test";
import assert from "node:assert/strict";
import {
  boundsFor, communityOptions, compareLicences, formatAddress, licenceKey, searchLicences,
} from "../web/model.mjs";

const roofing = {
  id: "1", name: "A-Corn Roofing", unit: "101", house: "26641", street: "Fraser Hwy",
  community: "Aldergrove", trade: "Roofing contractor", naics: "Roofing contractors", code: "238160",
  lat: 49.06, lon: -122.48, phone: "604-555-0100",
};
const cafe = {
  id: "2", name: "Chatkora", unit: "", house: "27100", street: "Fraser Hwy",
  community: "Aldergrove", trade: "Takeout restaurant", naics: "Limited-service eating places", code: "722512",
  lat: 49.05, lon: -122.47, phone: "",
};

test("a trade outside the starter list still matches", () => {
  const presets = ["restaurant", "salon"];
  assert.equal(presets.includes("roofing"), false);
  assert.deepEqual(searchLicences([roofing, cafe], "roofing").map((row) => row.name), ["A-Corn Roofing"]);
});

test("search terms are combined and are not limited to the preset count", () => {
  assert.equal(searchLicences([roofing, cafe], "fraser restaurant").length, 1);
  assert.equal(searchLicences([roofing, cafe], "").length, 2);
});

test("the same business keeps one key when the record number changes", () => {
  assert.equal(licenceKey(roofing), licenceKey({ ...roofing, id: "999" }));
});

test("a partial earlier file does not count a missing licence as gone", () => {
  const older = { coverage: "partial", licences: [cafe] };
  const newer = { coverage: "full", licences: [roofing] };
  const diff = compareLicences(older, newer);
  assert.equal(diff.reliable, false);
  assert.deepEqual(diff.left, []);
  assert.deepEqual(diff.appeared, []);
});

test("a full pair shows who arrived and who left", () => {
  const older = { coverage: "full", licences: [cafe, roofing] };
  const newer = { coverage: "full", licences: [{ ...roofing, id: "50" }, { ...cafe, name: "New Cafe", trade: "Cafe" }] };
  const diff = compareLicences(older, newer);
  assert.equal(diff.reliable, true);
  assert.deepEqual(diff.appeared.map((row) => row.name), ["New Cafe"]);
  assert.deepEqual(diff.left.map((row) => row.name), ["Chatkora"]);
});

test("address and community come from the published fields", () => {
  assert.equal(formatAddress(roofing), "101–26641 Fraser Hwy");
  assert.equal(formatAddress({}), "Address not published");
  assert.deepEqual(communityOptions([roofing, { community: "" }]), [["Aldergrove", 1], ["Community not listed", 1]]);
});

test("one mapped licence still has a frame", () => {
  const bounds = boundsFor([roofing, { lat: null, lon: null }]);
  assert.ok(bounds.maxLat > roofing.lat && bounds.minLon < roofing.lon);
});
