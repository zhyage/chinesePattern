---
name: Chinese Pattern Development
description: |
  Fix bugs, run tests, implement features, and enforce project conventions for the
  Chinese Traditional Pattern Museum (chinesePattern) project. Use browser debugging
  when API responses are suspicious, UI tests when visual behavior is unclear, and
  run npm scripts before asserting branch can be merged.
---

# === Core Philosophy ===
# 1) Advise first, then act. Box out the expected behavior before touching files.
# 2) Use fsanitize where possible. Document why a change is needed and what it fixes.

# === Development Workflow ===
# 0) Start each task by: read the relevant API route, line it up against the milestone
#    in @schedule.md.
# 1) Before touching any source: run npm run lint && test when tests exist.
# 2) If a route returns 200 but the caller expects structured data, open the browser
#    and test the API call directly to decide whether this is a silent failure or
#    a JSON parsing problem.
# 3) For UI/interaction issues (buttons unresponsive, tabs missing), open http://localhost:3000
#    and interact with the page using browser tools before deciding whether this is CSS,
#    React state, or a data fetch.
# 4) Always check the server log for DB bootstrap issues like better-sqlite3
#    module version mismatches. Restart with nvm use 20 when errors mention ERR_DLOPEN_FAILED.

# === Deployment & Health Checks ===
# Before declaring a feature done: confirm the server stays alive under load.
# Example: 10 concurrent curl or browser calls on the same user route and monitor
# the server log for a crash or assertion failure, then restart and retest.

# === Refactor Guidance ===
# This project DELIBERATELY rejected backward compatibility when it moved from the old
# two-level model (纹饰类型 → 式样) to the flat + faceted model. See design.md §2.1 for
# why, and §11 for the glossary — read both before touching the data model.
#
# Therefore:
#   - Do NOT preserve old HTTP verb/response shapes "for compatibility". There are no
#     external consumers; the only consumer is this repo's own frontend.
#   - Do NOT preserve old column names. parent_id / alternate_name / the five scalar
#     facet columns were deleted on purpose.
#   - If existing code conflicts with design.md, design.md wins — delete the old code
#     rather than adapting the design to it.
#
# For schema changes: use `prisma migrate` (a baseline exists), back up dev.db first,
# then verify row counts, foreign keys, and integrity. Never use `prisma db push`.
