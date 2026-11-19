#!/bin/sh
# end-of-day-7 training queue: seed start-state bot O cfg ; two at a time
run(){ s=$1; st=$2; bot=$3; o=$4; cfg=$5; d=e-$s; mkdir -p $d
  OBJ=end START=$st BOT=$bot O=$o PATIENCE=40 TARGET=260 node es7.js $s $cfg $d 6 24 0.05 > $d/out.log 2>&1
  echo "$(date +%H:%M) $s done $(tail -1 $d/out.log)" >> endq.log; }
( run 4189463 h3/state.json nnbot9.js 21 cfgh-4189463.json; run 55917 p3/state.json nnbot5.js 18 cfg200.json; run 698845 pipe/nn-698845/state.json nnbot5.js 18 pipe/nn-698845/cfg.json ) &
( run 98162 m98/state.json nnbot5.js 18 cfg98.json; run 1986983 pipe/nn-1986983/state.json nnbot5.js 18 pipe/nn-1986983/cfg.json ) &
wait; echo "$(date +%H:%M) ALL DONE" >> endq.log
