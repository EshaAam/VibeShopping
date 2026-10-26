# Tests

```
tests/
  unit/                 fast, no network or database; everything outside the module is mocked
    ai/                 chat assistant: cache, rate limit, key pool, link guard
    auth/               session guards, sign-in limits
    cart/               cart concurrency, guest cart isolation
    lib/                shared helpers: pricing, URL params, error formatting
    orders/             order state machine, cancel + refund
    payments/           Stripe webhook, markOrderPaid
  contract/             rules about the codebase itself, not one module's behaviour
                        (every server action checks auth, only lib/orders.ts writes orders)
  integration/          planned: real Postgres (triggers, constraints, races)
  e2e/                  planned: Playwright against a production build
```

Layers are separate folders because they need different setups and run at
different stages of CI. Inside `unit/`, folders follow the area of `lib/`
being tested.

## Running

| Command | Runs |
|---|---|
| `npm test` | every project, once (what CI runs) |
| `npm run test:unit` | `tests/unit` only |
| `npm run test:contract` | `tests/contract` only |
| `npm run test:watch` | watch mode while writing tests |
| `npx vitest run tests/unit/orders` | one folder |
| `npx vitest run -t "ORD-10"` | one test case by its plan ID |

## Conventions

- **File name:** `<subject>.test.ts`, in the folder of the area it covers.
- **Header comment:** say what the file protects and why it matters, not how
  the code works.
- **Test names start with the plan ID** from `docs/testplan.md` when there is
  one (`'PAY-11: a business rejection is acknowledged with 200'`), so a failure
  maps straight back to the plan.
- **Assert the intended behaviour, not the current one.** A test that copies
  what the code does today can't find a bug.
- **Known bugs** get a test marked `it.fails(...)` with a comment explaining the
  bug. CI stays green, and the test turns red as soon as the bug is fixed,
  which is the cue to drop `.fails` and turn the comment into `// Regression: ...`.
- **Mocks:** create them with `vi.hoisted`, mock at the module boundary
  (`@/db/prisma`, `@/lib/stripe`, `@/auth`, `next/headers`, `next/cache`,
  `server-only`), then import the module under test.
- **Module state** (caches, rate limits, key pool health): reload the module per
  test with `vi.resetModules()` + dynamic `import()`.
- **Time:** use fake timers (`vi.useFakeTimers`, `vi.setSystemTime`), never
  real waits.
- **No real secrets or services.** Stripe, Gemini and the database are always
  mocked in `unit/`.
