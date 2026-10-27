# Tests

```
tests/
  unit/                 fast, no network or database; everything outside the module is mocked
    ai/                 chat assistant: pipeline, cache, rate limit, key pool, link guard, retrieval
    auth/               route guard, credentials, sign-in limits, account actions
    cart/               cart and wishlist actions, concurrency, guest isolation, share links
    catalog/            product create / update / archive
    lib/                shared helpers: pricing, URL params, error formatting
    orders/             checkout, order state machine, cancel + refund
    payments/           Stripe actions, webhook, markOrderPaid
    reviews/            verified-purchase reviews
  contract/             rules about the codebase itself, not one module's behaviour
                        (every server action checks auth, only lib/orders.ts writes orders,
                        server-only code never reaches the browser)
  integration/          the app's real code against a real Postgres in Docker
    setup/              container start, migrations, framework mocks
    helpers/            per-file test database, request context, factories, race barrier
    auth/ catalog/ checkout/ database/ orders/
  e2e/                  Playwright: a production build in a real browser
    support/            throwaway database + server, seed data, page helpers
```

Layers are separate folders because they need different setups and run at
different stages of CI. Inside each layer, folders follow the area of the app
being tested.

## Running

| Command | Runs | Needs |
|---|---|---|
| `npm test` | unit + contract (what every commit should pass) | nothing |
| `npm run test:unit` / `test:contract` | one layer | nothing |
| `npm run test:integration` | `tests/integration` | Docker running |
| `npm run build && npm run test:e2e` | `tests/e2e` | Docker running, a production build |
| `npm run test:all` | everything, in order | Docker running |
| `npm run test:watch` | unit + contract in watch mode | nothing |
| `npx vitest run tests/unit/orders` | one folder | |
| `npx vitest run -t "ORD-10"` | one test case by its plan ID | |
| `npx playwright test -g "E2E-03"` | one browser test | |

### Integration tests

- One Postgres container starts per run (`postgres:16-alpine`, data in memory
  via tmpfs, nothing written to disk). The real `prisma/migrations` SQL builds a
  template database; each test file gets its own copy, so files run in parallel.
- `TEST_DATABASE_URL` points the run at an existing server instead (e.g. a CI
  service container).
- Only the framework edges are replaced (`setup/mocks.ts`): the Prisma client
  points at the file's database, and the session and cookies come from
  `helpers/request.ts`, kept per async call chain so concurrent requests in one
  test are different visitors.
- Races are made deterministic with `helpers/barrier.ts`: both requests read
  before either writes, instead of hoping the timing lines up.

### End-to-end tests

- `support/server.mjs` starts a throwaway Postgres (`vibe-e2e-db`, port 54329,
  in memory), runs `prisma migrate deploy`, then `next start` on port 3100 with
  `DATABASE_DRIVER=pg`. The real database is never touched.
- Stripe runs in **test mode** with the keys from `.env`; the webhook test signs
  its own events with the secret the server was given.
- No Gemini keys are passed, so the chat answers through its no-AI paths:
  deterministic and free. Live model quality is the AI-22 eval, not a test.
- Each test resets and reseeds the database; account emails are new each time
  so the sign-in rate limit never carries over.
- Browsers live on D: (`PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright`).
  `E2E_CHANNEL=msedge` runs the suite in the installed Microsoft Edge instead.
- One retry is allowed and shows up as **flaky** in the report - see defect #13
  in `docs/testplan.md`. A test that fails twice is a real failure.

## Conventions

- **File name:** `<subject>.test.ts` (Vitest) or `<journey>.spec.ts`
  (Playwright), in the folder of the area it covers.
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
- **Mocks (unit):** create them with `vi.hoisted`, mock at the module boundary
  (`@/db/prisma`, `@/lib/stripe`, `@/auth`, `next/headers`, `next/cache`,
  `server-only`), then import the module under test.
- **Module state** (caches, rate limits, key pool health): reload the module per
  test with `vi.resetModules()` + dynamic `import()`.
- **Time:** use fake timers (`vi.useFakeTimers`, `vi.setSystemTime`), never
  real waits.
- **No real secrets or services** in `unit/` and `integration/`. Stripe and
  Gemini are mocked there; e2e uses Stripe's test mode only.
