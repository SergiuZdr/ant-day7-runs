#!/usr/bin/env python3
# Map pipeline: every scanned seed that matches the map filter is screened with the plain bot (12 cfgs).
# Promising ones (screen >= PROM) get a 48-cfg tuning pass, then neural training (es5, per-day knob + placement
# nets) until 30 generations pass without a gain. Any training score >= 220 is re-simulated with verify.js.
# Results: pipe/results.jsonl (one line per seed, appended as each stage finishes). Ends when the scan is done
# and no untested matching seed is left.
import json, os, random, subprocess, time, glob
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
SCAN = os.path.join(HERE, '..', 'scan')
PAR = int(os.environ.get('PAR', '10')); PROM = int(os.environ.get('PROM', '165'))
os.makedirs('pipe', exist_ok=True); RES = 'pipe/results.jsonl'
def log(**k):
    k['t'] = time.strftime('%H:%M:%S'); open(RES, 'a').write(json.dumps(k) + '\n'); print(json.dumps(k), flush=True)
def done_seeds():
    s = set()
    if os.path.exists(RES):
        for l in open(RES):
            r = json.loads(l)
            if r.get('stage') in ('screen-fail', 'final'): s.add(r['seed'])
    return s
def rows():
    R = []
    for f in glob.glob(os.path.join(SCAN, 'out-*.csv')):
        for l in open(f):
            if l.strip(): R.append(list(map(int, l.split(','))))
    return R
# columns: seed,tanIn,brownIn,tan25,tan35,brown16,brown25,seedsIn,seeds25,cFeeder,cFeederFood
match = lambda r: r[2] >= 29 and r[1] >= 5 and r[6] >= 40 and r[9] <= 9
rank = lambda r: r[6] + r[2] + 2 * r[1] + r[8] - 2 * r[9]
scan_done = lambda: os.path.exists(os.path.join(SCAN, 'FINISHED'))
# already handled before the pipeline started
PRE = {55917: 'record map, NN 219', 98162: 'tuned 186, NN 213', 75370: 'tuned 202, NN 205', 10348: 'tuned 176',
  **{k: 'screened before' for k in [143245,186577,28536,168933,140038,56234,137328,99190,77692,172220,92508,56873,206175,44219,249235,234047,387631,10173,327349]}}

def run_cfgs(seed, cfgs, tag):
    f = f'pipe/{seed}-{tag}.txt'; o = f'pipe/{seed}-{tag}.jsonl'
    open(f, 'w').write('\n'.join(json.dumps(c) for c in cfgs) + '\n')
    if os.path.exists(o): os.remove(o)
    subprocess.run(['node', 'run.js', 'bot22.js', str(seed), f, o, str(PAR)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    R = [json.loads(l) for l in open(o)] if os.path.exists(o) else []
    return max(R, key=lambda r: r['best']) if R else None, len(R)

O = {'lcEarly': [0.6, 0.7, 0.8], 'lcShare': [0.2, 0.25, 0.3], 'dSwitch': [3, 4, 5], 'houseSlack': [2, 3, 4], 'farmPer': [4, 5, 6, 7], 'maxPend': [2, 3], 'hr': [7, 8, 10], 'digMax': [2, 3, 4], 'lc0': [2, 3],
     'feeders': [3, 6, 9], 'pheroAt': [0, 15000, 22500, 30000], 'seedPar': [0, 1, 2], 'f1At': [0, 9000, 14250], 'f1Leaf': [0, 10], 'pheroN': [0, 2, 3, 4], 'seedDiggers': [3, 4, 6], 'seedCover': [0, 8], 'hard': [0, 1], 'tanStore': [0, 1]}
def tune_cfgs(base, seed):
    rnd = random.Random(seed); L = [base, dict(base, hr=7)]
    for _ in range(46):
        c = dict(base)
        for k in rnd.sample(list(O), rnd.randint(1, 4)): c[k] = rnd.choice(O[k])
        if 'pheroAt' in c: c['pheroSeedAt'] = c['pheroAt']
        L.append(c)
    return L

def train(seed, cfg):
    d = f'pipe/nn-{seed}'; os.makedirs(d, exist_ok=True); json.dump(cfg, open(d + '/cfg.json', 'w'))
    env = dict(os.environ, FROM='z98.json', PATIENCE='30', TARGET='260')
    with open(d + '/out.log', 'a') as fo:
        subprocess.run(['node', 'es5.js', str(seed), d + '/cfg.json', d, str(PAR), '24', '0.05'], env=env, stdout=fo, stderr=subprocess.STDOUT)
    st = json.load(open(d + '/state.json')) if os.path.exists(d + '/state.json') else {}
    return st.get('best', 0), st.get('gen', 0), d

def verify(seed, d, best):
    f = f'{d}/s{seed}-nn5-b{best}.json'
    if not os.path.exists(f): return None
    r = subprocess.run(['node', 'verify.js', f], env=dict(os.environ, FROM='45000', STEP='150'), capture_output=True, text=True)
    try: return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: return {'err': r.stdout[-300:] + r.stderr[-300:]}

base = json.load(open('cfg200.json'))
SCREEN = [json.loads(l) for l in open('seedcfg12.txt')]
while True:
    done = done_seeds() | set(PRE)
    cand = sorted([r for r in rows() if match(r) and r[0] not in done], key=lambda r: -rank(r))
    if not cand:
        if scan_done(): log(stage='end', msg='no seeds left'); break
        time.sleep(300); continue
    r = cand[0]; seed = r[0]
    log(stage='start', seed=seed, map=r, left=len(cand) - 1)
    b, n = run_cfgs(seed, SCREEN, 'screen')
    sb = b['best'] if b else 0
    if sb < PROM: log(stage='screen-fail', seed=seed, screen=sb, games=n); continue
    log(stage='screen-ok', seed=seed, screen=sb)
    tb, n = run_cfgs(seed, tune_cfgs(b['cfg'], seed), 'tune')
    cfg = tb['cfg'] if tb and tb['best'] > sb else b['cfg']; tuned = max(sb, tb['best'] if tb else 0)
    log(stage='tuned', seed=seed, tuned=tuned, cfg=cfg)
    nb, gens, d = train(seed, cfg)
    v = verify(seed, d, nb) if nb >= 220 else None
    log(stage='final', seed=seed, map=r, screen=sb, tuned=tuned, nn=nb, gens=gens, verified=v)
