# FE-020 + FE-021 — Discovery / provider detail UI and mock

## Scope and ownership

Implemented in step 2/4; production QA completed in step 3/4 with a prototype-backed Home navigation fix in step 4/4 on 04/11/2026 (Asia/Ho_Chi_Minh). The user explicitly approved implementing both screens together. One branch `FE-020-021`, one isolated worktree `PawFlow-Discovery-FE020-021`, based on `origin/dev` at `b70d18b14c82cae036cd0d3f6c0bb69f47b421c5`. No staging, commit, push, PR, merge or task-sheet changes in steps 2 or 3. Final QA and per-task checklists: [QA report](FE-020-021-qa.md). Final handoff inventory/hashes: [manifest](FE-020-021-handoff-manifest.json).

After fetching origin, the remote branch inventory and open PRs showed no Discovery/detail source or FE-020/021 work from Nhi overlapping this implementation. PR #17 (Dashboard QA, `bec5faf`) and PR #16 (FE-023 account/pets, `0bb1222`) remain independent and open. This does not establish the absence of unpublished work on Nhi's computer. The latest task sheet assigns FE-020 to Dev 2 and FE-021 to Lead; that assignment is unchanged. FE-021 UI implemented here needs Nhi's review and coordination before handover.

This is a scoped contribution to FE-018, not a completed project-wide audit. It implements UI with a mock repository; its fixture types are not backend DTOs or an API contract. No API/auth integration, token/storage access, booking submission, pet/account management, notification module, dashboard changes, Animate UI, dependency/config/lockfile changes or adoption of FE-023 source.

## Primary design references

Figma file `inb2P8smrZU5d2gNImKoaP`, Website → PawFlow → Customer Present page:

- Discovery guest [4884:16017](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4884-16017); customer [4903:15039](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4903-15039).
- Detail guest [4884:15835](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4884-15835); customer [4903:15577](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4903-15577).
- Filter dialog `5020:3384`; high-fidelity list `4903:15090`, detail services `4903:15648`, customer header `4903:16076`, time panel `4908:15135`.
- Archive frames are excluded. Sort/pagination behavior comes from the approved task scope: Figma pagination layers are hidden and sort was not a complete control.

Necessary original static assets were downloaded from design-context URLs and retained without modifying their bytes or SVG root dimensions. Step 3 replaced ten interface pictograms with Lucide and deduplicated three byte-identical originals; 43 photo/logo/decorative assets remain. Provider/service photos now share a missing/broken-image fallback. Source asset names ending in `.png` sometimes contain JPEG data; the image decoder detects the original format. Next/Image serves local optimized raster variants. No temporary Figma URL is used at runtime. `designAssets.ts` records the actual dimensions from metadata, not guessed image sizes. Extra providers have an explicit missing-image placeholder rather than a fabricated photograph.

Proposal: [PawFlow](https://docs.google.com/document/d/1wKi64dJuAjAQEmeSpXuUuB-MyI9nUzLrUinKDIvsp9Y/edit?tab=t.0), §7.1, FR-CUS-SEARCH-01, BR-01/02/03 and UC-BOOK-01. Provider approval and active services are prerequisites for discovery; pet ownership and transactional capacity validation remain backend responsibilities in the future integrated flow.

## Routes and data flow

- `/discover`: one card per public mock provider, four providers per page.
- `/providers/[providerId]?serviceId=…&returnTo=…`: public provider information and the requested service's read-only availability. No separate service-detail screen is invented.
- `customer-catalog` owns fixture models, data, formatting/eligibility logic, the abortable repository and asynchronous resource hook. Discovery and detail use the same catalog. Repository results are copied so callers cannot mutate the shared fixtures.
- `customer-discovery` owns search logic, query semantics, controls, dialog and card/list rendering. `customer-provider-detail` owns service/detail/availability display. `discovery-shell` is scoped to this route group and does not modify the existing shared Header/Sidebar or FE-023 shell.
- Route files only supply metadata, parameters, Suspense boundaries, fonts and composition. Browser hooks live in client components.

## Customer Home navigation fix for PR #18

Keep the original `Trang chủ` label. Its actual href in the isolated header/mobile/footer is `/discover`, following the primary prototype: guest detail Home navigates to frame `4884:16017`; logged-in detail Home navigates to `4903:15039`. Both are the existing Discovery route variants. The root `/` instead resolves to `src/app/page.tsx` with the existing Provider Header/Sidebar and PawPal placeholder, outside the Discovery route group.

Logos still target `/discover`. Footer `Khám phá` performs in-page `#results` scrolling on Discovery (query/page preserved), matching SCROLL_TO list nodes `4884:16066` / `4903:15090`; from detail it navigates to `/discover`. Other original labels/destinations remain unchanged. No root/shared/Provider/auth edit, global redirect, new landing page or route is introduced. The earlier unpushed label-changing workaround was replaced before this handoff.

## Search and query semantics

The browser URL represents applied criteria. Supported fields are `q`, `categoryId`, `area`, `maxPrice`, `minRating`, `available`, `sort`, `page`.

- `q`: trimmed, control characters removed, maximum 120 characters. Search normalizes case, Vietnamese accents and đ/Đ. An entire keyword phrase is a substring match in any one of provider name, service name, category name or provider address (OR between those fields).
- Category, area, exclusive maximum price, minimum rating and available-only conditions are ANDed. Service/category status, category, price, text matches at service level, and availability must all hold for the same service. A provider's cheap service cannot borrow availability from another expensive service.
- Fixture category IDs: `bath`, `groom`, `boarding`; area IDs: `q3`, `q1`, `phunhuan`, `q7`. They are UI fixture identifiers, not backend IDs.
- `maxPrice` is exclusive: 300000 means strictly below 300,000 VND. `minRating` is inclusive. Unknown prices/ratings fail a corresponding numeric filter. An actual zero price is valid and stays distinct from unknown.
- The first preset toggles Quận 3 + price <300000 + available. The second toggles bath + rating >=4.5. They can be combined. Turning one off clears its own fields, preserving the other preset's independent fields. Direct category controls update the same query model. Reset clears all search/filter/sort/page criteria.
- Four providers per page; default order is explicit `fixtureOrder`, then stable ID. For default/rating sort, the representative service is the first matching service in fixture order. Price ascending chooses the cheapest matching service; price descending chooses the most expensive matching service. That exact service supplies the card name, price, duration and detail link.
- `rating-desc`, `price-asc`, `price-desc` keep unknown data last, with fixture order then ID as stable ties. A provider with zero review count is displayed as not reviewed, not as a zero-star rating.
- Search commits after 350ms using native `replaceState`. Filters/sort/page use `pushState`; criteria changes reset to page 1. Next.js documents native history integration with useSearchParams. Pending search is discarded on history navigation and unmount; filter actions apply the current search draft together with the filter.
- Invalid category/area/sort/numbers/pages revert to safe defaults. Duplicate keys use the first value. Unknown fields are dropped. URL normalization uses replace; a page beyond the final result page is clamped after the result is known. Empty results have page 1. Invalid percent-encoded query text does not throw.
- `returnTo` accepts only the exact internal `/discover` path and canonical supported query fields. Absolute/protocol-relative URLs, other paths, control characters and backslashes fall back to `/discover`. Hashes and unknown fields are discarded. Explicit return from detail preserves the applied criteria and page. No auth return URL or redirect is introduced.

## Mock async lifecycle and tools

The mock repository takes AbortSignal, delay and failure options. Cancellation clears its timer and listener. `LatestRequest` plus effect cleanup checks both request generation and AbortSignal before applying success or failure, including non-cooperative late responses. A new query/request key displays loading rather than leaving an actionable stale result list. Search, provider detail and availability have separate loading/error/retry paths; availability failure does not hide the provider's information.

Tools below the page let reviewers choose guest/customer, a dog/cat/no-pet sample, 60/300/1200ms latency, independent failures and the frozen clock. Retry clears the corresponding injected failure. These tools only change in-memory sample state. The route-group layout preserves it across Discovery/detail navigation; reload or leaving the group resets it. No real authentication, storage or FE-023 pet state is read.

The first four providers correspond to the primary Figma examples. Three additional explicitly named sample providers exercise page 2, full slots, unknown fields, no schedule and a genuine zero price. PENDING/SUSPENDED providers and inactive service/category fixtures are retained for negative cases but omitted from discovery. They do not imply actual provider records or backend eligibility policies.

## Detail, availability and booking boundary

- No pet and no slot never hide public provider/detail content. Missing, PENDING or SUSPENDED providers display a generic unavailable state. A foreign, inactive, missing or inactive-category selected service produces an unavailable-service message without silently selecting another service; the user can view another displayed active service.
- Eligibility explanations are explicitly based on sample dog/cat support. Unknown support is not treated as permission. There is no claim that this enforces server authorization or a backend species policy.
- Clock starts at `2026-11-04T10:00:00+07:00`, clearly labelled as a frozen mock clock. It can advance by one hour or reset. All schedule calculations use explicit Vietnam UTC+7 instants, independent of the browser/host timezone. Date-only values are calendar-validated and displayed as dd/MM/yyyy; times use HH:mm. No UTC conversion is used to display a date-only value.
- Slots at/before the mock current time are marked past, not available. Capacity/bookedCount missing, invalid or inconsistent remains unknown. Read-only rows distinguish available, full, closed, past and unknown. No published schedule, no upcoming schedule, unknown schedule and failed loading have distinct messages. No slot is selected or reserved.
- Prices use validated decimal text and minor units before sorting/formatting; null does not become zero. Missing duration, rating, images, hours and descriptions have explicit fallbacks.
- Guest links use existing `/login`; its current redirect is unchanged and return to detail after login is not promised. Customer sample is independent from real identity. Booking is disabled with a brief product explanation; no technical task ID, fake booking URL, selected-pet form, reservation or send action is added.

## API gaps carried forward

Read-only source survey on API dev at `38c97ad86853e225628184dd788654303a115ade` (03/11/2026), not runtime/DB evidence:

| UI responsibility | Existing source contract | Remaining dependency |
| --- | --- | --- |
| Category selection | Public GET /api/service-categories, ACTIVE categories ordered by name | Map actual IDs to UI when integrating |
| Discovery | Public GET /api/services/public, bare array; service/category/provider public projection, fixed createdAt DESC/id DESC | Search/filter/sort DTO, provider aggregation, pagination/count and query/index contract |
| Service detail | GET /api/services/public/:id; BIGINT IDs and numeric price serialized as strings | Public provider detail aggregation and safe incomplete/unavailable state contract |
| Ratings | Provider ratingAvg/ratingCount and GET /api/reviews/provider/:providerId for visible reviews | Any future review pagination/author-safe display; no new review screen here |
| Availability | GET /api/availability/public[/:id], bare array, future-date OPEN slots with remaining capacity | Provider/service/date queries, explicit timezone, same-day past-time and working-hours checks, stale semantics |
| Provider information | Business name/address/description/rating nested in public projections | Public hours, images, structured location and supported-species contracts; phone is intentionally omitted |
| Future booking | POST /api/bookings with petId, slotId, customerNote; CUSTOMER guard; server derives provider/service/price | FE-022 UI, FE-027/028 foundations and FE-029/030 integration; no request sent here |

Existing owner-only provider/working-hours APIs are not used to fill public UI. No backend/auth source or contract is changed.

## Verification and remaining steps

The step 2 checks below are historical implementation evidence. Step 3 production QA now passes the agreed viewport, keyboard, query/history, asynchronous, detail-state and scope matrix; see the linked QA report for actual cases and limits. Only step 4 single Git/PR handover remains; neither task is pushed separately.


### Step 2 results

| Check actually run | Result |
| --- | --- |
| `npx next typegen` | Passed; generated route types are ignored build output |
| `npx tsc --noEmit --incremental false` | Passed |
| `npm run lint` | Passed, no warnings |
| `npm run build` | Passed after the final CSS changes; `/discover` and `/providers/[providerId]` present |
| Three pure-logic/repository suites compiled with TypeScript, then `node --test` | 24/24 passed |
| Focused Chromium behavior suite | 12/12 groups passed; no page errors or API requests |
| Final production render at 1440x1000 and 390x844 for both routes | Four renders passed: no broken images, horizontal overflow or page errors |
| Whitespace checks on tracked diff and every new text file | Passed |
| Preservation snapshot of five pre-existing worktrees, preservation backups and stash list | Unchanged; 24 backup files and 3 stashes preserved |

Focused browser checks covered direct links, debounce/accent normalization, representative-service sorting, return query/page, Back/Forward, combined presets, Escape/focus return, the frozen clock, no-pet detail, disabled booking, retryable independent failures, invalid query/unsafe return/foreign service, and an intentionally slow older search racing a newer search. These checks do not replace step 3 visual, keyboard and full state regression QA.

The pure suites can be rerun without adding a dependency or test configuration:

```sh
npx tsc src/features/customer-catalog/catalogLogic.test.ts src/features/customer-catalog/mockRepository.test.ts src/features/customer-discovery/searchLogic.test.ts --outDir /tmp/pawflow-discovery-tests --module commonjs --moduleResolution node --target ES2022 --esModuleInterop --skipLibCheck
node --test /tmp/pawflow-discovery-tests/customer-catalog/catalogLogic.test.js /tmp/pawflow-discovery-tests/customer-catalog/mockRepository.test.js /tmp/pawflow-discovery-tests/customer-discovery/searchLogic.test.js
```

Production preview for this step: `npm run start -- --port 3020` from the isolated worktree. Local links:

- http://localhost:3020/discover
- http://localhost:3020/providers/1?serviceId=101

At the end of step 2, all 91 task files were new and untracked: 31 runtime source/style files, 3 test files, 56 original design assets and this document. The tracked and staged diffs are empty. The historical step 2 source/assets/test aggregate SHA-256 (excluding this document, paths plus per-file SHA-256) was `103c936c457284a1f59f34efef926afef5df160a8c4ff6c7e848ca0eae83e797`.

### Step 4 supplement for the existing PR #18

The initial source/QA snapshot was committed as `12febc0a23a2a1ea4a8ae012d9a64475bf82190a`; PR #18 targets dev and already requests quinnie-o3 review. The Home bug was reproduced against that exact published source, then fixed while retaining its labels. Current verification: normal lint/typecheck/build PASS and 51/51 Chromium groups, including 166 visible anchor activations, 16 four-viewport inventories, keyboard/focus, direct/reload/Back/Forward, selected-service/return URL and query-preserving Explore cases. Pure tests/assets reuse unchanged hashes; the initial broad QA remains historical evidence.

Current handoff still contains 81 files (32 runtime/style/registry, 3 tests, 43 assets, 3 docs/manifest). Final combined SHA-256 is `195bf65d872b24f1d193919c1d22a2c9f99a1c1f49a72fb1101f921d95e70192`; the [manifest](FE-020-021-handoff-manifest.json) records current bytes and the QA report preserves reproduction/prototype/check evidence. Only two shell components and three task documents change relative to the initial commit.

Publish this correction through the same FE-020-021 branch and PR #18, without force push/new PR/merge or sheet/assignee changes. FE-023 and Dashboard QA remain independent. This remains UI/mock, not integrated booking/API/auth/RBAC; the audit contribution stays limited to FE-018's related scope.
