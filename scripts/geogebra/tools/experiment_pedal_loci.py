"""Experimental exact derivation on fixed triangles, never edits production data."""
import argparse
import json
from pathlib import Path
import sympy as s
from generate_related_curves import parse_equation, a, b, c, a2, b2, c2, u, v, w

x,y=s.symbols('x y')
def dot(v,w): return v[0]*w[0]+v[1]*w[1]
def sub(v,w): return (v[0]-w[0],v[1]-w[1])
def intersect(n1,k1,n2,k2):
    det=n1[0]*n2[1]-n1[1]*n2[0]
    return (s.cancel((k1*n2[1]-n1[1]*k2)/det),s.cancel((n1[0]*k2-k1*n2[0])/det))
def orthocenter(t):
    a,b,c=t; n1=sub(c,b); n2=sub(a,c)
    return intersect(n1,dot(n1,a),n2,dot(n2,b))
def pedal(P,t):
    out=[]
    for i in range(3):
        b,c=t[(i+1)%3],t[(i+2)%3]; d=sub(c,b); f=dot(sub(P,b),d)/dot(d,d)
        out.append(tuple(s.cancel(b[j]+f*d[j]) for j in range(2)))
    return out
def antipedal(P,t):
    lines=[(sub(P,v),dot(sub(P,v),v)) for v in t]
    return [intersect(*lines[(i+1)%3],*lines[(i+2)%3]) for i in range(3)]
def ninepoint(t,h): return tuple(s.cancel((h[j]+sum(q[j] for q in t))/4) for j in range(2))
def col(P,Q,R): return s.factor(s.together((Q[0]-P[0])*(R[1]-P[1])-(Q[1]-P[1])*(R[0]-P[0])))
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('candidates',type=Path); ap.add_argument('--generic',action='store_true'); args=ap.parse_args()
    records={r['id']:r for r in json.loads(args.candidates.read_text(encoding='utf8'))['candidates']}
    t,h=s.symbols('t h', nonzero=True)
    cases=[((1,0),(t,h))] if args.generic else [((6,0),(2,4)),((5,0),(1,3)),((7,0),(2,5))]
    for B,C in cases:
        tri=[(s.Integer(0),s.Integer(0)),tuple(map(s.sympify,B)),tuple(map(s.sympify,C))]; P=(x,y)
        sq=[dot(sub(tri[(i+1)%3],tri[(i+2)%3]),sub(tri[(i+1)%3],tri[(i+2)%3])) for i in range(3)]
        pd=pedal(P,tri); ad=antipedal(P,tri); hp=orthocenter(pd); ha=orthocenter(ad)
        print('triangle',tri,flush=True)
        for id,q,r in [('Q018',hp,ha),('Q020',ninepoint(pd,hp),ninepoint(ad,ha))]:
            compact=(q[0]-x)*(r[1]-y)-(q[1]-y)*(r[0]-x)
            num,den=s.fraction(s.factor(s.together(compact))); source=parse_equation(records[id]['equation'])
            frame=[(tri[(i+1)%3][1]-tri[(i+2)%3][1])*x+(tri[(i+2)%3][0]-tri[(i+1)%3][0])*y+tri[(i+1)%3][0]*tri[(i+2)%3][1]-tri[(i+1)%3][1]*tri[(i+2)%3][0] for i in range(3)]
            target=s.factor(source.subs(dict(zip((a2,b2,c2),sq))).subs(dict(zip((a,b,c),map(s.sqrt,sq)))).subs(dict(zip((u,v,w),frame))))
            ratio=s.factor(s.cancel(num/target))
            if ratio.has(x,y) or ratio == 0: raise AssertionError(f'{id}: equations differ')
            print(id,'numerator degree:',s.Poly(num,x,y).total_degree(), 'denominator:',s.factor(den),'ratio to source:',ratio,
                  'compact ops:',s.count_ops(compact),'expanded numerator ops:',s.count_ops(s.expand(num)),flush=True)
if __name__=='__main__': main()
