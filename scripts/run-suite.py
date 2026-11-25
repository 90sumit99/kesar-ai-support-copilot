"""Run real n8n executions sequentially and preserve actual responses, never simulated LLM results."""
import argparse
import json
from pathlib import Path
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True, help='Published n8n webhook URL')
parser.add_argument('--version', choices=['v1', 'v2'], required=True)
parser.add_argument('--delay', type=float, default=8)
parser.add_argument('--only', default='')
args = parser.parse_args()
emails = json.loads((ROOT / 'data/test_emails.json').read_text(encoding='utf-8'))['emails']
baseline = {'E01','E03','E04','E07','E08','E09','E10','E12','E18','E21'}
selected = set(args.only.split(',')) if args.only else baseline if args.version == 'v1' else {e['id'] for e in emails}
destination = ROOT / 'test-results' / args.version
destination.mkdir(parents=True, exist_ok=True)
failures = 0
for email in emails:
    if email['id'] not in selected:
        continue
    request = urllib.request.Request(args.url, data=json.dumps(email).encode('utf-8'), headers={'Content-Type':'application/json'}, method='POST')
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            result = json.loads(response.read().decode('utf-8'))
        if result.get('email_id') != email['id']:
            raise ValueError('Webhook did not return the expected audit row. Check that the workflow is published and uses Respond to Webhook.')
        result['_elapsed_seconds'] = round(time.monotonic() - started, 2)
        (destination / f"{email['id']}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"{email['id']}: {result['intent']} | {result['action_taken']} | {result['_elapsed_seconds']}s", flush=True)
    except (urllib.error.URLError, ValueError, TimeoutError) as exc:
        failures += 1
        print(f"{email['id']}: FAILED ({type(exc).__name__}). Inspect the n8n execution, fix the error, then rerun with --only {email['id']}.", flush=True)
    time.sleep(args.delay)
raise SystemExit(1 if failures else 0)
