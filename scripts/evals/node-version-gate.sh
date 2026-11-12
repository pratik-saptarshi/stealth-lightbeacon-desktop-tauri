#!/usr/bin/env bash
# Eval gate: repository must be on the latest security-patched Node 26.x runtime.
set -euo pipefail
TARGET="26.13.1"
FLOOR=">=26.13.1 <27"
fail=0

err() { echo "FAIL: $*" >&2; fail=1; }
ok() { echo "ok: $*"; }

[ -f .nvmrc ] && [ "$(tr -d '[:space:]' < .nvmrc)" = "$TARGET" ] && ok ".nvmrc=$TARGET" || err ".nvmrc must be $TARGET"
[ -f .node-version ] && [ "$(tr -d '[:space:]' < .node-version)" = "$TARGET" ] && ok ".node-version=$TARGET" || err ".node-version must be $TARGET"

python3 - "$FLOOR" <<'PY' || fail=1
import json, sys
floor = sys.argv[1]
eng = (json.load(open("package.json")).get("engines") or {}).get("node", "")
if floor in eng:
    print(f"ok: engines.node={eng}")
else:
    print(f"FAIL: engines.node must contain {floor!r}, got {eng!r}", file=sys.stderr)
    sys.exit(1)
PY

python3 - "$TARGET" <<'PY' || fail=1
import glob, re, sys
target = sys.argv[1]
major = int(target.split(".")[0])
bad = []
for path in glob.glob(".github/workflows/*.yml") + glob.glob(".github/workflows/*.yaml"):
    text = open(path).read()
    if "setup-node" not in text:
        continue
    versions = []
    for m in re.finditer(r"node-version:\s*(?:\[([^\]]+)\]|['\"]?([0-9]+(?:\.x)?(?:\.[0-9]+)*)['\"]?)", text):
        raw = m.group(1) or m.group(2)
        versions += [v.strip() for v in raw.split(",")]
    if not versions:
        bad.append(f"{path}: no node-version found")
        continue
    for v in versions:
        if int(v.split(".")[0]) < major:
            bad.append(f"{path}: node-version {v} < {target}")
if bad:
    print("FAIL: " + "; ".join(bad), file=sys.stderr)
    sys.exit(1)
print("ok: GitHub workflows pin Node >= " + target)
PY

if [ "$fail" -ne 0 ]; then
  echo "GATE: FAILED" >&2
  exit 1
fi
echo "GATE: PASSED ($TARGET)"
