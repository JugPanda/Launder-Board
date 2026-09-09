import type { CollectionCreateSchema } from "typesense";

export const PARTICIPANTS_COLLECTION = "participants_v1";
export const PARTICIPANTS_ALIAS = "participants";
export const HALL_RESULTS_COLLECTION = "hall_results_v1";
export const HALL_RESULTS_ALIAS = "hall_results";

export const participantsSchema = {
  name: PARTICIPANTS_COLLECTION,
  fields: [
    { name: "id", type: "string" },
    { name: "display_name", type: "string", sort: true },
    { name: "tracking_state", type: "string", facet: true },
    { name: "activity_anchor_day", type: "int64", optional: true, sort: true },
    { name: "reminder_due_day", type: "int64", optional: true, sort: true },
    { name: "data_fresh_through_day", type: "int64", optional: true, sort: true },
    { name: "projection_version", type: "int64", sort: true },
  ],
} as const satisfies CollectionCreateSchema;

export const hallResultsSchema = {
  name: HALL_RESULTS_COLLECTION,
  fields: [
    { name: "id", type: "string" },
    { name: "competition_id", type: "string", facet: true },
    { name: "week_start_day", type: "int64", facet: true, sort: true },
    { name: "hall_id", type: "string", facet: true },
    { name: "hall_name", type: "string", sort: true },
    { name: "eligible_count", type: "int32", sort: true },
    { name: "credited_count", type: "int32", sort: true },
    { name: "participation_rate", type: "float", sort: true },
    { name: "rank", type: "int32", sort: true },
    { name: "minimum_met", type: "bool", facet: true },
    { name: "is_public", type: "bool", facet: true },
    { name: "projection_version", type: "int64", sort: true },
  ],
} as const satisfies CollectionCreateSchema;
