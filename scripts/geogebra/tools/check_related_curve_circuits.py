"""Exact checks of opt-in circuits against their primary equations."""
import ast
import argparse
import json
from pathlib import Path
import sympy as s
from generate_related_curves import SOURCE, CUSTOM, parse_equation, a2,b2,c2,u,v,w
from generate_related_curve_circuits import x,y,t,h


def arithmetic(text,values):
    def visit(node):
        if isinstance(node,ast.Constant) and type(node.value) is int: return s.Integer(node.value)
        if isinstance(node,ast.Name) and node.id in values: return values[node.id]
        if isinstance(node,ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            return visit(node.operand)*(-1 if isinstance(node.op,ast.USub) else 1)
        if isinstance(node,ast.BinOp):
            l,r=visit(node.left),visit(node.right)
            if isinstance(node.op,ast.Add):return l+r
            if isinstance(node.op,ast.Sub):return l-r
            if isinstance(node.op,ast.Mult):return l*r
            if isinstance(node.op,ast.Div) and r.is_number and r!=0:return l/r
            if isinstance(node.op,ast.Pow) and r.is_Integer and 0<=r<=40:return l**r
        raise ValueError(f'Unsupported circuit expression {ast.dump(node)}')
    return visit(ast.parse(text.replace('^','**'),mode='eval').body)


def check(source_file=SOURCE,circuit_file=CUSTOM/'generated/relatedCurveCircuits.json'):
    circuits=json.loads(circuit_file.read_text(encoding='utf8'))
    records=json.loads(source_file.read_text(encoding='utf8'))
    if isinstance(records,dict): records=records['candidates']
    records={r['id']:r for r in records}
    for identifier,circuit in circuits.items():
        values={'t':t,'h':h,'x':x,'y':y}
        for name,expression in circuit['scalars']:
            value=arithmetic(expression,values)
            assert not value.free_symbols & {x,y},f'{identifier}: numeric node depends on curve coordinates'
            values[name]=value
        basis=[(i,n-i) for n in range(circuit['degree']+1) for i in range(n+1)]
        coefficients=[arithmetic(z,values) for z in circuit['coefficients']]
        assert len(coefficients)==len(basis),f'{identifier}: incorrect coefficient count'
        actual=s.Poly(sum(z*x**i*y**j for z,(i,j) in zip(coefficients,basis)),x,y)
        source=parse_equation(records[identifier]['equation'])
        # Independently invert the chart instead of repeating the generator's
        # forward composition. Homogenize L((v+t*w)/S,h*w/S), S=u+v+w.
        # Equality h^height*L_hom = h^degree*F(normalized sides;u,v,w)
        # proves the entire polynomial, including its boundary points.
        degree=circuit['degree'];domain=s.QQ.poly_ring(t,h)
        inverse=[s.Poly(v+t*w,u,v,w,domain=domain),s.Poly(h*w,u,v,w,domain=domain),
                 s.Poly(u+v+w,u,v,w,domain=domain)]
        powers=[[p**n for n in range(degree+1)] for p in inverse]
        restored=s.Poly(0,u,v,w,domain=domain)
        for (i,j),coefficient in actual.terms():
            restored+=(powers[0][i]*powers[1][j]*powers[2][degree-i-j]).mul_ground(coefficient)
        expected=s.Poly(source.subs({a2:(t-1)**2+h*h,b2:t*t+h*h,c2:1}),u,v,w,domain=domain)
        assert restored.mul_ground(h**circuit['removedHeightPower'])==expected.mul_ground(h**degree)
        assert actual.total_degree()==records[identifier]['degree']
        for index,shape in enumerate([(s.Rational(1,3),s.Rational(2,3)),(s.Rational(1,2),s.Rational(4,5)),(s.Rational(1,3),-s.Rational(2,3)),(s.Rational(1,2),s.sqrt(3)/2)]):
            zero=all(s.simplify(z.subs({t:shape[0],h:shape[1]}))==0 for z in actual.coeffs())
            source_zero=s.Poly(expected.as_expr().subs({t:shape[0],h:shape[1]}),u,v,w).is_zero
            assert zero==source_zero, f'{identifier}: coefficient guard disagrees with specialized source'
            if index==0: assert not zero, f'{identifier}: zero generic polynomial'
        # Direct primary equations on non-axis-aligned and transformed triangles.
        for triangle in [[(0,0),(6,0),(1,4)],[(2,-1),(5,3),(-1,5)],[(10,9),(4,1),(16,-3)]]:
            A,B,C=[tuple(map(s.Integer,p)) for p in triangle]
            dx,dy=B[0]-A[0],B[1]-A[1];sq=dx*dx+dy*dy
            T=((C[0]-A[0])*dx+(C[1]-A[1])*dy)/sq
            H=((C[1]-A[1])*dx-(C[0]-A[0])*dy)/sq
            sides=[sum((triangle[(i+1)%3][j]-triangle[(i+2)%3][j])**2 for j in range(2)) for i in range(3)]
            for X,Y in [(2,1),(-1,3),(4,-2)]:
                U=((X-A[0])*dx+(Y-A[1])*dy)/sq;V=((Y-A[1])*dx-(X-A[0])*dy)/sq
                bary=[(triangle[(i+1)%3][1]-triangle[(i+2)%3][1])*X+(triangle[(i+2)%3][0]-triangle[(i+1)%3][0])*Y+triangle[(i+1)%3][0]*triangle[(i+2)%3][1]-triangle[(i+1)%3][1]*triangle[(i+2)%3][0] for i in range(3)]
                original=source.subs(dict(zip((a2,b2,c2),sides))).subs(dict(zip((u,v,w),bary)))
                normalized=actual.as_expr().subs({t:T,h:H,x:U,y:V})
                assert s.cancel(original-normalized*sq**(circuit['degree']+circuit['sideDegree'])*H**circuit['removedHeightPower'])==0
        print(f'{identifier}: full polynomial identity, numeric-node independence, guard, specializations and world frame passed',flush=True)


def native_fixtures():
    """Reference values use primary equations and exact rationals, not circuits.

    Expanded double-precision sources suffer cancellation near flat triangles;
    they cannot serve as an independent native-engine oracle there.
    """
    shapes = [
        ('rotated', [(2,-1),(5,3),(-1,5)]),
        ('reflected', [(0,0),(6,0),(1,-4)]),
        ('translated-scaled', [(10,-7),(13,-7),('10.5',-5)]),
        ('near-isosceles', [(0,0),(6,0),('3.000001',4)]),
        ('near-collinear', [(0,0),(6,0),(2,'0.05')]),
    ]
    result = {}
    records=json.loads(SOURCE.read_text(encoding='utf8'))
    deferred=SOURCE.with_name('deferred.json')
    if deferred.exists(): records+=json.loads(deferred.read_text(encoding='utf8'))
    for record in records:
        if record.get('backend')!='similarityPolynomial':
            continue
        source = parse_equation(record['equation'])
        cases = []
        for name, vertices in shapes:
            vertices = [tuple(s.Rational(z) for z in point) for point in vertices]
            A,B,C = vertices
            dx,dy = B[0]-A[0],B[1]-A[1]
            sq = dx*dx+dy*dy
            T = (dx*(C[0]-A[0])+dy*(C[1]-A[1]))/sq
            H = (dx*(C[1]-A[1])-dy*(C[0]-A[0]))/sq
            circle = (T*T+H*H-T)/H
            local = [(s.Rational(u),s.Rational(v)) for u,v in [
                ('-.2','.4'),('.4','.3'),('.9','-.3'),('1.2','.6'),
                ('.25',0),('.25','.000001'),(1,circle),(1,circle+s.Rational(1,1000000))]]
            points = [(A[0]+dx*u-dy*v,A[1]+dy*u+dx*v) for u,v in local]
            sides = [sum((vertices[(i+1)%3][j]-vertices[(i+2)%3][j])**2 for j in range(2)) for i in range(3)]
            polynomial = s.Poly(source.subs(dict(zip((a2,b2,c2),sides))),u,v,w)
            expected = []
            for X,Y in points+vertices:
                bary = [(vertices[(i+1)%3][1]-vertices[(i+2)%3][1])*X
                        +(vertices[(i+2)%3][0]-vertices[(i+1)%3][0])*Y
                        +vertices[(i+1)%3][0]*vertices[(i+2)%3][1]
                        -vertices[(i+1)%3][1]*vertices[(i+2)%3][0] for i in range(3)]
                expected.append(polynomial.eval(dict(zip((u,v,w),bary))))
            scale = max(map(abs,expected[:4]))
            cases.append({'name':name,'vertices':[[float(z) for z in p] for p in vertices],
                          'points':[[float(z) for z in p] for p in points],
                          'expected':[float(z/scale) for z in expected[:len(points)]],
                          'vertexExpected':[float(z/scale) for z in expected[len(points):]]})
        result[record['id']] = cases
    return json.dumps(result,indent=2)+'\n'


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-native-fixtures',action='store_true')
    parser.add_argument('--check-native-fixtures',action='store_true')
    parser.add_argument('--source',type=Path,default=SOURCE,help='Reviewed records or offline candidate queue for circuit checks')
    parser.add_argument('--circuits',type=Path,default=CUSTOM/'generated/relatedCurveCircuits.json')
    args = parser.parse_args()
    if args.write_native_fixtures or args.check_native_fixtures:
        output = Path(__file__).resolve().parents[1]/'browser/fixtures/gibert-pedal.json'
        text = native_fixtures()
        if args.check_native_fixtures:
            assert output.read_text(encoding='utf8')==text,'Native reference fixtures are stale'
            print('Exact native reference fixtures are up to date.')
        else:
            output.parent.mkdir(parents=True,exist_ok=True)
            output.write_text(text,encoding='utf8')
            print(f'Wrote exact native reference fixtures to {output}')
    else:
        check(args.source,args.circuits)
