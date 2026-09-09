# Purdue West Lafayette scope

Reviewed 2026-09-09. The current name remains **LaundroStat**, superseding the supplied prompt's pay2win name and former repository URL. Canonical repository: https://github.com/JugPanda/Launder-Board.

## Public facts and boundaries

- Scope is Purdue University West Lafayette, not Indianapolis, Global, or the statewide system.
- Scheduling timezone: `America/Indiana/Indianapolis`; migration 0008 explicitly replaces the prior New York identifier without rewriting migration history or existing event timestamps.
- Use University Residences (UR), residence hall, and Boilermaker accurately. UR Boiler Apartments (URBA) are a separate housing category and excluded from this initial catalog.
- LaundroStat is a student hackathon project, not affiliated with or endorsed by Purdue, UR, CSC ServiceWorks, CSCPay, or Typesense. No protected marks are used.
- Canonical housing metadata is separate from fictional Maple/River/Oak standings. The housing catalog has no student population, machine counts, availability, competition scores, participant identities, or manufactured hall invites.
- Choosing a hall in the public directory opens its details; it does not enroll a user or verify residency. Organizer-issued hall invitations remain required for enrollment.

## Verified sources

The [current residence-hall directory](https://www.housing.purdue.edu/my-housing/options/residence-halls/index.html) was inspected in the browser. Its distinct hall destinations were deduplicated and all 18 detail pages fetched. Some source headings abbreviate names (for example, “Earhart”); the catalog uses the user's full residence-hall display names rather than treating abbreviations as different communities.

Cary Quadrangle; Earhart Hall; First Street Towers; Winifred Parker Hall; Frieda Parker Hall; Harrison Hall; Hawkins Hall; Hillenbrand Hall; Honors College and Residences; McCutcheon Hall; Meredith Hall; Meredith South; Owen Hall; Shreve Hall; South Hall; Tarkington Hall; Wiley Hall; Windsor Halls.

[South Hall](https://www.housing.purdue.edu/my-housing/options/residence-halls/south-hall.html) explicitly states Fall 2026 opening. It is included, not fictional. Grouped hall identities remain intact; the two Parker halls and two Meredith buildings remain distinct.

The [official laundry page](https://www.housing.purdue.edu/my-housing/info/amenities-accommodations/laundry.html) confirms laundry rooms in every residence hall, front-loading high-efficiency equipment in traditional halls, CSCPay for paid machines, and included-in-rate laundry at First Street Towers. It does not supply a complete per-hall payment mapping: other hall payment categories remain unknown. Laundry details are linked rather than freezing volatile fees into product copy. The same page gives alternative payment instructions at Hawkins/Frieda Parker offices and unused-balance refund instructions.

[UR apartments](https://www.housing.purdue.edu/my-housing/options/apartments/index.html), [housing map](https://www.housing.purdue.edu/my-housing/info/map.html), and [rates](https://www.housing.purdue.edu/my-housing/info/housing-rates.html) remain official destinations for current details; no permanent URBA roster or capacity data is imported.

## Privacy and launch constraints

One washer credit per voluntary enrolled participant/week; locked roster denominator; no points for spending, dryers, additional cycles, or claimed load size. No public inactivity rankings, PUIDs, rooms, exact machine locations, or fake provider confirmation. CSC/CSCPay live access remains disabled pending written authorization and documented integration.

The existing synthetic UI demonstrates behavior; browser-only actions are not evidence of persisted account workflows. Hosted auth needs a real Supabase project, configuration, migrations and end-to-end verification. See [Supabase setup](supabase-setup.md). Neither a successful build nor a mock-based policy test constitutes production-auth readiness.
