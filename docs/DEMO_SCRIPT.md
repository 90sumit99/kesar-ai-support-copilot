# Five-minute demonstration

Record the real working n8n canvas and Google Sheet after credentials are connected. Do not include credential settings or API keys in the video.

0:00–0:35 — Introduce the problem: repetitive customer support, inconsistent policy decisions and privacy risk. Explain that every response is a draft.

0:35–1:15 — Walk through webhook, classification, validation/retry, safety checks, tool-using agent, tickets and audit logging. Show get_order and search_faq attached to the agent.

1:15–2:00 — Run E01. Open the execution and show the agent's get_order call. Show its matching audit row and source-grounded draft.

2:00–2:50 — Run E04. Show the damage-policy branch, request for photos, human-review flag, and High-priority ticket.

2:50–3:30 — Run E21. Show it updates the E04 ticket instead of creating another one. Attachment filenames are recorded but their contents are not verified.

3:30–4:10 — Show E07 privacy denial and/or E12 injection handling. Explain that identity is bound to the incoming sender in code, not provided by the LLM.

4:10–4:40 — Show the real v1/v2 test report: what changed and what the measured results show. Do not claim perfect results unless actually measured and reviewed.

4:40–5:00 — Explain one real limitation: date-only delivery data makes the exact 48-hour boundary uncertain; concurrent production processing needs a database lock/unique constraint; photos still need a person. Mention AI-assisted development and how you tested the code.
