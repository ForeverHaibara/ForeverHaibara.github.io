"""Compare normalized polynomial forms; optionally export pedal-proof inputs.

Reads only the maintained database. No downloads or production file writes.
"""
import argparse
import json
from pathlib import Path
import sympy as s
from generate_related_curves import SOURCE, parse_equation, a2,b2,c2,u,v,w

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--candidates', type=Path, help='Optional JSON input for experiment_pedal_loci.py')
args = parser.parse_args()
x,y,t,h=s.symbols('x y t h')
records=[r for r in json.loads(SOURCE.read_text(encoding='utf8')) if r['id'] in ('Q018','Q020')]
for record in records:
    f=parse_equation(record['equation'])
    f=s.Poly(f.subs({a2:(t-1)**2+h*h,b2:t*t+h*h,c2:1}).subs({u:h*(1-x)+(t-1)*y,v:h*x-t*y,w:y}),x,y,t,h)
    hp=min(m[3] for m in f.monoms())
    f=s.cancel(f.as_expr()/h**hp).expand()
    print(record['id'],'common h power',hp,'ops',s.count_ops(f),flush=True)
    for method in ['expanded','horner']:
        body=f if method=='expanded' else s.horner(f,x,y,t,h)
        nodes,output=s.cse(body,symbols=s.numbered_symbols('r'))
        functional={x,y}; scalar_count=0
        for symbol,value in nodes:
            if value.free_symbols & functional: functional.add(symbol)
            else: scalar_count+=1
        print(method,'nodes',len(nodes),'scalar',scalar_count,'chars',sum(len(str(z)) for _,z in nodes)+len(str(output[0])),flush=True)
if args.candidates:
    args.candidates.write_text(json.dumps({'candidates':records},indent=2)+'\n',encoding='utf8')
