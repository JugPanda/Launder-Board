export type DemoHall = Readonly<{
  slug: "maple" | "river" | "oak";
  name: string;
  rank: number;
  creditedParticipants: number;
  eligibleParticipants: number;
  score: number;
  color: "cyan" | "indigo" | "lime";
}>;

export type DemoActivity = Readonly<{
  id: string;
  kind: "Washer" | "Dryer";
  title: string;
  recordedAt: string;
  location: string;
  source: "simulated" | "self-reported";
  sourceLabel: "Simulated CSC-format demo" | "Self-reported";
  outcome: string;
  countsThisWeek: boolean;
}>;

export const DEMO_COMPETITION = Object.freeze({
  id: "fall-weekly-quest",
  name: "Maple · River · Oak weekly quest",
  shortName: "Weekly hall quest",
  weekLabel: "September 7–13",
  timezone: "America/New_York",
  closesLabel: "Sunday at 11:59 PM ET",
  halls: Object.freeze<readonly DemoHall[]>([
    Object.freeze({
      slug: "maple",
      name: "Maple Hall",
      rank: 1,
      creditedParticipants: 12,
      eligibleParticipants: 16,
      score: 75,
      color: "cyan",
    }),
    Object.freeze({
      slug: "river",
      name: "River Hall",
      rank: 2,
      creditedParticipants: 12,
      eligibleParticipants: 20,
      score: 60,
      color: "indigo",
    }),
    Object.freeze({
      slug: "oak",
      name: "Oak Hall",
      rank: 3,
      creditedParticipants: 9,
      eligibleParticipants: 18,
      score: 50,
      color: "lime",
    }),
  ]),
});

export const DEMO_PROFILE = Object.freeze({
  slug: "maya-quest",
  displayName: "Maya Quest",
  firstName: "Maya",
  hall: "Maple Hall",
  weeklyCredit: Object.freeze({ earned: 1, cap: 1 }),
  badges: Object.freeze(["First load", "Shared cycle"]),
  activeWeekSummary: "Recorded one qualifying washer session this week.",
  tracking: Object.freeze({
    state: "Current",
    detail: "Last shared activity: Tuesday evening",
    disclosure: "Based on activity shared with Launder Board.",
  }),
});

export const DEMO_ACTIVITIES = Object.freeze<readonly DemoActivity[]>([
  Object.freeze({
    id: "demo-wash-1",
    kind: "Washer",
    title: "Campus laundry record",
    recordedAt: "Tue, Sep 8 · 7:42 PM",
    location: "Maple Hall laundry room",
    source: "simulated",
    sourceLabel: "Simulated CSC-format demo",
    outcome: "Weekly credit earned",
    countsThisWeek: true,
  }),
  Object.freeze({
    id: "demo-wash-2",
    kind: "Washer",
    title: "Quick wash",
    recordedAt: "Wed, Sep 9 · 8:16 PM",
    location: "Maple Hall laundry room",
    source: "self-reported",
    sourceLabel: "Self-reported",
    outcome: "Accepted; weekly cap already reached",
    countsThisWeek: false,
  }),
  Object.freeze({
    id: "demo-dry-1",
    kind: "Dryer",
    title: "Dryer cycle",
    recordedAt: "Wed, Sep 9 · 9:01 PM",
    location: "Maple Hall laundry room",
    source: "self-reported",
    sourceLabel: "Self-reported",
    outcome: "Does not qualify for weekly credit",
    countsThisWeek: false,
  }),
]);

export const PRIVACY_CHOICES = Object.freeze([
  Object.freeze({ id: "participation", label: "Competition participation", description: "Join weekly hall competitions." }),
  Object.freeze({ id: "activityImport", label: "Activity import", description: "Allow activity records to be added to your account." }),
  Object.freeze({ id: "directory", label: "Directory discovery", description: "Let participating people find your profile." }),
  Object.freeze({ id: "reminders", label: "Reminders and encouragement", description: "Let eligible friends see reminder status when tracking is current." }),
  Object.freeze({ id: "publicStats", label: "Public participant statistics", description: "Share your display name, weekly points, badges, and coarse activity summary." }),
  Object.freeze({ id: "publicHall", label: "Public hall affiliation", description: "Add your hall to your public profile. This is separate from public statistics." }),
] as const);
