"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, RotateCcw, Search, ShieldCheck, Sparkles, Trophy, Users, WashingMachine } from "lucide-react";
import { GUEST_PARTICIPANTS, searchGuestParticipants, cleanScore, matchWashMates } from "@/lib/guest-demo";
import styles from "./GuestDemo.module.css";

const tabs = ["Overview", "Search", "Wash Mates", "Leaderboards", "Community"] as const;
const icons = [WashingMachine, Search, Users, Trophy, BookOpen];
const halls = ["Earhart Hall", "Harrison Hall", "Shreve Hall"];

function LocalProof({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className={styles.proof} src={url} alt="Your local laundry image preview, not verified" /> : null;
}

export function GuestDemo() {
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
  const [feedPreview, setFeedPreview] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const [profileId, setProfileId] = useState(GUEST_PARTICIPANTS[0].id);
  const mates = matchWashMates({ days: [day], timeWindow }).filter((person) => person.id !== profileId);
  const profile = GUEST_PARTICIPANTS.find((person) => person.id === profileId) ?? GUEST_PARTICIPANTS[0];
  const people = searchGuestParticipants({ minDays: 0 }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const results = searchGuestParticipants({ query, hall, minDays });
  const standings = halls.map((name) => {
    const roster = people.filter((person) => person.hall === name);
    const sum = roster.reduce((total, person) => total + (person.score ?? 0), 0);
    return { name, count: roster.length, sum, average: roster.length ? sum / roster.length : 0 };
  }).sort((a, b) => b.average - a.average);
  function reset() {
    setProfileId(GUEST_PARTICIPANTS[0].id);
    setQuery(""); setHall(""); setMinDays(14); setNudged([]); setProof(null); setDay("Sunday"); setTimeWindow("17:00–19:00"); setFeedPreview(false); setFileKey((key) => key + 1); setNotice("Demo reset. Nothing was saved or sent.");
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next]); document.getElementById(`guest-tab-${next}`)?.focus();
  }
  return <div className={styles.demo}>
    <div className={styles.safety}><ShieldCheck size={16} aria-hidden="true" /><strong>Synthetic demo</strong><span>· No account · Nothing sent to CSC</span></div>
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><span className={styles.brandIcon}><WashingMachine size={25} aria-hidden="true" /></span>LaundroStat<span className={styles.beta}>PLAYGROUND</span></Link>
        <button className={styles.reset} onClick={reset}><RotateCcw size={15} aria-hidden="true" />Reset demo</button>
      </header>
      <section className={styles.hero}>
        <div><p className={styles.eyebrow}><span /> FUN. FRESH. FIERCE.</p><h1>Clean clothes.<br /><span>Friendly competition.</span></h1><p className={styles.intro}>Keep your laundry routine fresh. Find a Wash Mate, give a gentle nudge, and bring your hall along.</p><p className={styles.fine}>Fictional people. Real buttons. Zero sign-in.</p></div>
        <div className={styles.machine} aria-hidden="true"><div className={styles.machineTop}><span>THE FRESHNESS CYCLE</span><span>✦</span></div><div className={styles.drum}><WashingMachine size={80} strokeWidth={1.2} /><span>FRESH LOOK. FRESH START.</span></div><div className={styles.machineFoot}><span>LESS PILE.</span><span>MORE CONSISTENCY.</span></div></div>
      </section>
      <div className={styles.tablist} role="tablist" aria-label="Demo activities">{tabs.map((name, index) => { const Icon = icons[index]; return <button key={name} id={`guest-tab-${index}`} role="tab" aria-selected={tab === name} aria-controls={`guest-panel-${index}`} tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => navigateTabs(event, index)} onClick={() => setTab(name)}><Icon size={18} aria-hidden="true" />{name}</button>; })}</div>
      <div role="status" className={notice ? styles.notice : styles.srOnly}>{notice}</div>
      <section role="tabpanel" id={`guest-panel-${tabs.indexOf(tab)}`} aria-labelledby={`guest-tab-${tabs.indexOf(tab)}`} tabIndex={0} className={styles.panel}>
        {tab === "Overview" && <>
          <label className={styles.profileSelect}>Synthetic profile preview<select value={profileId} onChange={(event) => setProfileId(event.target.value)}>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.hall}</option>)}</select></label>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YOUR FRESHNESS CHECK</p><h2>Meet your Clean-O-Meter.</h2><p>Recency + consistency. Not more loads, not more spending.</p></div><span className={styles.pill}>Synthetic snapshot · Sep 8, 2026</span></div>
          <div className={styles.lab}><div><h3 className={styles.profileTitle}>{profile.name}’s demo profile <span className={styles.pill}>{profile.hall}</span></h3><dl className={styles.metricGrid}><div><dt>Last completed recorded wash</dt><dd>{profile.lastFullCycleDate}</dd></div><div><dt>Days since recorded wash</dt><dd>{profile.daysSinceWash} day</dd></div><div><dt>Scrub streak · synthetic</dt><dd>{profile.scrubStreak} consistent check-ins</dd></div><div><dt>Source credibility</dt><dd style={{ fontSize: 13 }}>{profile.source}</dd></div></dl><p className={styles.privacy}><ShieldCheck size={17} />Source format is simulated, not provider-verified completion. Dates and streaks are fictional scenario data, not real student activity.</p><button className={styles.nudge} onClick={() => setTab("Search")}>Find friends for a fresh start<ChevronRight size={17} /></button></div><div className={styles.scoreCard}><Sparkles size={26} aria-hidden="true" /><p>CLEAN-O-METER</p><output>{cleanScore(profile.daysSinceWash, profile.scrubStreak)}</output><span>out of 100 · synthetic score</span><div>Recent wash. Consistent routine.<br />No load-volume or spending bonus.</div></div></div>
          <div className={styles.explainer} style={{ marginTop: 22 }}><strong>How this demo models freshness</strong><p>100 − (4 × days since wash) + (2 × scrub streak), with streak capped at 6 and score bounded to 0–100. This is an illustrative recency-and-consistency model, not an official scoring policy or a hygiene measurement. Unknown tracking gets no score. Source labels show credibility context; they do not certify an event.</p></div>
        </>}
        {tab === "Search" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE LAUNDRY CHECK-IN</p><h2>Time for a fresh start?</h2><p>Search friends with no recorded wash in 14+ days.</p></div><span className={styles.pill}>Synthetic · consent assumed</span></div>
          <div className={styles.filters}><label className={styles.searchLabel}>Friend’s name<div className={styles.searchInput}><Search size={19} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Riley or Taylor…" /></div></label><label>Residence hall<select value={hall} onChange={(event) => setHall(event.target.value)}><option value="">All halls</option>{halls.map((name) => <option key={name}>{name}</option>)}</select></label><label>Minimum days<select value={minDays} onChange={(event) => setMinDays(Number(event.target.value))}><option value={14}>14+ days</option><option value={16}>16+ days</option><option value={21}>21+ days</option><option value={28}>28+ days</option></select></label></div>
          <p className={styles.privacy}><ShieldCheck size={17} aria-hidden="true" />Consent-assumed, currently tracked synthetic friends only. Private, unknown-history and non-current records are excluded. Friends-only entries assume an authorized friendship in this fictional scenario. Missing records do not prove someone hasn’t washed.</p>
          <div className={styles.resultsHeading}><strong>{results.length} {results.length === 1 ? "match" : "matches"}</strong><span>Kind nudges only. No call-outs.</span></div>
          <div className={styles.cards}>{results.map((person) => <article key={person.id} className={styles.person}><div className={styles.personTop}><span className={styles.avatar}>{person.name.slice(0, 1)}</span><span className={styles.pill}>Synthetic</span></div><h3>{person.name}</h3><p>{person.hall}</p><div className={styles.days}><Clock3 size={17} aria-hidden="true" /><strong>{person.daysSinceWash} days</strong><span>since recorded wash</span></div><p className={styles.nudgeText}>“Laundry break? Let’s make it a fresh start.”</p><button className={styles.nudge} disabled={nudged.includes(person.id)} onClick={() => { setNudged([...nudged, person.id]); setNotice(`Nudge preview for ${person.name}: “Laundry break? Let’s make it a fresh start.” No message sent. Local cooldown until reset or reload.`); }}>{nudged.includes(person.id) ? <><Check size={16} />Local cooldown</> : <>Preview nudge<ChevronRight size={17} /></>}</button></article>)}</div>
          {results.length === 0 && <div className={styles.empty}><Search size={30} aria-hidden="true" /><h3>No matches. A clean slate.</h3><p>Try another name, hall, or minimum-day filter. Hidden profiles stay hidden.</p><button className={styles.reset} onClick={() => { setQuery(""); setHall(""); setMinDays(14); }}>Clear filters</button></div>}
          <p className={styles.fine}>Nudges are local previews, with one per person until reset or reload. No notifications, messages, or profile changes.</p>
        </>}
        {tab === "Wash Mates" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>BETTER TOGETHER</p><h2>Find your Wash Mate.</h2><p>Match overlapping usual laundry days and times — not live locations.</p></div><span className={styles.pill}>Generated schedules</span></div><div className={styles.filters}><label>Usual laundry day<select value={day} onChange={(event) => setDay(event.target.value)}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((name) => <option key={name}>{name}</option>)}</select></label><label>Usual time window<select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}><option>17:00–19:00</option><option>18:00–20:00</option><option>09:00–11:00</option></select></label></div><p className={styles.privacy}><ShieldCheck size={17} />Only consent-assumed synthetic friends are matched. Times are generated preferences, not tracking or availability guarantees. No invitation is sent.</p><div className={styles.cards}>{mates.map((person) => <article key={person.id} className={styles.person}><div className={styles.personTop}><span className={styles.avatar}>{person.name[0]}</span><span className={styles.pill}>Schedule overlap</span></div><h3>{person.name}</h3><p>{person.hall}</p><p className={styles.nudgeText}>{person.sharedDays.join(", ")} · {person.sharedTimeWindow}<br />Shared usual laundry window</p><button className={styles.nudge} onClick={() => setNotice(`Wash Mate preview: ${person.name}, ${person.sharedDays.join(", ")} ${person.sharedTimeWindow}. No invitation or message sent.`)}>Preview laundry plan<ChevronRight size={17} /></button></article>)}</div>{mates.length === 0 && <div className={styles.empty}><Users size={28} /><h3>No overlapping schedules.</h3><p>Try Tuesday, Saturday, or Sunday in the evening.</p></div>}
        </>}
        {tab === "Leaderboards" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A LITTLE HALL PRIDE</p><h2>Dorm Wars</h2><p>Different-sized rosters. One normalized score.</p></div><Trophy size={38} color="#91701d" aria-hidden="true" /></div>
          <div className={styles.explainer}><strong>Demo average = total Clean-O-Meter scores ÷ eligible synthetic roster count.</strong><p>The denominator is the consenting, currently tracked synthetic roster, not hall population. Private and unknown records are excluded, not counted as zero. Rankings reflect synthetic recency and consistency, never load volume. These invented scores are not evidence of real hall performance.</p></div>
          <div className={styles.standings}>{standings.map((item, index) => <article className={styles.standing} key={item.name}><span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span><div className={styles.hallInfo}><h3>{item.name}</h3><p>{item.sum} synthetic points ÷ {item.count} eligible synthetic roster members</p><div className={styles.track}><div style={{ width: `${Math.max(3, item.average / Math.max(...standings.map((row) => row.average), 1) * 100)}%` }} /></div></div><div className={styles.average}><strong>{item.average.toFixed(1)}</strong><span>avg. score</span></div></article>)}</div>
          <p className={styles.privacy}><RotateCcw size={18} />Draft rule: all leaderboards reset each semester. This demo has no verified resident totals or official rankings.</p><h2 className={styles.profileTitle}>Stinky Squad</h2><p className={styles.privacy}>An opt-in playful name, not a hygiene verdict. Highest recency-and-consistency score first. Every person below is fictional and consent-assumed.</p><div className={styles.standings}>{people.map((person, index) => <article className={styles.standing} key={person.id}><span className={styles.rank}>{index + 1}</span><div className={styles.hallInfo}><h3>{person.name}</h3><p>{person.hall} · {person.daysSinceWash} days since recorded wash · {person.scrubStreak} scrub streak</p></div><div className={styles.average}><strong>{person.score}</strong><span>Clean-O-Meter</span></div></article>)}</div>
        </>}
        {tab === "Community" && <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE FRESH FEED</p><h2>Small wins. Shared routines.</h2><p>A synthetic community concept, with local-only interactions.</p></div><span className={styles.pill}>Nothing published</span></div><div className={styles.ruleGrid}><article className={styles.rule}><h3>Community preview</h3><div className={styles.feed}><strong>Avery</strong> is making time for a fresh start.<small>Preset synthetic update · not a real post</small></div><div className={styles.feed}><strong>Earhart Hall</strong> is cheering on consistent routines.<small>Preset synthetic update · not a real event</small></div>{feedPreview && <div className={styles.feed}><strong>You, in this demo:</strong> Laundry day is better together!<small>Local preset preview · not published</small></div>}<button className={styles.nudge} style={{ marginTop: 20 }} disabled={feedPreview} onClick={() => { setFeedPreview(true); setNotice("Preset community update previewed locally. Nothing published and no message sent."); }}>{feedPreview ? "Update previewed locally" : "Preview a fresh-start update"}</button></article><article className={styles.rule}><h3>Proof photo concept</h3><p>Select a laundry image for a preview in this browser only. No photos are uploaded, no image verification occurs, and no score changes. Avoid faces or personal details.</p><label className={styles.file}>Choose a local proof image<input key={fileKey} className={styles.file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (!file) { setProof(null); return; } if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setProof(null); event.target.value = ""; setNotice("Choose a PNG, JPEG, WebP or GIF image under 5 MB. Nothing uploaded."); return; } setProof(URL.createObjectURL(file)); setNotice("Local image preview only. No upload, no verification and no score changes."); }} /></label>{proof && <><LocalProof url={proof} /><button className={styles.reset} onClick={() => { setProof(null); setFileKey((key) => key + 1); }}>Remove local image</button></>}</article></div>
          <div className={styles.explainer}><strong>Concept, not a provider integration.</strong><p>All CSC/payment, machine-code, weight, removal-time, photo-proof, refund and error-check scenarios are explicitly simulated or unimplemented. No CSC connection, real machine activity, verified photo proof, payment, refund or provider confirmation is performed. A real launch would require verified data access, consent and privacy controls.</p></div>
        </>}
      </section>
      <footer className={styles.footer}><Link href="/"><ArrowLeft size={16} />Back to LaundroStat</Link><p>Independent student concept. Not affiliated with Purdue or CSC.</p><Link href="/purdue/halls">Hall guide<ArrowUpRight size={15} /></Link></footer>
    </div>
  </div>;
}
export default GuestDemo;
