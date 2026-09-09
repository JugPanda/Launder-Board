import { describe, expect, it } from "vitest";

import {
  getServerEnv,
  getSupabaseServerEnv,
  getTypesenseServerEnv,
} from "@/lib/env";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TYPESENSE_HOST: "search.example.com",
  TYPESENSE_PORT: "443",
  TYPESENSE_PROTOCOL: "https",
  TYPESENSE_ADMIN_API_KEY: "admin-key",
  TYPESENSE_SEARCH_API_KEY: "search-key",
};

describe("server environment contract", () => {
  it("rejects missing Supabase credentials when Supabase initializes", () => {
    expect(() => getSupabaseServerEnv({})).toThrow(
      "Invalid Supabase server environment",
    );
  });

  it("rejects missing Typesense credentials when Typesense initializes", () => {
    expect(() => getTypesenseServerEnv({})).toThrow(
      "Invalid Typesense server environment",
    );
  });

  it("parses and normalizes every integration credential", () => {
    const environment = getServerEnv(validEnvironment);

    expect(environment).toEqual({
      ...validEnvironment,
      TYPESENSE_PORT: 443,
    });
  });

  it("does not include secret values in validation errors", () => {
    expect(() =>
      getTypesenseServerEnv({
        ...validEnvironment,
        TYPESENSE_PROTOCOL: "ftp",
        TYPESENSE_ADMIN_API_KEY: "do-not-print-this",
      }),
    ).toThrow(/^Invalid Typesense server environment:/);

    try {
      getTypesenseServerEnv({
        ...validEnvironment,
        TYPESENSE_PROTOCOL: "ftp",
        TYPESENSE_ADMIN_API_KEY: "do-not-print-this",
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-print-this");
    }
  });
});
