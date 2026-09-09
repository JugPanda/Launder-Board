"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, RotateCcw, Search, ShieldCheck, Sparkles, Trophy, Users, WashingMachine } from "lucide-react";
import { cleanScore, matchWashMates, type GuestParticipant } from "@/lib/guest-demo";
import styles from "./GuestDemo.module.css";
import { LaundryStatus, SquadRankings } from "./SquadRankings";
import { rankHallStandings } from "@/lib/squad-rankings";

const tabs = ["Overview", "Search", "Wash Mates", "Leaderboards", "Community"] as const;
const icons = [WashingMachine, Search, Users, Trophy, BookOpen];
const halls = ["Earhart Hall", "Harrison Hall", "Shreve Hall"];

type SavedPost = { id: string; preset: string; createdAt: string };
type Bootstrap = { participants: GuestParticipant[]; nudgedIds: string[]; posts: SavedPost[]; providers: { database: "supabase"; search: "typesense" }; asOf: string };
type SearchResult = Pick<GuestParticipant, "id" | "name" | "hall"> & { daysSinceWash: number };
const eligible = (person: GuestParticipant) => person.visibility !== "private" && person.tracking === "current" && person.daysSinceWash !== null && person.reminderConsent === "demo-assumed";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) throw new Error("provider_unavailable");
  return response.json();
}
function post<T>(url: string, body: object, signal?: AbortSignal) {
  return request<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
}
function validateBootstrap(data: Bootstrap) {
  if (!Array.isArray(data.participants) || !Array.isArray(data.nudgedIds) || !Array.isArray(data.posts) || data.providers?.database !== "supabase") throw new Error("provider_unavailable");
  if (!data.participants.some(eligible)) throw new Error("empty_cohort");
  return data;
}

function LocalProof({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className={styles.proof} src={url} alt="Your local laundry image preview, not verified" /> : null;
}

function recordSourceLabel(source: GuestParticipant["source"]) {
  return source === "Simulated CSC-format demo" ? "Synthetic CSC-format fixture" : "Self-reported demo fixture";
}

export function GuestDemo({ accountName }: { accountName?: string } = {}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [query, setQuery] = useState("");
  const [hall, setHall] = useState("");
  const [minDays, setMinDays] = useState(14);
  const [nudged, setNudged] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  useEffect(() => () => { if (proof) URL.revokeObjectURL(proof); }, [proof]);
  const [day, setDay] = useState("Sunday");
  const [timeWindow, setTimeWindow] = useState("17:00–19:00");
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const feedPreview = posts.some((post) => post.preset === "fresh_start");
  const [fileKey, setFileKey] = useState(0);
  const [profileId, setProfileId] = useState("");
  const [participants, setParticipants] = useState<GuestParticipant[]>([]);
  const [asOf, setAsOf] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pending, setPending] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<"loading" | "ready" | "error">("loading");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const people = participants.filter(eligible).map((person) => ({ ...person, score: cleanScore(person.daysSinceWash, person.scrubStreak) })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const profile = people.find((person) => person.id === profileId) ?? people[0];
  const mates = matchWashMates({ days: [day], timeWindow }, participants).filter((person) => person.id !== profile?.id);

  function applyBootstrap(data: Bootstrap) {
    setParticipants(data.participants); setNudged(data.nudgedIds); setPosts(data.posts); setAsOf(data.asOf);
    setProfileId((id) => data.participants.some((person) => person.id === id && eligible(person)) ? id : data.participants.find(eligible)?.id ?? "");
  }
  useEffect(() => {
    const controller = new AbortController();
    post<Bootstrap>("/api/demo/session", {}, controller.signal).then(validateBootstrap).then((data) => {
      if (controller.signal.aborted) return;
      applyBootstrap(data); setLoadState("ready");
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setParticipants([]); setLoadState("error");
      setLoadError(error instanceof Error && error.message === "empty_cohort" ? "No eligible profiles were returned by Supabase. Check the hosted demo data, then retry." : "The hosted demo is unavailable or not configured. Check the Supabase connection and retry. No local profiles are substituted.");
    });
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    if (tab !== "Search" || loadState !== "ready") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, hall, minDays: String(minDays) });
      request<{ participants: SearchResult[]; source: string; returnedCount: number }>(`/api/demo/search?${params}`, { signal: controller.signal }).then((data) => {
        if (controller.signal.aborted) return;
        if (data.source !== "typesense" || !Array.isArray(data.participants)) throw new Error("invalid_search");
        setResults(data.participants); setSearchState("ready");
      }).catch(() => { if (!controller.signal.aborted) { setResults([]); setSearchState("error"); } });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, query, hall, minDays, loadState, searchAttempt]);

  function changeTab(next: (typeof tabs)[number]) {
    if (next === "Search" && tab !== "Search") { setResults([]); setSearchState("loading"); }
    setTab(next);
  }
  function refreshSearch() { setResults([]); setSearchState("loading"); setSearchAttempt((attempt) => attempt + 1); }
  async function saveEvent(kind: "nudges" | "posts", recipientId?: string) {
    if (pending) return;
    setPending(recipientId ?? "posts"); setNotice("");
    try {
      const result = await post<{ ok: boolean; code: string }>(`/api/demo/${kind}`, { ...(recipientId ? { recipientId } : {}), preset: "fresh_start" });
      if (!result.ok) throw new Error("not_saved");
      const data = validateBootstrap(await request<Bootstrap>("/api/demo/bootstrap"));
      applyBootstrap(data);
      if (kind === "nudges" ? !data.nudgedIds.includes(recipientId!) : !data.posts.some((post) => post.preset === "fresh_start")) throw new Error("not_confirmed");
      setNotice(accountName ? (kind === "nudges" ? "Demo nudge saved to your account. No actual person was notified. Account cooldown survives sign-in." : "Preset update saved to your account, not published publicly. No message sent.") : (kind === "nudges" ? "Demo nudge saved to your browser’s hosted session. No actual person was notified. Session cooldown survives refresh." : "Preset update saved to your browser’s hosted session, not published publicly. No message sent."));
    } catch { setNotice("Could not confirm the saved demo event. The provider may be unavailable; retry or reload to check your session. No actual person is notified."); }
    finally { setPending(""); }
  }
  const standings = rankHallStandings(halls.map((name) => {
    const roster = people.filter((person) => person.hall === name);
    const sum = roster.reduce((total, person) => total + (person.score ?? 0), 0);
    return { name, count: roster.length, sum, average: roster.length ? sum / roster.length : 0 };
  }));
  async function reset() {
    if (pending) return;
    setPending("reset"); setLoadState("loading"); setNotice("");
    try {
      const result = await post<{ ok: boolean }>("/api/demo/reset", {});
      if (!result.ok) throw new Error("reset_failed");
      const data = validateBootstrap(await post<Bootstrap>("/api/demo/session", {}));
      if (data.nudgedIds.length || data.posts.length) throw new Error("reset_unconfirmed");
      applyBootstrap(data); setProfileId(data.participants.find(eligible)?.id ?? "");
      setQuery(""); setHall(""); setMinDays(14); setProof(null); setDay("Sunday"); setTimeWindow("17:00–19:00"); setFileKey((key) => key + 1); refreshSearch();
      setLoadState("ready"); setNotice(accountName ? "Your account’s demo events cleared. Shared synthetic profiles were not changed. Nothing sent to CSC." : "Your session events cleared. Shared synthetic profiles were not changed. Nothing sent to CSC.");
    } catch { setLoadState("error"); setLoadError("Could not confirm the session reset. Retry to reload your hosted session; shared profiles are never reset."); }
    finally { setPending(""); }
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); changeTab(tabs[next]); document.getElementById(`guest-tab-${next}`)?.focus();
  }
  return <div className={styles.demo}>
    <div className={styles.safety}><ShieldCheck size={16} aria-hidden="true" /><strong>Synthetic demo</strong><span>{accountName ? `· Signed in as ${accountName} · Nothing sent to CSC` : "· No account · Nothing sent to CSC"}</span></div>
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><span className={styles.brandIcon}><WashingMachine size={25} aria-hidden="true" /></span>LaundroStat<span className={styles.beta}>PLAYGROUND</span></Link>
        <Link href={accountName ? "/demo" : "/sign-in"}>{accountName ? "Public demo" : "Demo account sign in"}</Link>
        <button className={styles.reset} title={accountName ? "Clear only your account’s demo events" : "Clear only your browser’s demo events"} disabled={!!pending || loadState === "loading"} onClick={reset}><RotateCcw size={15} aria-hidden="true" />Reset demo</button>
      </header>
      <section className={styles.hero}>
        <div><p className={styles.eyebrow}><span /> FUN. FRESH. FIERCE.</p><h1>Clean clothes.<br /><span>Friendly competition.</span></h1><p className={styles.intro}>Keep your laundry routine fresh. Find a Wash Mate, give a gentle nudge, and bring your hall along.</p><p className={styles.fine}>{accountName ? "Fictional people. Real sign-in. Demo events saved to your account for up to 7 days." : "Fictional people. Real buttons. Zero sign-in."}</p></div>
        <div className={styles.machine} aria-hidden="true"><div className={styles.machineTop}><span>THE FRESHNESS CYCLE</span><span>✦</span></div><div className={styles.drum}><WashingMachine size={80} strokeWidth={1.2} /><span>FRESH LOOK. FRESH START.</span></div><div className={styles.machineFoot}><span>LESS PILE.</span><span>MORE CONSISTENCY.</span></div></div>
      </section>
      <p className={styles.tabHint}>Swipe tabs to explore all five sections →</p>
      <div className={styles.tablist} role="tablist" aria-label="Demo activities">{tabs.map((name, index) => { const Icon = icons[index]; return <button key={name} id={`guest-tab-${index}`} role="tab" aria-selected={tab === name} aria-controls={`guest-panel-${index}`} tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => navigateTabs(event, index)} onClick={() => changeTab(name)}><Icon size={18} aria-hidden="true" />{name}</button>; })}</div>
      <div role="status" className={notice ? styles.notice : styles.srOnly}>{notice}</div>
      <section role="tabpanel" id={`guest-panel-${tabs.indexOf(tab)}`} aria-labelledby={`guest-tab-${tabs.indexOf(tab)}`} tabIndex={0} className={styles.panel}>
        {loadState === "loading" && <div className={styles.empty} aria-live="polite"><span className={styles.spinner} aria-hidden="true" /><h2>Loading hosted demo…</h2><p>{accountName ? "Connecting to your account’s synthetic demo events." : "Connecting to your synthetic session. No sign-in required."}</p></div>}
        {loadState === "error" && <div className={styles.empty} role="alert"><h2>Hosted demo unavailable</h2><p>{loadError}</p><button className={styles.reset} onClick={() => { setLoadState("loading"); setLoadAttempt((attempt) => attempt + 1); }}>Retry connection</button></div>}
        {loadState === "ready" && profile && <>
        <p className={styles.provider}>Supabase profile data · synthetic cohort · snapshot {asOf}</p>
        {tab === "Overview" && <>
          <label className={styles.profileSelect}>Synthetic profile preview<select value={profileId} onChange={(event) => setProfileId(event.target.value)}>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.hall}</option>)}</select></label>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YOUR FRESHNESS CHECK</p><h2>Meet your Clean-O-Meter.</h2><p>Recency + consistency. Not more loads, not more spending.</p></div><span className={styles.pill}>Synthetic snapshot · {asOf}</span></div>
          <div className={styles.lab}><div><h3 className={styles.profileTitle}>{profile.name}’s demo profile <span className={styles.pill}>{profile.hall}</span></h3><dl className={styles.metricGrid}><div><dt>Last completed recorded wash</dt><dd>{profile.lastFullCycleDate}</dd></div><div><dt>Days since recorded wash</dt><dd>{profile.daysSinceWash} {profile.daysSinceWash === 1 ? "day" : "days"}</dd></div><div><dt>Scrub streak · synthetic</dt><dd>{profile.scrubStreak} consistent check-ins</dd></div><div><dt>Record source</dt><dd style={{ fontSize: 16 }}>{recordSourceLabel(profile.source)}</dd></div></dl><p className={styles.privacy}><ShieldCheck size={17} />Source format is simulated, not provider-verified completion. Dates and streaks are fictional scenario data, not real student activity.</p><button className={styles.nudge} onClick={() => changeTab("Search")}>Find friends for a fresh start<ChevronRight size={17} /></button></div><div className={styles.scoreCard}><Sparkles size={26} aria-hidden="true" /><p>CLEAN-O-METER</p><LaundryStatus score={profile.score} large /><output>{cleanScore(profile.daysSinceWash, profile.scrubStreak)}</output><span>out of 100 · synthetic score</span><div>Recent wash. Consistent routine.<br />No load-volume or spending bonus.</div></div></div>
          <div className={styles.explainer} style={{ marginTop: 22 }}><strong>How this demo models freshness</strong><p>100 − (4 × days since wash) + (2 × scrub streak), with streak capped at 6 and score bounded to 0–100. This is an illustrative recency-and-consistency model, not an official scoring policy or a hygiene measurement. Unknown tracking gets no score. Source labels show credibility context; they do not certify an event.</p></div>
        </>}
        {tab === "Search" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE LAUNDRY CHECK-IN</p><h2>Time for a fresh start?</h2><p>Search friends with no recorded wash in 14+ days.</p></div><span className={styles.pill}>Synthetic · consent assumed</span></div>
          <div className={styles.filters}><label className={styles.searchLabel}>Friend’s name<div className={styles.searchInput}><Search size={19} aria-hidden="true" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); refreshSearch(); }} placeholder="Try Riley or Taylor…" /></div></label><label>Residence hall<select value={hall} onChange={(event) => { setHall(event.target.value); refreshSearch(); }}><option value="">All halls</option>{halls.map((name) => <option key={name}>{name}</option>)}</select></label><label>Minimum days<select value={minDays} onChange={(event) => { setMinDays(Number(event.target.value)); refreshSearch(); }}><option value={14}>14+ days</option><option value={16}>16+ days</option><option value={21}>21+ days</option><option value={28}>28+ days</option></select></label></div>
          <p className={styles.privacy}><ShieldCheck size={17} aria-hidden="true" />Consent-assumed, currently tracked synthetic friends only. Private, unknown-history and non-current records are excluded. Friends-only entries assume an authorized friendship in this fictional scenario. Missing records do not prove someone hasn’t washed.</p>
          <p className={styles.limitNote}>One saved nudge per synthetic friend every 72 hours; five total per day. No actual person is notified.</p>
          {searchState === "loading" && <p className={styles.privacy} aria-live="polite"><span className={styles.spinner} aria-hidden="true" />Searching Typesense…</p>}
          {searchState === "error" && <div className={styles.empty} role="alert"><h3>Typesense search is unavailable.</h3><p>No local results are substituted. Try again when the hosted search is available.</p><button className={styles.reset} onClick={refreshSearch}>Retry search</button></div>}
          {searchState === "ready" && <><p className={styles.provider}>Results from Typesense</p><div className={styles.resultsHeading}><strong>{results.length} {results.length === 1 ? "match" : "matches"}</strong><span>Kind nudges only. No call-outs.</span></div>
          <div className={styles.cards}>{results.map((person) => <article key={person.id} className={styles.person}><div className={styles.personTop}><span className={styles.avatar}>{person.name.slice(0, 1)}</span><span className={styles.pill}>Synthetic</span></div><h3>{person.name}</h3><p>{person.hall}</p><div className={styles.days}><Clock3 size={17} aria-hidden="true" /><strong>{person.daysSinceWash} days</strong><span>since recorded wash</span></div><p className={styles.nudgeText}>“Laundry break? Let’s make it a fresh start.”</p><button className={styles.nudge} disabled={!!pending || nudged.includes(person.id)} onClick={() => saveEvent("nudges", person.id)}>{nudged.includes(person.id) ? <><Check size={16} />Session cooldown</> : pending === person.id ? "Saving…" : <>Save demo nudge<ChevronRight size={17} /></>}</button></article>)}</div>
          {results.length === 0 && <div className={styles.empty}><Search size={30} aria-hidden="true" /><h3>No matches. A clean slate.</h3><p>Try another name, hall, or minimum-day filter. Hidden profiles stay hidden.</p><button className={styles.reset} onClick={() => { setQuery(""); setHall(""); setMinDays(14); refreshSearch(); }}>Clear filters</button></div>}
          </>}<p className={styles.fine}>{accountName ? "Demo nudges are saved in Supabase for your presentation account for up to 7 days, with a cooldown that survives sign-in. Reset clears only your account’s demo events. No actual person is notified." : "Demo nudges are saved in Supabase for this browser’s session, with a cooldown that survives refresh. Reset clears your session events only. No actual person is notified."}</p>
        </>}
        {tab === "Wash Mates" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>BETTER TOGETHER</p><h2>Find your Wash Mate.</h2><p>Match overlapping usual laundry days and times — not live locations.</p></div><span className={styles.pill}>Supabase · synthetic schedules</span></div><div className={styles.filters}><label>Usual laundry day<select value={day} onChange={(event) => setDay(event.target.value)}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((name) => <option key={name}>{name}</option>)}</select></label><label>Usual time window<select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}><option>17:00–19:00</option><option>18:00–20:00</option><option>09:00–11:00</option></select></label></div><p className={styles.privacy}><ShieldCheck size={17} />Only consent-assumed synthetic friends are matched. Times are generated preferences, not tracking or availability guarantees. No invitation is sent.</p><div className={styles.cards}>{mates.map((person) => <article key={person.id} className={styles.person}><div className={styles.personTop}><span className={styles.avatar}>{person.name[0]}</span><span className={styles.pill}>Schedule overlap</span></div><h3>{person.name}</h3><p>{person.hall}</p><p className={styles.nudgeText}>{person.sharedDays.join(", ")} · {person.sharedTimeWindow}<br />Shared usual laundry window</p><button className={styles.nudge} onClick={() => setNotice(`Wash Mate preview: ${person.name}, ${person.sharedDays.join(", ")} ${person.sharedTimeWindow}. No invitation or message sent.`)}>Preview laundry plan<ChevronRight size={17} /></button></article>)}</div>{mates.length === 0 && <div className={styles.empty}><Users size={28} /><h3>No overlapping schedules.</h3><p>Try Tuesday, Saturday, or Sunday in the evening.</p></div>}
        </>}
        {tab === "Leaderboards" && <>
          <SquadRankings participants={participants} />
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A LITTLE HALL PRIDE</p><h2>Dorm Wars</h2><p>Different-sized rosters. One normalized score.</p></div><Trophy size={38} color="#91701d" aria-hidden="true" /></div>
          <div className={styles.explainer}><strong>Demo average = total Clean-O-Meter scores ÷ eligible synthetic roster count.</strong><p>The denominator is the consenting, currently tracked synthetic roster, not hall population. Private and unknown records are excluded, not counted as zero. Rankings reflect synthetic recency and consistency, never load volume. These invented scores are not evidence of real hall performance.</p></div>
          <div className={styles.standings}>{standings.map((item) => <article className={styles.standing} key={item.name}><span className={styles.rank}>{String(item.rank).padStart(2, "0")}</span><div className={styles.hallInfo}><h3>{item.name}</h3><p>{item.sum} synthetic points ÷ {item.count} eligible synthetic roster members</p><div className={styles.track}><div style={{ width: `${Math.max(3, item.average / Math.max(...standings.map((row) => row.average), 1) * 100)}%` }} /></div></div><div className={styles.average}><strong>{item.average.toFixed(1)}</strong><span>avg. score</span></div></article>)}</div>
          <p className={styles.privacy}><RotateCcw size={18} />Draft rule: all leaderboards reset each semester. This demo has no verified resident totals or official rankings.</p>
        </>}
        {tab === "Community" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE FRESH FEED</p><h2>Small wins. Shared routines.</h2><p>{accountName ? "Illustrative community examples and saved updates for your presentation account, retained for up to 7 days." : "Illustrative community examples and saved updates for your own browser’s hosted session."}</p></div><span className={styles.pill}>Nothing published</span></div><div className={styles.ruleGrid}><article className={styles.rule}><h3>Community preview</h3><p>Illustrative baseline examples below are not saved posts.</p><div className={styles.feed}><strong>Avery</strong> is making time for a fresh start.<small>Preset synthetic update · not a real post</small></div><div className={styles.feed}><strong>Earhart Hall</strong> is cheering on consistent routines.<small>Preset synthetic update · not a real event</small></div><h3>{accountName ? "Your saved account updates" : "Your saved session updates"}</h3>{posts.filter((post) => post.preset === "fresh_start").map((post) => <div key={post.id} className={styles.feed}><strong>You, in this demo:</strong> Laundry day is better together!<small>{accountName ? "Saved in Supabase · your account only · up to 7 days · not published publicly" : "Saved in Supabase · this browser’s session only · not published publicly"}</small></div>)}<button className={styles.nudge} style={{ marginTop: 20 }} disabled={feedPreview || !!pending} onClick={() => saveEvent("posts")}>{feedPreview ? (accountName ? "Update saved to your account" : "Update saved to this session") : pending === "posts" ? "Saving…" : "Save a fresh-start update"}</button></article><article className={styles.rule}><h3>Local image preview</h3><p>Select a laundry image for a preview in this browser only. No photos are uploaded, no image verification occurs, and no score changes. Avoid faces or personal details.</p><label className={styles.file}>Choose an image to preview locally<input key={fileKey} className={styles.file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (!file) { setProof(null); return; } if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setProof(null); event.target.value = ""; setNotice("Choose a PNG, JPEG, WebP or GIF image under 5 MB. Nothing uploaded."); return; } setProof(URL.createObjectURL(file)); setNotice("Local image preview only. No upload, no verification and no score changes."); }} /></label>{proof && <><LocalProof url={proof} /><button className={styles.reset} onClick={() => { setProof(null); setFileKey((key) => key + 1); }}>Remove local image</button></>}</article></div>
          <div className={styles.explainer}><strong>Hosted demo data, not a CSC or machine integration.</strong><p>All CSC/payment, machine-code, weight, removal-time, photo-proof, refund and error-check scenarios are explicitly simulated or unimplemented. No CSC connection, real machine activity, verified photo proof, payment, refund or provider confirmation is performed. A real launch would require verified data access, consent and privacy controls.</p></div>
        </>}
        </>}
      </section>
      <footer className={styles.footer}><Link href="/"><ArrowLeft size={16} />Back to LaundroStat</Link><p>Independent student concept. Not affiliated with or endorsed by Purdue University, University Residences, CSC ServiceWorks, CSCPay, or Typesense.</p><Link href="/purdue/halls">Hall guide<ArrowUpRight size={15} /></Link></footer>
    </div>
  </div>;
}
export default GuestDemo;
