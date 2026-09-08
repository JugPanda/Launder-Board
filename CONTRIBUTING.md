# Contributing

## Before implementation

1. Record the selected concept and MVP.
2. Agree on the stack, data source, and demo fallback.
3. Create focused issues with a clear owner and acceptance criteria.

## Git workflow

- Branch from `main`.
- Use short branches such as `feat/search-flow` or `fix/result-ranking`.
- Keep commits focused and use imperative messages.
- Open a pull request instead of pushing unfinished implementation directly to `main`.
- Document new environment variables in `.env.example`; never commit real credentials.

## Pull-request evidence

Include:

- What changed and why.
- Screenshots or a short recording for visible changes.
- Exact verification commands and results.
- Known limitations or demo dependencies.
- Any data, licensing, privacy, or security implications.

## Definition of done

A feature is not done because its code exists. It is done when the intended flow has been run successfully, failure states are handled, setup is documented, and another teammate can reproduce it.
