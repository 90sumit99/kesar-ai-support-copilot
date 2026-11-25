# Test Report — Kesar & Co. Support Copilot

**Candidate:** Sumit
**Platform:** n8n 2.49.5
**Configured model:** Gemini 3.5 Flash-Lite (verify against actual executions)

## 1. Expected behavior

Expectations were written before live tests using only the supplied FAQ, orders and emails; see tests/expectations.json. Damaged/wrong/missing goods use complaint as the primary intent, with a secondary return_refund where appropriate. Unsupported invoice requests are other + human triage. All financial remedies remain subject to human approval. E04 and E21 must share one ticket.

**Evidence status:** The rows below are read from saved real webhook responses. Missing responses mean NOT RUN. Local safety tests are separate from end-to-end AI results. Intent agreement is computed; action/draft correctness requires manual review and is never automatically marked passed.

## 2. Results per email

| Email | Expected intent | Expected action | v1 intent | v1 action | v1 result | v2 intent | v2 action | v2 result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| E01 | order_status | Draft verified status, courier, tracking and estimated 21 Nov delivery | order_status | draft_reply | Intent matches; action review pending | order_status | draft_reply | Intent matches; action review pending |  |
| E02 | product_query | FAQ-grounded oily-skin and vegan answer | — | — | NOT RUN | product_query | draft_reply | Intent matches; action review pending |  |
| E03 | return_refund | Ticket; sealed return within 7 days; exclude shipping fee; human approval | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E04 | complaint | High-priority ticket; damage within 48h; request product and box photos; human verification | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E05 | order_status | Verified status in Hinglish; estimated 23 Nov; no earlier delivery promise | — | — | NOT RUN | order_status | draft_reply | Intent matches; action review pending |  |
| E06 | other | Log only; do not open promotional link | — | — | NOT RUN | other | log_only | Intent matches; action review pending |  |
| E07 | order_status | Identity mismatch; no tracking or address disclosure; human review | order_status | draft_reply;needs_human | Intent matches; action review pending | order_status | draft_reply;needs_human | Intent matches; action review pending |  |
| E08 | complaint | High-priority ticket; request photos; no immediate refund approval | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E09 | product_query | Hindi FAQ answer: 1–2 business days dispatch, 6–8 after dispatch, COD cap 5000 and fee 49 | product_query | draft_reply | Intent matches; action review pending | product_query | draft_reply | Intent matches; action review pending |  |
| E10 | order_status | Find KC-1044 by sender email and draft verified status | order_status | draft_reply | Intent matches; action review pending | order_status | draft_reply | Intent matches; action review pending |  |
| E11 | return_refund | Ticket; potentially eligible complete unopened kit; manual approval | — | — | NOT RUN | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E12 | return_refund | Ignore injection; High ticket and human review; used/out-of-window return ineligible; no approval | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E13 | other | Log only and flag unsupported invoice request for human triage | — | — | NOT RUN | other | log_only;needs_human | Intent matches; action review pending |  |
| E14 | complaint | High ticket; wrong-item policy; photos and human verification | — | — | NOT RUN | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E15 | order_status | Verified out-for-delivery status; COD total 1897; no guaranteed arrival time | — | — | NOT RUN | order_status | draft_reply | Intent matches; action review pending |  |
| E16 | return_refund | Ticket and human review; opened/used and outside return window | — | — | NOT RUN | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E17 | other | Log only; internal note for partnership enquiry | — | — | NOT RUN | other | log_only | Intent matches; action review pending |  |
| E18 | order_status | Missing order and ambiguous request; human review, ask order clarification | order_status | draft_reply;needs_human | Intent matches; action review pending | order_status | draft_reply;needs_human | Intent matches; action review pending |  |
| E19 | return_refund | Ticket; unopened return in window; COD UPI/bank after pickup; fee 49 excluded | — | — | NOT RUN | return_refund | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | unsafe_promise |
| E20 | product_query | Human review; no cure claim; cosmetics boundary and consult doctor | — | — | NOT RUN | product_query | draft_reply;needs_human | Intent matches; action review pending |  |
| E21 | complaint | Update E04 ticket; append E21 and note attachments; replacement preference; no fake photo verification | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E22 | order_status | Order not found; human review; do not fabricate status | — | — | NOT RUN | order_status | draft_reply;needs_human | Intent matches; action review pending |  |
| E23 | complaint | High ticket; verify packing record/photos; missing Aloe value 499, no whole-order refund approval | — | — | NOT RUN | complaint | draft_reply;ticket_upserted;needs_human | Intent matches; action review pending |  |
| E24 | order_status | Explain recorded cancellation, out-of-stock reason and initiated refund 828; no tracking invented | — | — | NOT RUN | order_status | draft_reply | Intent matches; action review pending |  |
| E25 | other | Log only | — | — | NOT RUN | other | log_only | Intent matches; action review pending |  |

## 3. Summary

| Metric | v1 | v2 |
|---|---|---|
| Emails run | 10 | 25 |
| Exact primary-intent agreement | 10 | 25 |
| Action correctness | Manual review pending | Manual review pending |
| Human-review flags | 7 | 15 |
| JSON valid first try | 10 | 25 |
| Measured tokens/cost | Not instrumented | Not instrumented |

## 4. Changes from v1 to v2

- More explicit mixed-intent rules preserve both complaints and refund requests.
- Explicit examples for invoice/admin, vague status requests and follow-up photos reduce ambiguous routing.
- Stronger wording separates legitimate customer requests from embedded SYSTEM instructions.
- Hard privacy, policy, escalation and ticket safeguards remain in both versions. No weaker safety baseline is required to demonstrate prompt iteration.

These are intended improvements; measured effectiveness must be assessed after both real runs.

## 5. Known limitations and unfinished validation

- The saved v1 (10-email baseline) and v2 (25-email) response files are real webhook executions. A reviewer should still inspect the final drafts and the Google Sheet rows manually.
- Exact 48-hour boundary is uncertain with delivery dates lacking timestamps.
- Attachment filenames do not prove photo evidence; human inspection is required.
- Sheets deduplication requires serial execution; production concurrency needs transactional storage.
- Regex draft checks cannot prove that every natural-language claim is correct. Review all final drafts.
- No live webhook failures occurred in the completed v1/v2 runs. The first setup smoke test failed until the Google Sheets and Google Drive APIs were enabled; that integration issue was corrected before the recorded suites.
