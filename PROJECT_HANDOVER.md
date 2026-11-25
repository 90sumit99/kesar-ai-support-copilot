# Kesar Support Copilot — project handover and command guide

Last updated: **25 November 2026 (India time)**.

This is the historical working guide for continuing without the original chat. The project is now connected and validated: Google Sheets OAuth is saved, the v2 webhook is published, all 25 live v2 scenarios completed, and local tests pass 21/21. The older pending notes below describe the setup process and should not override the current README or TEST_REPORT.

## 1. Start here

1. Open **PowerShell** from the Windows Start menu.
2. Go to the project:

```powershell
Set-Location -LiteralPath 'C:\Users\sumit\Documents\Projects\Codex Projects\kesar-support-copilot'
```

3. Open **http://localhost:5678** in your browser. If n8n already opens, do not start another copy.
4. If it does not open, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-n8n.ps1
```

5. Wait until the terminal says the editor is accessible, then open **http://localhost:5678** again. Sign in with the local n8n account you created. Keep that PowerShell window open while working.

The `ExecutionPolicy Bypass` option applies to this PowerShell process; this command does not permanently change your machine's execution-policy setting.

**Your next project step:** verify the saved **Kesar Gemini** credential, then finish the **Kesar Google Sheets** connection. After that, run the real v1 and v2 tests below.

## 2. What the assignment asks for

Build an n8n support automation for the fictional skincare brand Kesar & Co. It must classify customer emails, look up orders, answer only from the provided FAQ, draft replies, create/update tickets, and log every email in Google Sheets. Risky cases require human review. It must not actually send emails or issue refunds.

Required evidence includes at least 10 emails run through v1, all 25 run through v2, a test report, workflow exports, a viewable Google Sheet, screenshots and a five-minute recording. The invitation email contains your exact deadline.

Assignment repository: https://github.com/abhishek-patel-cadient/kesar-ai-copilot-assignment

## 3. Where everything is installed

**Project root:**

```text
C:\Users\sumit\Documents\Projects\Codex Projects\kesar-support-copilot
```

| Item | Location / meaning |
|---|---|
| n8n installation | `.runtime\node_modules\n8n` inside the project |
| n8n executable script | `.runtime\node_modules\n8n\bin\n8n` |
| Runtime dependency manifest | `.runtime\package.json` and `.runtime\package-lock.json` |
| n8n version installed | 2.49.5 |
| Node.js already on your PC | `C:\Program Files\nodejs\node.exe`; detected version v24.13.0 |
| npm already on your PC | Detected version 11.6.2; commands below use `npm.cmd` |
| Python already on your PC | `C:\Users\sumit\AppData\Local\Programs\Python\Python314\python.exe` |
| n8n data directory | `.local\.n8n` inside the project |
| Local database | `.local\.n8n\database.sqlite` |
| n8n configuration/encryption material | In `.local\.n8n`; preserve the whole directory |
| Editor address | `http://localhost:5678` |
| Server logs from the background launch | `n8n-server.log` and `n8n-server-error.log` |
| Installation log | `n8n-install.log` |

**n8n was NOT installed globally.** I used `npm.cmd install --prefix .runtime ...`, not `npm install -g`. It is also **not** running through Docker or n8n Cloud. Docker was present on your PC, but its daemon was not running, so I used a local Node.js installation.

Node/npm were already installed; I did not install another system-wide Node.js version. npm may also use its ordinary cache outside this folder; that does not make n8n a global installation.

The start script sets `N8N_USER_FOLDER` to this project's `.local` directory. Running a bare `n8n` or `npx n8n` elsewhere can use a different data directory or installation. Always use the supplied start script to see this project's accounts and workflows.

## 4. Current status — what is finished and what is not

### Implemented and previously verified

- Cloned the assignment into the project folder and created branch `codex/kesar-support-copilot`.
- Installed n8n 2.49.5 locally and started its editor.
- Generated two 26-node workflow exports and imported both into n8n.
- n8n's own parameter checks passed for all 26 nodes before the latest small code safeguard change.
- **21 local tests passed** after that safeguard change. These are code/export checks, not 21 live customer-email executions.
- Added LLM classification prompts, JSON validation, repair and fallback.
- Added the read-only agent tools `get_order` and `search_faq`.
- Added sender ownership checks, return-policy calculations, human-review flags, ticket deduplication and audit upserts.
- Prepared two credential entries: **Kesar Gemini** and **Kesar Google Sheets**.
- Created test expectations, a real webhook test runner, a report generator, setup documentation and a recording outline.
- You created the local n8n owner account and reported entering your Google API key.

### Still pending or not independently verified

- Verify that the API key was saved and that **Kesar Gemini** connects successfully.
- Verify that the configured Gemini model is available to your account and can call tools.
- Finish Google Cloud / Google Sheets OAuth setup.
- Create the required Google Sheet and its exact headers, then put its ID into the workflow.
- Run and inspect real model executions; no successful live suite results were established in the previous session.
- Run the v1 baseline on at least 10 emails, improve based on evidence, and run all 25 through final v2.
- Review the drafts and ticket behavior manually; fill the actual results in `TEST_REPORT.md`.
- Capture real screenshots and the recording.
- Create your own submission GitHub repository and upload the sanitized deliverables.

During this handover check, n8n was listening on `127.0.0.1:5678` and its `/healthz` endpoint returned `{"status":"ok"}`. Both workflows and both credential entries were present in the local database; both workflows had `active = 0`, so production webhook execution still needs activation/publication. No saved suite-response files were found. Credential contents were not read or decrypted. Recent server logs included a DNS failure contacting `api.n8n.io` for n8n's MCP registry; a healthy local endpoint does not verify external integrations. No restart or integration changes were performed for this documentation request.

## 5. How the workflow works

```text
Incoming Email webhook
  -> Normalize Email
  -> Classify Email with Gemini
  -> Validate JSON
       -> if invalid: Repair Classification -> validate or safe fallback
  -> Prepare Case: identity, policy and risk checks
  -> Needs Reply Draft?
       -> yes: Support Agent chooses get_order / search_faq
       -> no: log-only route
  -> Guard Draft
  -> Read Open Tickets
  -> Plan Ticket
       -> if needed: create/update ticket
  -> Audit Row -> Write Audit Log
  -> Return Result to the test runner
```

- `order_status`: get the verified order and draft status/tracking information.
- `product_query`: answer from `data/faq.md`, otherwise require a human.
- `return_refund`: check policy, create/update a ticket and draft a response.
- `complaint`: create/update a High-priority ticket and draft a response.
- `other`: log without a customer reply. Unsupported service requests can still require human triage.

Privacy is checked in code before the order tool returns data. A spouse or another sender cannot retrieve the purchaser's tracking/address. The agent cannot select a different sender identity. Tools are read-only.

Return timing uses the email's `received_at`, not today's computer date. Standard returns use the 7-day/unopened rule; damaged/wrong/missing items use a separate 48-hour rule. Delivery data has dates but no exact times, so uncertain boundary cases require human verification. Attachment filenames are not treated as verified photographs.

Classification confidence below 0.85 triggers human review. Returns, complaints and other risk flags can require review even at high confidence. All responses remain drafts.

## 6. File map

All paths in this table are relative to the project root.

| File/folder | Purpose |
|---|---|
| `PROJECT_HANDOVER.md` | This guide; start here after a chat interruption |
| `README.md` | Draft submission README; still contains pending items |
| `TEST_REPORT.md` | Report generated from real saved responses; currently incomplete |
| `workflow/kesar-support-v1.json` | Baseline workflow export |
| `workflow/kesar-support-v2.json` | Final-version candidate workflow export |
| `code/core.cjs` | Shared privacy, validation, date-policy and ticket logic |
| `prompts/classifier-v1.md` | Initial classifier prompt |
| `prompts/classifier-v2.md` | More detailed classifier prompt |
| `prompts/agent.md` | Drafting agent instructions |
| `scripts/build-workflows.cjs` | Builds both workflow JSON files from code, data and prompts |
| `scripts/start-n8n.ps1` | Starts this local n8n installation with the correct data folder |
| `scripts/run-suite.py` | Sends actual test emails to a published webhook and saves responses |
| `scripts/build-report.cjs` | Builds the initial report from saved execution responses |
| `tests/safety.test.cjs` | Safety and business-rule regression tests |
| `tests/workflow.test.cjs` | Export structure and embedded JavaScript checks |
| `tests/expectations.json` | Expected intent/action for each supplied email |
| `data/` | Original fictional orders, FAQ, brand voice and 25 test emails |
| `templates/` | Original submission templates and exact Google Sheet headers |
| `docs/ASSIGNMENT.md` | Original assignment README preserved before editing |
| `docs/CONNECTIONS.md` | Detailed account/integration setup |
| `docs/DEMO_SCRIPT.md` | Suggested five-minute demonstration outline |
| `screenshots/` | Destination for real screenshots; not fabricated images |
| `test-results/v1/`, `test-results/v2/` | Actual responses saved by the test runner after real runs |
| `.local/` | Private local state and support files; never upload this folder |
| `.runtime/` | Installed n8n and dependencies; do not upload |

## 7. Start, stop and check n8n

### Normal interactive start — easiest to understand

```powershell
Set-Location -LiteralPath 'C:\Users\sumit\Documents\Projects\Codex Projects\kesar-support-copilot'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-n8n.ps1
```

Keep this terminal open. To stop this foreground instance, press **Ctrl+C** in that same terminal and allow it to shut down.

This is not installed as a Windows startup service. After a reboot, start it again. Your saved workflows and credentials should remain in `.local\.n8n`.

### Check whether something is already using port 5678

```powershell
Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

To check HTTP health separately:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5678/healthz' -TimeoutSec 10
```

A successful response should show status `ok`. If the port is occupied but the browser/health check hangs, inspect the logs and identify the process before restarting it.

### Optional background start — the method I used

Only run this when n8n is not already running:

```powershell
Set-Location -LiteralPath 'C:\Users\sumit\Documents\Projects\Codex Projects\kesar-support-copilot'
$projectDirectory = (Get-Location).Path
$n8nLauncher = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File scripts/start-n8n.ps1' `
    -WorkingDirectory $projectDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $projectDirectory 'n8n-server.log') `
    -RedirectStandardError (Join-Path $projectDirectory 'n8n-server-error.log') `
    -PassThru
$n8nLauncher.Id
```

The printed ID is the PowerShell launcher; the listening Node process can have a different ID. Do not rely on an old process ID after a restart.

Read logs:

```powershell
Get-Content -LiteralPath .\n8n-server.log -Tail 60
Get-Content -LiteralPath .\n8n-server-error.log -Tail 60
```

To stop a background instance, first identify the listener:

```powershell
$n8nListener = Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue
$n8nProcessId = $n8nListener | Select-Object -First 1 -ExpandProperty OwningProcess
if ($n8nProcessId) {
    Get-CimInstance Win32_Process -Filter "ProcessId = $n8nProcessId" |
        Select-Object ProcessId, Name, CommandLine
}
```

Check that the displayed command line points to **this project's** `.runtime\node_modules\n8n\bin\n8n`. Then, when no workflow is running, stop only that verified process:

```powershell
Stop-Process -Id $n8nProcessId
```

This terminates the process; it is less graceful than Ctrl+C. Prefer the foreground method for future work. Do not stop all Node processes or delete the database to fix a port conflict.

## 8. Commands used to set up the project

These are for understanding/recovery. **Do not clone or reinstall again just to start the existing app.**

Original clone and branch:

```powershell
Set-Location -LiteralPath 'C:\Users\sumit\Documents\Projects\Codex Projects'
git clone https://github.com/abhishek-patel-cadient/kesar-ai-copilot-assignment.git kesar-support-copilot
Set-Location -LiteralPath .\kesar-support-copilot
git switch -c codex/kesar-support-copilot
```

Version checks and local installation:

```powershell
node --version
npm.cmd --version
python --version
npm.cmd view n8n version engines --json
npm.cmd install --prefix .runtime n8n@2.49.5 --no-audit --no-fund
node .\.runtime\node_modules\n8n\bin\n8n --version
```

The actual install output was redirected to `n8n-install.log`:

```powershell
npm.cmd install --prefix .runtime n8n@2.49.5 --no-audit --no-fund > n8n-install.log 2>&1
```

Build and code tests:

```powershell
npm.cmd run build
npm.cmd test
```

CLI import into this n8n data directory:

```powershell
$env:N8N_USER_FOLDER = Join-Path (Get-Location).Path '.local'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
node .\.runtime\node_modules\n8n\bin\n8n import:workflow --separate --input=workflow
```

The workflows have stable IDs so this import can update existing copies. **Reimporting can overwrite changes you made in the n8n editor. Export/back up your current work first.** It may also require republishing and refreshing the editor.

I also imported empty credential placeholders from `.local\credential-placeholders.json` using `import:credentials`. **Do not repeat that command now that you have entered your real API key:** it could replace saved credential data with blanks. You should edit credentials through the n8n UI from this point.

## 9. Finish the Gemini connection

1. In n8n, open **Overview → Credentials → Kesar Gemini**.
2. Host should be `https://generativelanguage.googleapis.com`.
3. You said the API key has been entered. Ensure it is saved and use the credential connection test/Retry control.
4. A successful credential test proves authentication, not that the full agent works. Run one real email after Sheets setup too.
5. Both workflows reference this credential on **Classification Model**, **Repair Model** and **Drafting Model**.

The generated exports currently specify `models/gemini-3.5-flash-lite`, temperature 0. This configured name has not been verified with your account. If the API/model selector rejects it, select a model actually offered to your account that supports function/tool calling, and use the same chosen name in the generator/settings. Do not assume that the Google consumer subscription supplies API quota; the API project's own quota applies.

Keep the API key in n8n credentials. Do not paste it into the repository, Markdown files, screenshots or this chat.

## 10. Finish Google Sheets setup

### Create the sheet

Create a spreadsheet named **Kesar Support**. It must have these two tabs and exact header names:

- **Audit Log**: import `templates/audit_log_template.csv`.
- **Tickets**: import `templates/tickets_template.csv`.

In Google Sheets, use **File → Import → Upload**, choose the CSV and insert it as a new sheet, then rename the tab. A temporary blank Sheet1 can be removed after the required tabs exist. Keep the required headers on row 1, with no title row above them.

No completed Sheet link was established in the previous session. If you already created it yourself, reuse it rather than making another copy.

### Connect the local n8n instance

The Google Cloud browser tab previously stopped at its first-use terms screen, followed by a possible two-step-verification requirement. You must review/complete those account steps yourself.

Then:

1. In Google Cloud Console, select the project associated with your Gemini API setup, or another project you control for this integration.
2. Enable **Google Sheets API** and **Google Drive API**.
3. Configure the OAuth consent screen / Google Auth Platform. For a personal account use an External app in Testing, and add the Google email you will connect as a test user.
4. Create an OAuth client of type **Web application**.
5. Open **Kesar Google Sheets** in n8n and copy its displayed OAuth redirect URL into the client's authorized redirect URIs. Expected local URL: `http://localhost:5678/rest/oauth2-credential/callback`. Use the exact value n8n displays.
6. Enter the OAuth **Client ID** and **Client Secret** into the n8n credential. These are different from the Gemini API key.
7. Use n8n's **Sign in with Google** control and authorize the connection to the Google account that owns the spreadsheet. Verify that it connects.
8. In each workflow, use **Kesar Google Sheets** on **Read Open Tickets**, **Upsert Ticket** and **Write Audit Log**.
9. Set the same spreadsheet ID on all three nodes. It is the part between `/d/` and `/edit` in the Sheet URL.

Menu labels can vary; `docs/CONNECTIONS.md` covers the same connection requirements. If you encounter an account/security verification screen, complete it through the official account flow rather than disabling protection.

## 11. Configure, rebuild and import without losing edits

There are two copies of a workflow: the **JSON file on disk** and the **saved workflow in n8n's database**. Editing one does not automatically update the other.

The generator reads the source prompts/code/data and writes both JSON exports. It does not preserve arbitrary edits made only in the UI. Choose one authoritative editing method for a change and export/back up before switching methods.

To set the Sheet ID and model when generating exports:

```powershell
$env:KESAR_SHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE'
$env:KESAR_MODEL = 'models/YOUR_VERIFIED_MODEL_NAME'
npm.cmd run build
npm.cmd test
```

Replace both placeholders with real non-secret identifiers. These environment values last only in the current PowerShell session. If you later run the generator without them, it will return to its default model and placeholder Sheet ID.

Import the updated files using the CLI command in section 8 or n8n's Import from File command. Refresh the editor, check credentials and settings, and publish the intended workflow. Do not run the empty credential import again.

## 12. Run actual tests

Keep n8n running in one terminal; use a **second PowerShell window** for these commands. Set its working directory to the project root first.

### A. Local code checks

```powershell
npm.cmd test
```

These do not call Gemini or Google Sheets and cannot establish end-to-end success.

### B. Small real smoke test

Publish v1 in n8n, then run:

```powershell
python .\scripts\run-suite.py --url http://localhost:5678/webhook/kesar-support-v1 --version v1 --only E01
```

Check the n8n execution, the agent tool call and the resulting audit row. Fix failures before running the larger suite.

### C. Required v1 baseline — 10 emails

```powershell
python .\scripts\run-suite.py --url http://localhost:5678/webhook/kesar-support-v1 --version v1
```

The default v1 subset is E01, E03, E04, E07, E08, E09, E10, E12, E18 and E21. The runner sends them sequentially and saves responses in `test-results/v1/`. Preserve this evidence before improving the workflow. If rerunning baseline results, back up that folder first because an email's JSON file is overwritten by a later run.

### D. Required final v2 — all 25 emails

After reviewing the baseline and making justified improvements, publish v2 and run:

```powershell
python .\scripts\run-suite.py --url http://localhost:5678/webhook/kesar-support-v2 --version v2
```

Actual responses are saved in `test-results/v2/`. The shared audit sheet upserts by email ID, so the final v2 runs replace those baseline audit rows; baseline response files preserve the earlier evidence. Ticket notes can retain the history of both runs. Document this when explaining the test setup.

For a slower run when quota limits require it:

```powershell
python .\scripts\run-suite.py --url http://localhost:5678/webhook/kesar-support-v2 --version v2 --delay 20
```

Retry a specific failed email after fixing its cause:

```powershell
python .\scripts\run-suite.py --url http://localhost:5678/webhook/kesar-support-v2 --version v2 --only E04
```

Do not run multiple suite scripts in parallel. This demo relies on serial execution for Google Sheets ticket deduplication.

The `/webhook/` addresses require published/active workflows. They are different from n8n's temporary `/webhook-test/` addresses, which require clicking the test listener in the editor.

### E. Build and review the test report

```powershell
node .\scripts\build-report.cjs
```

This reads saved real responses. It records intent agreement but leaves action correctness for manual review. **It overwrites `TEST_REPORT.md`; back up any manual annotations before rerunning it.** Missing responses must remain NOT RUN rather than being counted as passes.

Review all replies using `tests/expectations.json`. Pay special attention to E07 privacy, E12 prompt injection, E20 medical claims, E04/E21 ticket reuse, E19 COD fees and E22 missing order. Also check malformed-JSON fallback, failed tool calls and rate limits in the n8n execution details.

## 13. Troubleshooting

| Problem | What to check |
|---|---|
| Browser cannot open localhost | Start with the supplied script; check the terminal, port listener and logs |
| Address already in use | Another process owns port 5678; identify it before stopping anything |
| n8n asks for a new owner unexpectedly | You may have started with a different user-data folder; stop and use this project's start script |
| Gemini credential fails | Key saved correctly, host correct, key belongs to the intended API project |
| Model not found / unsupported | Choose an actually available tool-capable model and update all model nodes |
| API 429 / quota exhausted | Check the API project's quota, increase delay, and wait for reset if needed; don't assume repeated retries create quota |
| Google OAuth redirect mismatch | Copy the exact redirect URL displayed in n8n into the OAuth Web client |
| Google denies test-user access | Add the connecting Google account to the OAuth app's test users |
| Google token expires | Reconnect the Google Sheets credential through its sign-in control |
| Sheet not found / permission denied | Correct spreadsheet ID, correct owning/shared Google account, correct Sheets credential |
| Missing columns or tabs | Exact names Audit Log/Tickets, exact CSV headers on row 1 |
| Webhook returns 404 | Correct v1/v2 path, published workflow, production URL instead of a test URL |
| Runner reports no expected audit row | Inspect the failed n8n node; the successful response should come from Return Result after the audit write |
| Generic human-handoff draft | Inspect audit notes and agent execution; missing tools, invalid output or risk flags may have triggered fallback |
| Duplicate tickets | Check parallel executions, sender/order matching and open-ticket rows; do not delete evidence without understanding the cause |
| `api.n8n.io` DNS error | Check network/DNS. A template/registry background failure is separate from Gemini/Sheets API connectivity; verify each integration independently |

## 14. Protect and back up your work

The Git repository excludes `.local/`, `.runtime/`, logs, `.env` files and `test-results/`. **Git alone is not a backup of your n8n database or your live test evidence.**

Back up the whole project folder privately when n8n is stopped, including `.local\.n8n` and `test-results`. Keep the database and its encryption configuration together; copying only the SQLite file can make saved credentials unusable. If SQLite WAL files are present, a stopped-instance backup of the full directory avoids an inconsistent partial copy.

Do not upload `.local`, encryption configuration, credential exports, API keys or client secrets to GitHub. Ordinary workflow exports should contain credential references rather than their secret values, but inspect the export before publishing. Keep private backups separate from submission files.

## 15. How I will complete the project with you

1. Confirm Gemini connection and one usable model response.
2. Finish the Google Sheet and Google OAuth connection.
3. Configure the Sheet ID and verify a small real workflow run.
4. Run and preserve the 10-email v1 baseline.
5. Diagnose actual failures; update prompts/code and record why the changes were made.
6. Run final v2 on all 25 emails and inspect every draft, escalation and ticket.
7. Fill the real test report and replace README placeholders with measured results, actual model and links.
8. Capture `screenshots/workflow.png`, `screenshots/tickets.png` and `screenshots/audit_log.png` from the real running system.
9. Help you record the five-minute walkthrough using `docs/DEMO_SCRIPT.md`. You need to understand and narrate the work for the live interview.
10. Export final workflows, check for secrets, and prepare your own GitHub submission repository. The current Git remote is the assignment's source repository; it is not your personal submission destination.
11. Add the repository, recording and view-only Sheet links to the submission package. You send the final application email unless you explicitly authorize sending it for you.

Completion means working integrations plus real evidence, not just generated JSON. If a part still fails near the deadline, document it honestly as the assignment requests.

## 16. Resume in a new chat

Copy this message into a new chat if this one reaches a limit:

> Continue my Kesar AI internship assignment. The project is at `C:\Users\sumit\Documents\Projects\Codex Projects\kesar-support-copilot`. First read `PROJECT_HANDOVER.md`, then inspect current files and the live n8n state. n8n is installed locally under `.runtime`, not globally, and uses `.local\.n8n` for private data. Start it with `scripts/start-n8n.ps1` only if it is not running. Two workflows and credential entries were imported. I reported entering the Gemini API key, but live validation and Google Sheets setup may still be pending. Do not recreate accounts, overwrite entered credentials with empty placeholders, or claim that unrun tests passed. Finish the integrations, run v1 on at least 10 emails and v2 on all 25, review results, and prepare the required submission evidence. Ask me only for account actions or information you cannot complete yourself.

Before resuming, the next assistant should check actual state rather than treating this dated handover as proof that every step remains unchanged.
