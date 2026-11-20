#!/bin/bash
# Called by es2.js after every generation (cloud): keeps results/<run>/progress-job<J>.txt up to date.
set -u
echo "$LINE" >> /tmp/progress.txt
path="results/${RUN_TAG}/progress-job${JOB}.txt"
for i in 1 2 3; do
  sha=$(gh api "repos/$GITHUB_REPOSITORY/contents/$path?ref=c2-results" --jq .sha 2>/dev/null || true)
  python3 - "$sha" > /tmp/prog.json <<'PY'
import base64,json,sys,os
d={"message":os.environ["RUN_TAG"]+" job"+os.environ["JOB"]+" progress","branch":"c2-results","content":base64.b64encode(open('/tmp/progress.txt','rb').read()).decode()}
if sys.argv[1]: d["sha"]=sys.argv[1]
print(json.dumps(d))
PY
  gh api -X PUT "repos/$GITHUB_REPOSITORY/contents/$path" --input /tmp/prog.json > /dev/null && break
  sleep $((i*5))
done
