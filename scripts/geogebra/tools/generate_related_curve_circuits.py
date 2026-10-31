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
    # Compose sparse polynomials in stages. Expanding source sides and all
    # barycentric powers in one expression repeats huge distributive products
    # (especially degree 9/10), even when the final local polynomial is small.
    side_degree=next(iter(side_degrees))
    a_powers=[s.Poly((t-1)**2+h*h,t,h)**n for n in range(side_degree+1)]
    b_powers=[s.Poly(t*t+h*h,t,h)**n for n in range(side_degree+1)]
    domain=s.QQ.poly_ring(t,h)
    frame=[s.Poly(h*(1-x)+(t-1)*y,x,y,domain=domain),
           s.Poly(h*x-t*y,x,y,domain=domain),s.Poly(y,x,y,domain=domain)]
    powers=[[p**n for n in range(record['degree']+1)] for p in frame]
    local=s.Poly(0,x,y,domain=domain)
    for monomial,coefficient in s.Poly(source,u,v,w).terms():
        side=s.Poly(0,t,h)
        for (i,j,_),constant in s.Poly(coefficient,a2,b2,c2).terms():
            side+=(a_powers[i]*b_powers[j]).mul_ground(constant)
        local+=(powers[0][monomial[0]]*powers[1][monomial[1]]*powers[2][monomial[2]]).mul_ground(side.as_expr())
    normalized=s.Poly(local.as_expr(),x,y,t,h)
    height_power=min(m[3] for m in normalized.monoms())
    reduced=s.Poly.from_dict({m[:3]+(m[3]-height_power,):c for m,c in normalized.terms()},(x,y,t,h))
    polynomial=s.Poly(reduced.as_expr(),x,y)
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


def generate(records,report=None):
    circuits={}
    for record in records:
        if record.get('backend')!='similarityPolynomial': continue
        if record['id'] in circuits: raise ValueError(f'Duplicate ID: {record["id"]}')
        circuits[record['id']]=generate_circuit(record)
        if report: report(f'{record["id"]}: degree {record["degree"]}, {len(circuits[record["id"]]["scalars"])} scalar nodes',flush=True)
    return json.dumps(circuits,indent=2)+'\n'


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check',action='store_true')
    ap.add_argument('--source',type=Path,default=SOURCE,help='Reviewed records, or an offline candidate queue')
    ap.add_argument('--output',type=Path,default=OUTPUT)
    args=ap.parse_args()
    records=json.loads(args.source.read_text(encoding='utf8'))
    if isinstance(records,dict): records=records['candidates']
    result=generate(records,print)
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding='utf8')!=result:
            raise SystemExit('Normalized circuits are stale; run generate_related_curve_circuits.py')
        print('Normalized circuits are up to date.')
    else:
        args.output.write_text(result,encoding='utf8');print(f'Generated {args.output}')
