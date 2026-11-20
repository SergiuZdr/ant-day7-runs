#!/bin/bash
# Called by es2.js on a new best (cloud). Uploads the replay and net to the c2-results branch.
# needs GH_TOKEN, GITHUB_REPOSITORY, RUN_TAG; gets BEST_FILE NET_FILE SCORE from es2.js
set -u
dir="results/${RUN_TAG}"
for f in "$BEST_FILE" "$NET_FILE"; do
  name="$(basename "$f" .json)"
  path="$dir/${SCORE}-${name%%-*}-job${JOB}.json"
  base64 -w0 "$f" > /tmp/up.b64
  for i in 1 2 3 4 5; do
    printf '{"message":"%s %s","branch":"c2-results","content":"%s"}' "$RUN_TAG job$JOB" "$SCORE" "$(cat /tmp/up.b64)" > /tmp/up.json
    gh api -X PUT "repos/$GITHUB_REPOSITORY/contents/$path" --input /tmp/up.json > /dev/null && break
    sleep $((i*7))
  done
done
echo "pushed $SCORE"
