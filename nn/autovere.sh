#!/bin/sh
# verify every new best end-of-day-7 score in the e-* runs above $best and save it; exit when the queue ends
D=/Users/Sergiu/Developer/AntArchitect/saves/v125/nn/end; best=217
while :; do
  for d in e-*; do s=${d#e-}
    n=$(ls $d | sed -n "s/^s$s-nn5-b\([0-9]*\)\.json\$/\1/p" | sort -n | tail -1)
    [ -z "$n" ] && continue
    if [ "$n" -gt "$best" ]; then
      e=$(node verifyend.js $d/s$s-nn5-b$n.json $s 2>&1 | tail -1 | python3 -c 'import sys,json; print(json.loads(sys.stdin.read())["end"])' 2>/dev/null)
      echo "$(date +%H:%M) $s b$n end-verify: $e" >> autovere.log
      if [ "$e" = "$n" ]; then cp $d/s$s-nn5-b$n.json $D/s$s-end$n.json; best=$n; fi
    fi
  done
  kill -0 $(cat endq.pid) 2>/dev/null || break
  sleep 90
done
echo "$(date +%H:%M) queue done, best $best" >> autovere.log
