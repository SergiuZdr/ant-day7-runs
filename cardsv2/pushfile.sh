#!/bin/bash
# pushfile.sh LOCAL REMOTE_PATH MESSAGE : create or replace a file on the c2-results branch (cloud)
set -u
f="$1"; path="$2"; msg="$3"
for i in 1 2 3 4 5; do
  sha=$(gh api "repos/$GITHUB_REPOSITORY/contents/$path?ref=c2-results" --jq .sha 2>/dev/null || true)
  python3 - "$f" "$msg" "$sha" > /tmp/pf.json <<'PY'
import base64,json,sys
d={"message":sys.argv[2],"branch":"c2-results","content":base64.b64encode(open(sys.argv[1],'rb').read()).decode()}
if sys.argv[3]: d["sha"]=sys.argv[3]
print(json.dumps(d))
PY
  gh api -X PUT "repos/$GITHUB_REPOSITORY/contents/$path" --input /tmp/pf.json > /dev/null && exit 0
  sleep $((i*7))
done
exit 1
