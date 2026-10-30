"""Generate opt-in similarity-frame polynomial circuits, without world expansion.

The primary equations remain in curves.json. Only records explicitly selecting
the similarityPolynomial backend are written here. No downloads or interpolation.
"""
import argparse
import json
from pathlib import Path
import sympy as s
from generate_related_curves import SOURCE, CUSTOM, parse_equation, a2,b2,c2,u,v,w

OUTPUT = CUSTOM / 'generated/relatedCurveCircuits.json'
x,y,t,h=s.symbols('x y t h')


def generate_circuit(record):
    source=parse_equation(record['equation'])
    side_degrees={sum(m) for m in s.Poly(source,a2,b2,c2).monoms()}
    if len(side_degrees)!=1 or source.free_symbols-{a2,b2,c2,u,v,w}:
        raise ValueError(f'{record["id"]}: requires homogeneous side-square coefficients')
    normalized=s.Poly(source.subs({a2:(t-1)**2+h*h,b2:t*t+h*h,c2:1}).subs(
        {u:h*(1-x)+(t-1)*y,v:h*x-t*y,w:y}),x,y,t,h)
    height_power=min(m[3] for m in normalized.monoms())
    polynomial=s.Poly(s.cancel(normalized.as_expr()/h**height_power),x,y)
    if polynomial.total_degree()!=record['degree']:
        raise ValueError(f'{record["id"]}: unexpected normalized degree')
    # Only produce local coefficients. Rotation/scale and translation use
    # separate shared numeric stages at runtime, never a giant substitution.
    basis=[(i,n-i) for n in range(record['degree']+1) for i in range(n+1)]
    nodes,outputs=s.cse([s.factor(polynomial.coeff_monomial(m)) for m in basis],symbols=s.numbered_symbols('r'))
    inline={};scalars=[]
    render=lambda expr:s.sstr(expr).replace('**','^')
    for name,value in nodes:
        value=value.xreplace(inline)
        if len(scalars)>=80:
            inline[name]=value
        else:
            scalars.append([str(name),render(value)])
    coefficients=[render(z.xreplace(inline)) for z in outputs]
    return {'degree':record['degree'],'removedHeightPower':height_power,
            'sideDegree':side_degrees.pop(),'scalars':scalars,'coefficients':coefficients}


def generate(records):
    return json.dumps({r['id']:generate_circuit(r) for r in records
                      if r.get('backend')=='similarityPolynomial'},indent=2)+'\n'


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--check',action='store_true');args=ap.parse_args()
    result=generate(json.loads(SOURCE.read_text(encoding='utf8')))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf8')!=result:
            raise SystemExit('Normalized circuits are stale; run generate_related_curve_circuits.py')
        print('Normalized circuits are up to date.')
    else:
        OUTPUT.write_text(result,encoding='utf8');print(f'Generated {OUTPUT}')
