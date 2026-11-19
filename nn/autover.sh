#!/bin/sh
# verify each new best replay of h2 and save it; exit when training stops and all are verified
D=/Users/Sergiu/Developer/AntArchitect/saves/v125/nn/s3601327; last=222
while :; do
  n=$(ls h2 | sed -n 's/^s3601327-nn5-b\([0-9]*\)\.json$/\1/p' | sort -n | tail -1)
  if [ "$n" -gt "$last" ]; then
    r=$(FROM=55000 STEP=150 node verify.js h2/s3601327-nn5-b$n.json 2>&1 | tail -1)
    b=$(echo "$r" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print(d["best"], d["bt"])' 2>/dev/null)
    echo "$(date +%H:%M) b$n verify: $b" >> autover.log
    set -- $b
    if [ "$1" = "$n" ]; then cp h2/s3601327-nn5-b$n.json $D/s3601327-nn-b$n-peak$2.json; cp h2/pol-b$n.json $D/; fi
    last=$n; continue
  fi
  kill -0 $(cat h2/pid) 2>/dev/null || break
  sleep 60
done
echo "$(date +%H:%M) done, training stopped" >> autover.log
