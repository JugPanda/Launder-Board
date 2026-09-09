# Launder Board design system

## Direction

Clean utility with restrained arcade-score energy. Use the two-word title case `Launder Board`, washer-door circles, and concise quest language. No portraits, stock imagery, podium/loser imagery, public shame, or red downward-rank indicators. The first viewport states: **Paying more never buys more points.**

## Tokens

- Canvas `#F8FAFC`; surface `#FFFFFF`; ink `#0F172A`; text `#334155`; muted `#475569`.
- Primary `#4F46E5`; hover `#4338CA`; arcade cyan `#22D3EE`; arcade lime `#A3E635`.
- Success `#047857`; warning `#B45309`; danger `#B91C1C`; synthetic source `#BE185D`.
- Body: Inter/system sans. Headings: Space Grotesk/system sans. Scores: system monospace with tabular numbers.
- Controls: 44–48px high, 12px radius. Cards: 16px radius. Hero panels/sheets: 24px radius.
- Mobile gutters: 16–20px. Content max: 1200px. Form/reading max: 640px.

## Navigation

Mobile fixed bottom navigation: Home, Activity, Add, Compete, Friends. Labels remain visible; active destination uses icon, weight, and fill with `aria-current`. Desktop switches at 1024px to a 224–240px left rail. Privacy is always reachable through a labeled shield control.

## Accessibility

- WCAG AA text contrast and visible 3px focus rings.
- Minimum 44×44px targets.
- Text/icon accompanies every status, source, score, and progress color.
- Respect `prefers-reduced-motion`; no essential content starts hidden.
- No hover-only actions or explanations.
- Verify at 320, 375, 390, 768, 1024, and 1440px plus 200% zoom.

## Source labels

Use persistent text labels: Self-reported, User-supplied record, Provider-confirmed, or Simulated demo. Simulated styling is visually distinct and remains labeled in lists, details, confirmations, and public preview.

## Copy

Quest language is optional and playful; privacy, deletion, permissions, errors, and scoring stay literal. Avoid “prove,” “caught,” “verified resident,” “loser,” “lazy,” “cheating,” “streak broken,” or generic confirmation labels when a specific action fits.
