#!/bin/sh
# verify every new best replay from L1 (late) and C1 (cma) at tick 63000 and copy it to saves
best=220; D=/Users/Sergiu/Developer/AntArchitect/saves/v125/nn/end
while kill -0 $(cat L2/pid) 2>/dev/null || kill -0 $(cat C1/pid) 2>/dev/null; do
  for f in L1/s55917-late-b*.json L2/s55917-late-b*.json C1/s55917-cma-b*.json; do [ -f "$f" ] || continue
    n=$(echo $f | sed 's/.*-b\([0-9]*\)\.json/\1/'); [ "$n" -gt "$best" ] || continue
    r=$(node verifyend.js $f 55917 | grep -o '"end":[0-9]*' | cut -d: -f2)
    echo "$(date +%H:%M) $f claimed $n verified $r"
    if [ "$r" = "$n" ]; then cp $f $D/s55917-end$n.json; best=$n; echo "VERIFIED $n $f"; fi
  done; sleep 60; done; echo "searches ended, best $best"
