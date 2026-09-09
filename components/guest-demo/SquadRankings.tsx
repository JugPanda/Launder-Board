import Image from "next/image";
import { cleanScore, type GuestParticipant } from "@/lib/guest-demo";
import { getLaundryStatus, getSquadRankings, LAUNDRY_STATUSES, type SquadPlayer } from "@/lib/squad-rankings";
import styles from "./SquadRankings.module.css";

export function LaundryStatus({ score, large = false }: { score: number | null; large?: boolean }) {
  const status = getLaundryStatus(score);
  if (!status) return <span>Tracking unknown · no status assigned</span>;
  return <span className={`${styles.status} ${large ? styles.large : ""}`}>
    <Image src={status.image} width={large ? 144 : 64} height={large ? 144 : 64} alt={`Level ${status.level}: ${status.label} sock`} />
    <span><strong>{status.label}</strong><small>Level {status.level} · demo status</small></span>
  </span>;
}

function Squad({ name, subtitle, people, tone }: { name: string; subtitle: string; people: SquadPlayer[]; tone: "squeaky" | "stinky" }) {
  const id = `${tone}-heading`;
  return <section className={`${styles.squad} ${styles[tone]}`} aria-labelledby={id}>
    <header><p>{tone === "squeaky" ? "THE FRESH END" : "TIME FOR A FRESH START"}</p><h2 id={id}>{name}</h2><span>{subtitle}</span></header>
    <ol aria-label={`${name} rankings`} className={styles.players}>
      {people.map(person => <li key={person.id} data-score={person.score}>
        <div className={styles.playerTop}><span className={styles.rank}>#{person.rank}</span><strong className={styles.score}>{person.score}<small>/100</small></strong></div>
        <LaundryStatus score={person.score} />
        <h3>{person.name}</h3><p className={styles.hall}>{person.hall}</p>
        <p className={styles.meta}>{person.daysSinceWash} {person.daysSinceWash === 1 ? "day" : "days"} since recorded wash · {person.scrubStreak} scrub streak</p>
      </li>)}
    </ol>
    {!people.length && <p className={styles.empty}>Not enough eligible synthetic profiles for this squad.</p>}
  </section>;
}

export function SquadRankings({ participants }: { participants: readonly GuestParticipant[] }) {
  const { squeaky, stinky } = getSquadRankings(participants.map((person) => ({ ...person, score: cleanScore(person.daysSinceWash, person.scrubStreak) })));
  return <div className={styles.wrapper}>
    <div className={styles.heading}><p>THE TWO SIDES OF LAUNDRY DAY</p><h2>Two squads. Same friendly competition.</h2><span>Highest and lowest Clean-O-Meter scores from the eligible synthetic cohort. Recency and consistency—not more loads. Private and unknown profiles stay out.</span></div>
    <div className={styles.grid}>
      <Squad name="Squeaky Squad" subtitle="Highest scores first · most recent, consistent routines" people={squeaky} tone="squeaky" />
      <Squad name="Stinky Squad" subtitle="Lowest scores first · a friendly nudge toward laundry day" people={stinky} tone="stinky" />
    </div>
    <p className={styles.note}>Top and bottom groups do not overlap; matching scores share ranks. All people and scores are synthetic. These playful labels describe the demo model, not anyone’s actual hygiene.</p>
    <details className={styles.legend}><summary>What do the five sock levels mean?</summary><p>Illustrative Clean-O-Meter thresholds—not validated hygiene measurements. Unknown tracking never receives a stinky badge.</p><div>{LAUNDRY_STATUSES.map(status => <figure key={status.level}><Image src={status.image} alt={`Level ${status.level}: ${status.label} sock`} width={100} height={100} /><figcaption><strong>{status.label}</strong><span>Level {status.level} · {status.range} points</span></figcaption></figure>)}</div></details>
  </div>;
}
