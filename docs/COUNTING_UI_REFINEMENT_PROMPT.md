# Gemini Prompt: shadcn UI Consistency Refinement

Copy the prompt below into the coding agent from the repository root. The detailed,
decision-complete specification is in `docs/COUNTING_UI_REFINEMENT_CONTEXT.md`.

---

You are the Gemini Flash 3.6 High coding agent implementing a focused UI refinement in
the Poultry Receiving Counter System. Work directly in the current repository and
complete the implementation, visual QA where the environment permits it, and technical
validation.

## Mandatory preparation

1. Run `git status --short --branch` and inspect the current diff before editing anything.
   Preserve every pre-existing or unrelated change. In particular,
   `docs/PROJECT_STATUS.md` already had local user-owned changes at handoff time; do not
   overwrite, revert, reformat, or include that file in your work.
2. Read `AGENTS.md` completely.
3. Read these files completely and in this exact order:
   1. `docs/PRODUCT_SPEC.md`
   2. `docs/TECH_STACK.md`
   3. `docs/UI_STRUCTURE.md`
   4. `docs/DATA_MODEL.md`
   5. `docs/API_CONTRACT.md`
   6. `docs/IMPLEMENTATION_TASKS.md`
   7. `docs/DEPLOYMENT.md`
   8. `docs/PROJECT_STATUS.md`
4. Read `docs/COUNTING_UI_REFINEMENT_CONTEXT.md` completely. Treat it as the
   decision-complete specification for this task, subordinate only to the product and
   backend invariants in the mandatory repository documentation.

Do not start editing until all preparation steps are complete.

## Objective

Harmonize the complete application with the repository's current clean shadcn design
system. Prioritize Counting and the Surat Jalan form, then remove the same legacy
high-contrast patterns from dashboards, charts, lists, settings, master data, auth, and
the development simulator.

Keep the desktop 2+1-column information architecture and the single-column responsive
layout. Refine the shared console, both page wrappers, line selector treatment,
loading/error/empty states, and finish/cancel dialogs. Preserve all existing behavior.

## Primary implementation area

- `src/components/receiving/counting-console.tsx`
- `src/app/(admin)/admin/counting/page.tsx`
- `src/app/(operator)/active-session/page.tsx`
- `src/components/receiving/receiving-form-dialog.tsx`
- duplicated page headers, dashboards, charts, alerts, lists, and forms throughout `src/app/`
- directly related UI regression tests under `src/test/`, only if useful

Use the existing components under `src/components/ui/`. Add the official Radix-backed
`Collapsible` wrapper and restrict `Alert` to the standard `default` and `destructive`
variants. Do not rerun or replace the shadcn preset and do not change global theme tokens.

## Required result

- Use a neutral shadcn card header instead of a near-black header.
- Keep truck, delivery note, line, COUNTING status, and the Admin-only cancel action clear.
- Put Manifest and Actual in a neutral Card without tinted boxes; use color only on
  small icons or indicators and render main numbers with `font-semibold tabular-nums`.
- Keep variance as a compact neutral summary row without changing its calculation.
- Replace the custom dark SOP panel with the default `Alert` plus a warning-colored icon.
- Keep the conditional OFFLINE/STALE sensor warning destructive and visually distinct
  from the SOP warning.
- Put the desktop finish action right-aligned in `CardFooter`; preserve the full-width
  sticky mobile action bar and safe area.
- Keep receiving details and recent detections in the right column on desktop and below
  the main content on smaller screens.
- Harmonize the finish and cancel dialogs using existing shadcn variants without changing
  endpoints, payloads, callbacks, validation, or error handling.
- Fix the broken `â€¢` separator in the session metadata.
- Keep all UI copy in Bahasa Indonesia.
- Preserve a minimum 44 px mobile touch target and avoid horizontal overflow.
- Remove every `font-black` and `font-extrabold` use and avoid uppercase/bold on ordinary actions.
- Use `--chart-1` for Manifest/Assigned, `--chart-2` for Actual, and `--chart-3` for Unassigned.
- Group the Surat Jalan form into clear sections; place the three master selectors in a
  `Collapsible` named "Isi dari Data Master" and restore `documentTruckSequence`.

## Non-negotiable guardrails

- This is a UI-only refinement. Do not change APIs, schemas, migrations, seed data,
  domain services, authentication, authorization, WebSocket behavior, polling, device
  ingestion, audit behavior, or counting business logic.
- Actual count must remain derived only from immutable production detection events
  assigned to the active session. Never add manual actual editing.
- `CountingConsole` must remain shared by Admin and Operator.
- Preserve the finish confirmation, operational SOP, Admin-only cancel capability,
  role differences, and Truck A-to-B boundary behavior.
- Do not run a shadcn preset or generator. Do not replace base primitives or add/change
  global theme tokens.
- Do not use direct color-palette utilities such as `bg-red-500`, `text-green-600`,
  `border-rose-200`, `bg-black`, or `text-white`. Use existing semantic tokens.
- Do not commit, push, create or switch branches, reset, revert, clean, stash, or rewrite
  Git history. Leave the completed changes unstaged for review.
- Do not touch unrelated files or user-owned changes.

## Working method

1. Inspect the current counting components and existing shadcn primitives/tokens.
2. If the authenticated app and development database are available, capture before-state
   screenshots at representative desktop and mobile breakpoints.
3. Implement a small, focused diff following
   `docs/COUNTING_UI_REFINEMENT_CONTEXT.md` exactly.
4. Verify Admin and Operator states, including ONLINE and OFFLINE/STALE sensors,
   zero/non-zero actual counts, empty/populated detection logs, dialogs, and empty/error
   states where feasible.
5. Capture after-state screenshots at 360, 390, 768, 1024, and 1440 px where feasible,
   checking for overflow, hierarchy, readability, and sticky action behavior.
6. If authenticated visual QA is blocked by the database, server, or test accounts, do
   not invent credentials or fake a successful result. Report the exact blocker and
   continue with all safe static validation.
7. Run:

   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

   If PowerShell blocks `npm.ps1`, use the equivalent `npm.cmd` commands. Do not omit a
   failing validation; diagnose it and report the actual result.
8. Run `git diff --check`, inspect the final `git diff`, and confirm that unrelated local
   changes remain untouched.

## Final response requirements

Report concisely:

1. the visual and responsive changes implemented;
2. the files changed;
3. screenshot/visual QA results and any blocked scenarios;
4. exact validation commands and pass/fail results;
5. confirmation that APIs, backend invariants, realtime, authorization, and unrelated
   changes were not modified;
6. remaining risks or follow-up items, if any.

Do not claim visual QA or validation passed unless you actually ran it.

---
