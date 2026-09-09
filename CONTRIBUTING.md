# Contributing

## Before implementation

1. Record the selected concept and MVP.
2. Agree on the stack, data source, and demo fallback.
3. Create focused issues with a clear owner and acceptance criteria.

## Git workflow

- Work directly on `main`; do not create branches or pull requests unless Jug explicitly asks.
- Fetch and integrate remote `main` before pushing; preserve teammates' changes and never force-push.
- Keep commits focused and use imperative messages.
- Run the relevant verification before pushing to `main`, which triggers production deployment.
- Document new environment variables in `.env.example`; never commit real credentials.

## Delivery evidence

Include:

- What changed and why.
- Screenshots or a short recording for visible changes.
- Exact verification commands and results.
- Known limitations or demo dependencies.
- Any data, licensing, privacy, or security implications.

## Definition of done

A feature is not done because its code exists. It is done when the intended flow has been run successfully, failure states are handled, setup is documented, and another teammate can reproduce it.
