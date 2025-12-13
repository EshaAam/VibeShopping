# 📘 Project Best Practices

## 1. Project Purpose
VibeShopping is a modern e-commerce platform built with Next.js (App Router). It provides product discovery, cart and checkout flows, order management, and an admin dashboard for managing products and users. Authentication is handled with NextAuth, data access with Prisma (connected to Neon serverless Postgres), and the UI leverages Tailwind CSS with Radix UI components.

---

## 2. Project Structure
- app/
  - App Router structure with route groups and nested segments.
  - (root)/: user-facing pages (home, product, cart, checkout, orders, profile, search).
  - (auth)/: auth-related pages (sign-in, sign-up) and layout.
  - admin/: admin pages for products, users, orders, overview and charts.
  - api/: route handlers (e.g., NextAuth, UploadThing).
  - layout.tsx, loading.tsx, not-found.tsx: shared shells and states.
- components/
  - shared/: reusable domain components (header, product UI, admin forms, pagination, etc.).
  - ui/: low-level UI primitives (mostly Radix + shadcn patterns).
  - footer.tsx, view-all-products-button.tsx: shared layout widgets.
- db/
  - prisma.ts: Prisma client configured with Neon adapter and WebSocket for serverless Postgres.
  - seed.ts, sample-data.ts: data seeding and examples.
- lib/
  - actions/: server actions (cart, order, product, user) using 'use server'.
  - constants/: app-wide constants and defaults.
  - utils.ts: helpers (classnames, formatting, currency/number/date, URL query manipulation, errors).
  - validator.ts: Zod schemas for input validation (products, auth, cart, orders, user).
  - uploadthing.ts: UploadThing setup.
- prisma/
  - schema.prisma and migrations/: DB schema and versioned migrations.
- hooks/
  - use-toast.ts and other potential hooks.
- types/
  - index.ts, next-auth.d.ts: domain types and NextAuth type augmentation.
- root configs
  - eslint.config.mjs, tailwind.config.ts, tsconfig.json, next.config.ts, middleware.ts, package.json, README.md.
- public/
  - static assets (images, logos, banners, sample product images).
- assets/
  - styles/globals.css and other static assets.

Conventions and Entry Points:
- Server actions live under lib/actions with explicit 'use server'.
- Prisma client is initialized once in db/prisma.ts with Neon adapter. Avoid re-initializing.
- Middleware integrates NextAuth middleware and guest cart cookie logic via export { auth as middleware } from '@/auth'.
- NextAuth configuration and callbacks are in auth.ts.

---

## 3. Test Strategy
There are currently no tests in the repository. Adopt the following strategy:

- Frameworks
  - Unit: Vitest + ts-node (or Jest) with React Testing Library for components.
  - Integration: React Testing Library for component/page integration with routing mocks.
  - E2E: Playwright (or Cypress) for core flows (browse -> add to cart -> checkout -> place order).

- Structure & Naming
  - tests/ for integration/e2e, __tests__/ colocated unit tests near source files.
  - Use .test.ts/.test.tsx suffix.

- Mocking Guidelines
  - Prisma: prefer a real ephemeral DB for integration (e.g., a dedicated Postgres schema) or use SQLite for unit-level data access via a compatible schema. For pure unit tests, abstract data access behind small functions and mock their return values.
  - Network: use MSW for mocking route handlers (app/api/*) and UploadThing endpoints.
  - NextAuth: mock getServerSession/auth as needed; verify protected routes via middleware-compatible tests.

- What to test
  - Unit: utilities in lib/utils.ts (formatError, formatCurrency, round2, formUrlQuery), validators in lib/validator.ts, small UI units.
  - Integration: server actions in lib/actions/* with Prisma test DB, page-level rendering for app/(root)/*.tsx with mocked data, pagination behavior.
  - E2E: full checkout flow, authentication flows, admin product create/update/delete, search and filters.

- Coverage Expectations
  - Aim for 70%+ unit/integration coverage on critical modules (actions, validators, utils). Add thresholds gradually to avoid blocking dev velocity initially.

---

## 4. Code Style
- TypeScript
  - strict mode is enabled; avoid any. Prefer explicit types and zod inference where possible (z.infer<typeof Schema>).
  - Use const when possible; prefer immutability for predictable state.

- Naming & Files
  - Components: PascalCase for component names; files are kebab-case.
  - Actions/Utilities: lowerCamelCase for functions; group domain logic in lib/actions and lib/validator.

- React & Next.js
  - Server Components by default. Use 'use client' only when necessary (hooks, event handlers, window API).
  - Server Actions: annotate with 'use server', enforce input validation via Zod, and return typed results (e.g., { success, message }).
  - Avoid mixing client hooks in server components. Lift client behavior into child components.

- Data & Formatting
  - Prisma result transforms convert product.price and product.rating to strings via Prisma $extends. Treat these as strings in UI and use utils (formatCurrency, round2) to format/compute.
  - Use lib/utils.ts helpers for currency/number/date/time/URL formatting.

- Errors & Validation
  - Validate inputs with Zod schemas from lib/validator.ts before mutating data.
  - Use formatError to map Zod/Prisma errors to user-friendly messages.

- Env & Config
  - Read env via process.env.*. Keep secrets out of the client; only NEXT_PUBLIC_* keys can be exposed to the browser.
  - Provide fallbacks for NEXT_PUBLIC_* constants (see lib/constants/index.ts).

- ESLint & Accessibility
  - Follow next/core-web-vitals and next/typescript rules.
  - Use semantic HTML and aria-* attributes where applicable; leverage Radix/shadcn UI accessibility by default.

---

## 5. Common Patterns
- Server Actions (lib/actions/*)
  - 'use server' at top. Compose filters (query/category/price/rating/sort/pagination) and return simple serializable data.
  - Use revalidatePath after mutations to keep UI consistent.

- Pagination & Query Strings
  - Use components/shared/pagination.tsx and lib/utils.formUrlQuery to mutate URL search params. Keep page as a number and guard boundaries.

- Validation & Forms
  - Zod schemas in lib/validator.ts with @hookform/resolvers/zod for forms (react-hook-form).
  - Consistent currency validation with formatNumberWithDecimal.

- Authentication
  - NextAuth v5 config in auth.ts with PrismaAdapter and Credentials provider.
  - JWT-based session strategy, user role stored in token and session.
  - authorized callback enforces protected paths and sets guest sessionCartId cookie.

- Database Access
  - Single Prisma client instance with Neon adapter and ws configured in db/prisma.ts.
  - Avoid N+1 by including related data in queries when needed. Prefer single combined queries where possible.

- UI & Design System
  - Tailwind CSS with shadcn-style components (components/ui/*), Radix primitives for dialogs, dropdowns, toasts, etc.
  - Encapsulate domain visuals in components/shared/product/*.

- File Uploads
  - UploadThing configured under app/api/uploadthing and lib/uploadthing.ts.

---

## 6. Do's and Don'ts
- ✅ Do
  - Keep server/client boundaries clear. Mark client components with 'use client'.
  - Validate all inputs at the edge (forms/actions) with Zod.
  - Use utilities in lib/utils.ts for formatting and URL manipulation.
  - Revalidate relevant paths after create/update/delete operations.
  - Paginate queries; avoid unbounded findMany calls.
  - Centralize constants in lib/constants and types in types/.
  - Use Prisma includes/selects to fetch all necessary relations in a single query to avoid N+1.
  - Prefer async/await with proper try/catch in mutations; return typed { success, message }.

- ❌ Don't
  - Don't call window/document in server components or server actions.
  - Don't leak secrets to the client; only expose NEXT_PUBLIC_*.
  - Don't re-initialize Prisma clients; import prisma from db/prisma.ts.
  - Don't rely on implicit any; keep TypeScript strict.
  - Don't block the main thread with heavy computations in client components.
  - Don't push navigations on every keypress without debounce in search inputs.

---

## 7. Tools & Dependencies
- Next.js 15 (App Router), React 19: core web framework and UI.
- NextAuth v5: authentication with PrismaAdapter and Credentials provider.
- Prisma 6 + Neon: ORM with serverless Postgres (WebSocket adapter).
- Tailwind CSS + tailwind-merge + clsx: utility-first styling and class management.
- Radix UI + shadcn-like components: accessible UI primitives.
- Zod + @hookform/resolvers + react-hook-form: schema validation and form handling.
- UploadThing: file uploads.
- Recharts: charts for admin overview.
- query-string: URL query manipulation.

Setup & Development
- Requirements
  - Node.js LTS
  - Postgres (Neon connection string) in DATABASE_URL

- Environment Variables (examples)
  - DATABASE_URL: Neon connection string
  - NEXTAUTH_SECRET: secret for NextAuth JWT
  - NEXT_PUBLIC_APP_NAME, NEXT_PUBLIC_APP_DESCRIPTION, NEXT_PUBLIC_SERVER_URL
  - PAYMENT_METHODS (comma-separated) and DEFAULT_PAYMENT_METHOD

- Commands
  - Install: npm install
  - Generate Prisma: npm run postinstall (or npx prisma generate)
  - Migrate: npx prisma migrate dev
  - Seed: ts-node db/seed.ts (or a package script if added)
  - Dev server: npm run dev
  - Build: npm run build; Start: npm start

---

## 8. Other Notes
- LLM Integration Tips
  - Respect server/client boundaries and add 'use client' where hooks/events are used.
  - Use existing Zod schemas; derive types with z.infer<>.
  - Use lib/utils.ts for formatting/currency/URL helpers instead of re-implementing.
  - Treat price and rating as strings in UI due to Prisma result transforms.
  - Use revalidatePath after any server-side mutation that changes visible data.
  - Prefer Pagination component and formUrlQuery for list navigation.
  - For search pages, normalize and validate searchParams, provide empty states, and consider metadata with generateMetadata.
  - Add error.tsx co-located with routes for resilient error boundaries.

- Performance & Caching
  - For dynamic routes (e.g., search), consider noStore() or short revalidate intervals as appropriate.
  - Prefetch critical data where possible; avoid client waterfalls.

- Security
  - Sanitize user input; never trust searchParams directly in HTML.
  - Protect routes via NextAuth authorized callback and server checks.

- Accessibility
  - Use semantic tags and Radix components; ensure keyboard navigation and focus management are correct.
