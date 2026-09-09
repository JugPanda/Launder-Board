const MAX_CSV_BYTES = 256 * 1024;
const MAX_CSV_ROWS = 1_000;
const REQUIRED_HEADERS = ["occurred_at", "machine_kind", "cycle_status"] as const;

export class ActivityCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityCsvError";
  }
}

function parseRecords(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new ActivityCsvError("CSV contains an unterminated quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export function parseActivityCsv(csv: string): Array<Record<string, string>> {
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
    throw new ActivityCsvError("CSV exceeds the 256 KB import limit");
  }
  const records = parseRecords(csv.replace(/^\uFEFF/, ""));
  const header = records.shift()?.map((value) => value.trim().toLowerCase());
  if (!header) throw new ActivityCsvError("CSV is empty");
  if (new Set(header).size !== header.length) throw new ActivityCsvError("CSV has duplicate headers");
  for (const required of REQUIRED_HEADERS) {
    if (!header.includes(required)) throw new ActivityCsvError(`CSV is missing ${required}`);
  }
  if (records.length > MAX_CSV_ROWS) throw new ActivityCsvError("CSV exceeds the 1000 row limit");
  return records.map((values) =>
    Object.fromEntries(header.map((name, index) => [name, values[index]?.trim() ?? ""])),
  );
}
