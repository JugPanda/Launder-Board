import { act, fireEvent, render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuestDemo from "@/components/guest-demo/GuestDemo";
import { GUEST_PARTICIPANTS, searchGuestParticipants } from "@/lib/guest-demo";

let nudgedIds: string[];
let posts: { id: string; preset: string; createdAt: string }[];
const bootstrap = () => ({ participants: GUEST_PARTICIPANTS, nudgedIds, posts, providers: { database: "supabase", search: "typesense" }, asOf: "2026-09-08" });
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
let api: ReturnType<typeof vi.fn>;
beforeEach(() => {
  nudgedIds = []; posts = [];
  api = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/demo/session" || url === "/api/demo/bootstrap") return response(bootstrap());
    if (url.startsWith("/api/demo/search?")) {
      const params = new URL(url, "https://example.test").searchParams;
      const participants = searchGuestParticipants({ query: params.get("q") ?? "", hall: params.get("hall") ?? "", minDays: Number(params.get("minDays")) });
      return response({ participants, source: "typesense", returnedCount: participants.length });
    }
    if (url === "/api/demo/nudges") { nudgedIds.push(JSON.parse(options?.body as string).recipientId); return response({ ok: true, code: "saved" }); }
    if (url === "/api/demo/posts") { posts = [{ id: "post-1", preset: "fresh_start", createdAt: "2026-09-08T00:00:00Z" }]; return response({ ok: true, code: "saved" }); }
    if (url === "/api/demo/reset") { nudgedIds = []; posts = []; return response({ ok: true }); }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", api);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function ready() { render(<GuestDemo />); await screen.findByRole("heading", { name: /meet your clean-o-meter/i }); }

describe("provider-backed guest demo", () => {
  it("uses only returned profiles and schedules, including remote score changes", async () => {
    const participants = [
      { ...GUEST_PARTICIPANTS[0], id: "remote-1", name: "Cloud Profile", daysSinceWash: 20, scrubStreak: 0, score: 999 },
      { ...GUEST_PARTICIPANTS[6], id: "remote-2", name: "Cloud Mate" },
    ];
    api.mockResolvedValueOnce(response({ ...bootstrap(), participants }));
    await ready();
    expect(screen.getByRole("heading", { name: /Cloud Profile’s demo profile/ })).toBeVisible();
    expect(screen.getByText("20", { selector: "output" })).toBeVisible();
    expect(screen.queryByRole("option", { name: /Avery/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Wash Mates" }));
    expect(screen.getByRole("heading", { name: "Cloud Mate" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Alex" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Leaderboards" }));
    expect(screen.getByRole("heading", { name: "Cloud Profile" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Avery" })).toBeNull();
  });
  it("discards a late Typesense response after filters change", async () => {
    await ready();
    let resolveFirst!: (value: ReturnType<typeof response>) => void;
    let firstSignal: AbortSignal | undefined;
    api.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/demo/search?q=&hall=&minDays=14") {
        firstSignal = options?.signal as AbortSignal;
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve(response({ participants: [], source: "typesense", returnedCount: 0 }));
    });
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    await waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nobody" } });
    await screen.findByText(/no matches\. a clean slate/i);
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => { resolveFirst(response({ participants: [GUEST_PARTICIPANTS[2]], source: "typesense", returnedCount: 1 })); });
    expect(screen.queryByRole("heading", { name: "Riley" })).toBeNull();
    expect(screen.getByText(/no matches\. a clean slate/i)).toBeVisible();
  });
  it("does not claim a save or cooldown when a nudge POST fails", async () => {
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    await screen.findByRole("heading", { name: "Riley" });
    api.mockResolvedValueOnce(response({ ok: false, code: "provider_unavailable" }, false));
    fireEvent.click(screen.getAllByRole("button", { name: /save demo nudge/i })[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/could not confirm/i));
    expect(screen.queryByRole("button", { name: /session cooldown/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /save demo nudge/i })[0]).toBeEnabled();
  });
  it("requires read-back confirmation before claiming a saved preset", async () => {
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Community" }));
    api.mockResolvedValueOnce(response({ ok: true, code: "saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Save a fresh-start update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/could not confirm/i));
    expect(screen.queryByText(/Laundry day is better together!/)).toBeNull();
    expect(screen.getByRole("button", { name: "Save a fresh-start update" })).toBeEnabled();
  });
  it("bootstraps with a same-origin cookie and searches through Typesense", async () => {
    await ready();
    expect(api).toHaveBeenCalledWith("/api/demo/session", expect.objectContaining({ method: "POST", credentials: "same-origin", body: "{}" }));
    expect(screen.getByText(/nothing sent to CSC/i)).toBeVisible();
    expect(screen.getByText(/Supabase profile data/i)).toBeVisible();
    expect(screen.getByText("2026-09-07")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Synthetic profile preview"), { target: { value: "U003" } });
    expect(screen.getByText("32", { selector: "output" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    await screen.findByRole("heading", { name: "Riley" });
    expect(screen.getByText(/Results from Typesense/i)).toBeVisible();
    expect(api).toHaveBeenCalledWith("/api/demo/search?q=&hall=&minDays=14", expect.objectContaining({ credentials: "same-origin", signal: expect.any(AbortSignal) }));
    expect(screen.queryByRole("heading", { name: "Jamie" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nobody" } });
    await screen.findByText(/no matches\. a clean slate/i);
    expect(api).toHaveBeenCalledWith("/api/demo/search?q=nobody&hall=&minDays=14", expect.anything());
  });
  it("never renders bundled people when the provider is unavailable, and retries", async () => {
    api.mockResolvedValueOnce(response({ error: "not_configured" }, false));
    render(<GuestDemo />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/Avery’s demo profile/)).toBeNull();
    expect(screen.queryByText(/Supabase profile data/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await screen.findByRole("heading", { name: /meet your clean-o-meter/i });
  });
  it("handles an empty Supabase cohort without a local fallback", async () => {
    api.mockResolvedValueOnce(response({ ...bootstrap(), participants: [] }));
    render(<GuestDemo />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no eligible profiles/i);
    expect(screen.queryByLabelText("Synthetic profile preview")).toBeNull();
    expect(screen.queryByText(/Avery/)).toBeNull();
  });
  it("shows search outages rather than empty results or a local fallback", async () => {
    await ready();
    api.mockImplementation(async (url: string) => url.startsWith("/api/demo/search?") ? response({ error: "unavailable" }, false) : response(bootstrap()));
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Typesense search is unavailable/i);
    expect(screen.queryByRole("heading", { name: "Riley" })).toBeNull();
    expect(screen.queryByText(/no matches\. a clean slate/i)).toBeNull();
    expect(screen.queryByText(/Results from Typesense/i)).toBeNull();
  });
  it("saves nudges, reads back cooldown across refresh, and resets only session events", async () => {
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    await screen.findByRole("heading", { name: "Riley" });
    fireEvent.click(screen.getAllByRole("button", { name: /save demo nudge/i })[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/no actual person was notified/i));
    expect(api).toHaveBeenCalledWith("/api/demo/nudges", expect.objectContaining({ method: "POST", body: JSON.stringify({ recipientId: "U003", preset: "fresh_start" }) }));
    expect(api).toHaveBeenCalledWith("/api/demo/bootstrap", expect.objectContaining({ credentials: "same-origin" }));
    cleanup(); await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(await screen.findByRole("button", { name: /session cooldown/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /reset demo/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/session events cleared/i));
    await screen.findByRole("heading", { name: "Riley" });
    expect(screen.queryByRole("button", { name: /session cooldown/i })).toBeNull();
    expect(api).toHaveBeenCalledWith("/api/demo/reset", expect.objectContaining({ method: "POST", body: "{}" }));
    fireEvent.click(screen.getByRole("tab", { name: "Leaderboards" }));
    expect(screen.getByRole("heading", { name: "Squeaky Squad" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Stinky Squad" })).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Stinky Squad rankings" })).getByRole("img", { name: /Extra stinky sock/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Jamie" })).toBeNull();
  });
  it("matches Supabase schedules without self-matches and supports keyboard tabs", async () => {
    await ready();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Search" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Wash Mates" }));
    expect(screen.getByRole("heading", { name: "Alex" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Usual laundry day"), { target: { value: "Tuesday" } });
    expect(screen.queryByRole("heading", { name: "Avery" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Usual time window"), { target: { value: "09:00–11:00" } });
    expect(screen.getByText("No overlapping schedules.")).toBeVisible();
  });
  it("keeps proof images local and persists private session preset updates", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:local-test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Community" }));
    const before = api.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Choose a local proof image"), { target: { files: [new File(["test"], "laundry.png", { type: "image/png" })] } });
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:local-test");
    expect(screen.getByRole("status")).toHaveTextContent(/no score changes/i);
    expect(api.mock.calls).toHaveLength(before);
    fireEvent.click(screen.getByRole("button", { name: "Remove local image" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-test");
    fireEvent.click(screen.getByRole("button", { name: "Save a fresh-start update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/not published publicly/i));
    expect(api).toHaveBeenCalledWith("/api/demo/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ preset: "fresh_start" }) }));
    cleanup(); await ready();
    fireEvent.click(screen.getByRole("tab", { name: "Community" }));
    expect(screen.getByText(/Laundry day is better together!/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Update saved to this session" })).toBeDisabled();
  });
});
