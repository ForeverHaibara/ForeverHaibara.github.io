"""Exact geometric checks for H3, Q013, Q077 and Q078; no runtime CAS."""
import json
import sympy as s
from generate_related_curves import SOURCE,parse_equation,a2,b2,c2,u,v,w

def cross(a,b):return s.Matrix(a).cross(s.Matrix(b))
def derive_q013():
    S=u+v+w;d=(b2+c2-a2)/2
    G=s.Matrix([[c2,d],[d,b2]])
    vertices=[s.Matrix([0,0]),s.Matrix([1,0]),s.Matrix([0,1])]
    M=s.Matrix([v,w]);traces=[]
    for i,A in enumerate(vertices):
        n=M-S*A
        line=[s.expand(S*(n.T*G*X)[0]-(n.T*G*M)[0]) for X in vertices]
        side=[int(i==j) for j in range(3)]
        traces.append(cross(side,line))
    L=cross(traces[0],traces[1])
    assert s.expand(L.dot(traces[2]))==0
    O=G.inv()*s.Matrix([c2/2,b2/2])
    F=s.factor((v-S*O[0])*(L[1]-L[0])+(w-S*O[1])*(L[2]-L[0]))
    numerator=s.fraction(F)[0]
    factors=s.factor_list(numerator)[1]
    linear=[f for f,k in factors if s.Poly(f,u,v,w).total_degree()==1]
    assert len(linear)==1 and not s.cancel(linear[0]/S).free_symbols & {u,v,w}
    target=[f for f,k in factors if s.Poly(f,u,v,w).total_degree()==4]
    assert len(target)==1
    print('Q013 cleared factors:',[(s.Poly(f,u,v,w).total_degree(),k) for f,k in factors],flush=True)
    return s.expand(target[0])

def check(records):
    by_id={r['id']:parse_equation(r['equation']) for r in records}
    derived=derive_q013()
    assert not s.cancel(derived/by_id['Q013']).free_symbols & {u,v,w}
    x,y,k=s.symbols('x y k')
    for T,H in [(s.Rational(1,3),s.Rational(4,5)),(s.Rational(2,5),s.Rational(7,6)),(s.Rational(1,2),s.Rational(3,4))]:
        A=s.Matrix([0,0]);B=s.Matrix([1,0]);C=s.Matrix([T,H]);tri=[A,B,C]
        sides={a2:(T-1)**2+H**2,b2:T*T+H*H,c2:1}
        O=s.Matrix([s.Rational(1,2),(T*T+H*H-T)/(2*H)])
        def value(id,P):
            bary=[(tri[(i+1)%3]-P).row_join(tri[(i+2)%3]-P).det() for i in range(3)]
            return s.factor(by_id[id].subs(sides).subs(dict(zip((u,v,w),bary))))
        F=s.Matrix([(1+2*O[1]*k)/(1+k*k),k*(1+2*O[1]*k)/(1+k*k)])
        feet=[]
        for i in range(3):
            U,V=tri[(i+1)%3],tri[(i+2)%3];D=V-U
            feet.append(s.simplify(U+D*((F-U).dot(D)/D.dot(D))))
        line=cross([*feet[0],1],[*feet[1],1]).applyfunc(s.factor)
        contact=cross(line,line.diff(k)).applyfunc(s.factor)
        projection=s.simplify(F-s.Matrix(line[:2])*(line.dot(s.Matrix([*F,1])))/(line[0]**2+line[1]**2))
        for K in [s.Rational(-2),s.Rational(-1,2),s.Rational(1,3),s.Rational(2),s.Rational(3)]:
            E=contact.subs(k,K)
            assert E[2]!=0 and value('Q000',s.Matrix([E[0]/E[2],E[1]/E[2]]))==0
            assert value('Q078',projection.subs(k,K))==0
        for N in [s.Matrix([s.Rational(3,5),s.Rational(4,5)]),s.Matrix([s.Rational(5,13),s.Rational(-12,13)]),s.Matrix([s.Rational(8,17),s.Rational(15,17)])]:
            tangent=s.Matrix([-N[1],N[0]])
            K=s.Matrix([[B[0],B[1]],[C[0],C[1]]]).inv()*s.Matrix([tangent.dot(B)**2/2,tangent.dot(C)**2/2])
            assert N.dot(K)!=0
            offset=-K.dot(K)/(2*N.dot(K));focus=offset*N+K
            assert all(s.factor((X-focus).dot(X-focus)-(N.dot(X)-offset)**2)==0 for X in tri)
            assert value('Q077',focus)==0
        world=s.Poly(by_id['Q013'].subs(sides).subs({u:H*(1-x)+(T-1)*y,v:H*x-T*y,w:y}),x,y)
        radius=O.dot(O);rho=x*x+y*y
        inverse=s.factor(s.together(world.as_expr().subs({x:O[0]+radius*x/rho,y:O[1]+radius*y/rho},simultaneous=True)))
        assert s.Poly(s.fraction(s.cancel(inverse))[0],x,y).total_degree()==5
        assert value('Q013',O)==0
    print('H3 envelope contacts; Q078 Simson projections; Q077 circumparabola foci; Q013 definition and degree-five inverse checks passed.',flush=True)

if __name__=='__main__':check(json.loads(SOURCE.read_text(encoding='utf8')))
