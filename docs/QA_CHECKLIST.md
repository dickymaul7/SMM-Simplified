# QA_CHECKLIST.md

Use before merging substantial changes into `main`.

## Smoke test
1. Sign in.
2. Open Buat Brief.
3. Fill/restore Quick Brief.
4. Navigate to Content Calendar.
5. Return to Buat Brief and confirm draft persists.
6. Open an existing Story Angle.
7. Open Full Brief.
8. Edit one headline and save.
9. Reorder one slide.
10. Confirm Human QC becomes pending if applicable.
11. Mark Human QC approved.
12. Schedule the brief.
13. Open Content Calendar.
14. Confirm the card appears on the expected date.
15. Drag the card to another date.
16. Refresh and verify the new date persists.
17. Set Ready to Design / Designed.
18. Save a design-file link.
19. Refresh and verify status + link persist.

## AI regression test
Only when AI code changes:
1. Generate a new brief.
2. Confirm 5 Story Angles.
3. Confirm at least one real identifiable case.
4. Confirm source evidence exists.
5. Confirm Bahasa Indonesia.
6. Confirm case-first opening when appropriate.
7. Confirm CTA does not dominate early slides.

## UI-only acceptance
- No API route changes unless unavoidable.
- No DB changes unless explicitly required.
- Existing functionality passes smoke test.
- Compare Vercel Preview with production before merge.
