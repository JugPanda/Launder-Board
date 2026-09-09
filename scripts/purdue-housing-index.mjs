// Run with server-side TYPESENSE_HOST / PORT / PROTOCOL / API_KEY.
// This touches only the canonical public-metadata collection, not live standings.
import { readFile } from "node:fs/promises";
const collection = "purdue_housing_catalog_v1";
const halls = JSON.parse(await readFile(new URL("../lib/purdue/halls.json", import.meta.url), "utf8"));
const { TYPESENSE_HOST: host, TYPESENSE_ADMIN_API_KEY: key } = process.env;
if (!host || !key) throw new Error("TYPESENSE_HOST and TYPESENSE_ADMIN_API_KEY are required");
const protocol = process.env.TYPESENSE_PROTOCOL || "https";
const base = `${protocol}://${host}:${process.env.TYPESENSE_PORT || (protocol === "https" ? "443" : "8108")}`;
async function request(path, options = {}) {
  return fetch(base + path, { ...options, headers: { "X-TYPESENSE-API-KEY": key, "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(10000) });
}
const fields = [
  { name: "slug", type: "string" }, { name: "officialName", type: "string" }, { name: "aliases", type: "string[]" },
  ...["campus", "housingType", "term", "laundryPaymentCategory"].map(name => ({ name, type: "string", facet: true })),
  { name: "active", type: "bool", facet: true },
];
const existing = await request(`/collections/${collection}`);
if (existing.status === 404) {
  const created = await request("/collections", { method: "POST", body: JSON.stringify({ name: collection, fields }) });
  if (!created.ok) throw new Error(`Collection creation failed: ${created.status}`);
} else if (!existing.ok) throw new Error(`Collection lookup failed: ${existing.status}`);
const documents = halls.map(({ slug, officialName, aliases, campus, housingType, term, active, laundryPaymentCategory }) => ({ id: slug, slug, officialName, aliases, campus, housingType, term, active, laundryPaymentCategory: laundryPaymentCategory ?? "unknown" }));
const imported = await request(`/collections/${collection}/documents/import?action=upsert`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: documents.map(d => JSON.stringify(d)).join("\n") });
if (!imported.ok) throw new Error(`Import failed: ${imported.status}`);
const results = (await imported.text()).trim().split("\n").map(line => JSON.parse(line));
if (results.length !== 18 || results.some(r => !r.success)) throw new Error("Canonical import incomplete");
const exported = await request(`/collections/${collection}/documents/export`);
if (!exported.ok) throw new Error("Read-back failed");
const actual = (await exported.text()).trim().split("\n").map(line => JSON.parse(line));
if (actual.length !== 18 || documents.some(d => !actual.some(a => Object.keys(d).every(k => JSON.stringify(a[k]) === JSON.stringify(d[k]))))) throw new Error("Read-back does not match canonical catalog");
console.log(`Verified ${actual.length} canonical hall documents in ${collection}`);
