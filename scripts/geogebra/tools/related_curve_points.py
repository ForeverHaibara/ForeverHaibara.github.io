"""Exact barycentrics for a few finite triangle centers in generic triangles."""
import sympy as s


def centers(a, b, c):
    aa, bb, cc = a*a, b*b, c*c
    sa = s.Rational(bb+cc-aa, 2)
    sb = s.Rational(cc+aa-bb, 2)
    sc = s.Rational(aa+bb-cc, 2)
    o = (aa*sa, bb*sb, cc*sc)
    h = (sb*sc, sc*sa, sa*sb)
    # Affine midpoint (nine-point center) and 2O-H (de Longchamps),
    # expressed without dividing by the homogeneous coordinate sums.
    nine = tuple(o[i]*sum(h) + h[i]*sum(o) for i in range(3))
    longchamps = tuple(2*o[i]*sum(h) - h[i]*sum(o) for i in range(3))
    gergonne = ((a+c-b)*(a+b-c), (a+b-c)*(b+c-a), (b+c-a)*(a+c-b))
    nagel = (b+c-a, c+a-b, a+b-c)
    # ETC X(80): reciprocals of b²+c²-a²-bc and its cyclic permutations.
    # https://faculty.evansville.edu/ck6/encyclopedia/part1.html#X80
    d = (bb+cc-aa-b*c, cc+aa-bb-c*a, aa+bb-cc-a*b)
    x80 = (d[1]*d[2], d[2]*d[0], d[0]*d[1])
    # X(11) is the midpoint of X(1) and X(80); X(59) is its isogonal conjugate.
    eleven = tuple((a,b,c)[i]*sum(x80)+x80[i]*(a+b+c) for i in range(3))
    x59 = tuple((aa,bb,cc)[i]*eleven[(i+1)%3]*eleven[(i+2)%3] for i in range(3))
    return {1:(a,b,c), 2:(1,1,1), 3:o, 4:h, 5:nine, 6:(aa,bb,cc),
            7:gergonne, 8:nagel, 20:longchamps, 59:x59, 80:x80}
