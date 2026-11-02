"""Independent constructions for source conflicts exposed by fresh snapshots."""
import math
import re
from unittest import TestCase

import triangle_center_import as m
from triangle_center_import import (Recipe, Ideal, read_recipes, numeric_formula,
    numeric_formula_projective, numeric_conjugate, normalize_formula, side_environment, evaluate_formula)
from triangle_center_sources import prepare_source
from triangle_center_support import heading_issues


def sub(p, q):
    return p[0]-q[0], p[1]-q[1]


def cross(p, q):
    return p[0]*q[1]-p[1]*q[0]


def barycentrics(point,abc):
    return [cross(sub(abc[(j+1)%3],point),sub(abc[(j+2)%3],point)) for j in range(3)]


def weighted_point(weights,abc):
    return tuple(sum(weights[j]*abc[j][i] for j in range(3))/sum(weights) for i in (0,1))


def reviewed_bc_formula(number):
    source=(m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8',errors='replace')
    text='\n'.join(m.coordinate_text(dict(m.split_entries(source))[number]))
    raw=re.search(r'Barycentrics\s+(.*?)\s*:\s*:',text,re.S)[1]
    fixed=raw.replace('a b c','b c')
    if number==38494:
        fixed=fixed.replace('b c(b+c-2a)','a b c(b+c-2a)')
    return m.normalize_formula(fixed)


def vijay_triangles(abc):
    P,V,T=[],[],[]
    for j in range(3):
        tri=[abc[(j+k)%3] for k in range(3)]
        a,b,c=[math.dist(tri[(i+1)%3],tri[(i+2)%3]) for i in range(3)]
        R=m.side_environment(a,b,c)['R']
        Ab=weighted_point([0,4*R+c,c],tri);Ac=weighted_point([0,b,4*R+b],tri)
        Bc=weighted_point([a,0,4*R+a],tri);Ba=weighted_point([4*R+c,0,c],tri)
        Ca=weighted_point([4*R+b,b,0],tri);Cb=weighted_point([a,4*R+a,0],tri)
        oldCb=weighted_point([a,2*R,0],tri);oldBc=weighted_point([a,0,2*R],tri)
        P.append(m.numeric_intersection([Ca,Bc,Cb,Ba]))
        V.append(m.numeric_intersection([Ac,Bc,Ab,Cb]))
        T.append(m.numeric_intersection([Ba,oldCb,Ca,oldBc]))
    return P,V,T


def vu_pair_geometry(abc,P,U):
    P1,U1=[m.numeric_conjugate(point,abc,True) for point in (P,U)]
    vertices=[]
    for A in abc:
        first=m.numeric_circle_center([A,P,U]);second=m.numeric_circle_center([A,P1,U1])
        d=(-(second[1]-first[1]),second[0]-first[0])
        t=-2*sum(d[i]*(A[i]-first[i]) for i in (0,1))/sum(value*value for value in d)
        vertices.append(tuple(A[i]+t*d[i] for i in (0,1)))
    target=m.numeric_intersection([abc[0],vertices[0],abc[1],vertices[1]])
    p,d=m.line_data(abc[2],vertices[2])
    error=abs(cross(d,sub(target,p)))/math.hypot(*d)
    return target,error


def vietnamese_geometry(abc,P,U,kind):
    triangles=[]
    for point in (P,U):
        weights=barycentrics(point,abc);vertices=[]
        for j in range(3):
            w=list(weights);w[j]=0 if kind=='cevian' else -w[j]
            vertices.append(weighted_point(w,abc))
        triangles.append(vertices)
    first,second=triangles
    connectors=[(first[j],second[j]) for j in range(3)]
    vertex=[m.numeric_intersection([*connectors[(j+1)%3],*connectors[(j+2)%3]]) for j in range(3)]
    axes=[];circles=[]
    for j in range(3):
        pair=[]
        for tri in triangles:
            triplet=[vertex[j],tri[(j+1)%3],tri[(j+2)%3]]
            center=m.numeric_circle_center(triplet)
            pair.append((center,math.dist(center,triplet[0])**2))
        (c,r),(d,s)=pair;normal=tuple(2*(d[i]-c[i]) for i in (0,1))
        constant=sum(v*v for v in d)-s-sum(v*v for v in c)+r
        base=tuple(constant*v/sum(x*x for x in normal) for v in normal)
        axes.append((base,(base[0]-normal[1],base[1]+normal[0])))
        circles.append(pair)
    target=m.numeric_intersection([*axes[0],*axes[1]])
    if target is None:
        return None,None
    (c,r),(d,s)=circles[2]
    error=abs((math.dist(target,c)**2-r)-(math.dist(target,d)**2-s))
    return target,error


def crossing(p, q, r, s):
    d, e = sub(q, p), sub(s, r)
    t = cross(sub(r, p), e)/cross(d, e)
    return p[0]+t*d[0], p[1]+t*d[1]


def auriga_triangles(abc):
    """ETC X(5597) vertex formulas; first is selected by the stated half-plane."""
    sides = [math.dist(abc[1], abc[2]), math.dist(abc[2], abc[0]), math.dist(abc[0], abc[1])]
    env = m.side_environment(*sides)
    S = env['S']
    D = math.sqrt(env['r']*env['R']+4*env['R']**2)
    result = []
    for sign in [-1, 1]:
        vertices = []
        for j in range(3):
            a, b, c = [sides[(j+k) % 3] for k in range(3)]
            weights = [a**4-a*a*(b+c)**2+sign*4*(b+c)*S*D,
                       b**4-b*b*(c+a)**2-sign*4*b*S*D,
                       c**4-c*c*(a+b)**2-sign*4*c*S*D]
            vertices.append(tuple(sum(weights[k]*abc[(j+k) % 3][i] for k in range(3))/sum(weights)
                                  for i in (0, 1)))
        result.append(vertices)
    if cross(sub(abc[2], abc[1]), sub(result[0][0], abc[1])) * cross(
            sub(abc[2], abc[1]), sub(abc[0], abc[1])) < 0:
        result.reverse()
    return result


class ReviewedSourceConflictTest(TestCase):
    def test_auriga_named_centers_and_grebe_trilinears(self):
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        records = {n: r for path in (m.DATA/'chunks').glob('*.txt') for n, r in m.read_recipes(path).items()}
        records.update(m.read_recipes(m.DATA/'seeds.txt', {}))
        points = m.numeric_coordinates(records, atlas, m.read_native_status(m.DATA/'native-status.txt')[1])
        for shape, abc in atlas['triangles'].items():
            abc = list(map(tuple, abc))
            anti = [tuple(sum(p[i] for p in abc)-2*abc[j][i] for i in (0, 1)) for j in range(3)]
            for k, triangle in enumerate(auriga_triangles(abc)):
                perspector = crossing(anti[0], triangle[0], anti[1], triangle[1])
                third = sub(triangle[2], anti[2])
                self.assertLess(abs(cross(sub(perspector, anti[2]), third)), 1e-8)
                a, b, c = triangle
                v, w = sub(c, b), sub(c, a)
                orthocenter = crossing(a, (a[0]-v[1], a[1]+v[0]), b, (b[0]-w[1], b[1]+w[0]))
                self.assertLess(math.dist(points[shape][5601+k], perspector), 1e-8)
                self.assertLess(math.dist(points[shape][9834+k], orthocenter), 1e-8)
            for number, formula in [(7581, 'a*(cos(A)-4*sin(A)-cos(B-C))'),
                                    (7582, 'a*(cos(A)+4*sin(A)-cos(B-C))')]:
                printed = m.numeric_formula(m.Recipe(number, 'B', (), formula=formula), abc)
                self.assertLess(math.dist(points[shape][number], printed), 1e-8)


class OtherReviewedSourceErrors(TestCase):
    def test_32072_lucas_inner_vertex_matrix_centroid(self):
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[32072]
        for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],[(2,-3),(10,-1),(3,4)]]:
            env=m.side_environment(*[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)])
            sides=[env[k] for k in ('a','b','c')];conway=[env[k] for k in ('SA','SB','SC')]
            # MathWorld's trilinear vertex matrix, converted row by row to
            # barycentrics, then ordinary Cartesian centroid (not a raw sum).
            vertices=[weighted_point([sides[j]**2*(4*conway[j]+(3 if i==j else 2)*env['S'])
                                      for j in range(3)],abc) for i in range(3)]
            centroid=tuple(sum(p[i] for p in vertices)/3 for i in (0,1))
            self.assertLess(math.dist(m.numeric_formula(recipe,abc),centroid),1e-9)

    def test_39038_five_point_cartesian_conic_center(self):
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[39038]
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        points=m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for shape,abc in atlas['triangles'].items():
            inputs=[points[shape][ref] for ref in recipe.references]
            rows=[[x*x,x*y,y*y,x,y,1.] for x,y in [*abc,*inputs]]
            pivots=[]
            for col in range(6):
                start=len(pivots)
                if start==5: break
                k=max(range(start,5),key=lambda k:abs(rows[k][col]))
                if abs(rows[k][col])<1e-10: continue
                rows[start],rows[k]=rows[k],rows[start]
                divisor=rows[start][col];rows[start]=[v/divisor for v in rows[start]]
                for k in range(5):
                    if k!=start:
                        factor=rows[k][col];rows[k]=[v-factor*w for v,w in zip(rows[k],rows[start])]
                pivots.append(col)
            self.assertEqual(len(pivots),5)
            free=next(i for i in range(6) if i not in pivots)
            coeff=[0.]*6;coeff[free]=1.
            for i,col in enumerate(pivots): coeff[col]=-rows[i][free]
            A,B,C,D,E,_=coeff;det=4*A*C-B*B
            self.assertLess(det,0)  # The named conic really is a hyperbola.
            center=((B*E-2*C*D)/det,(B*D-2*A*E)/det)
            actual=m.numeric_transform_formula(recipe,inputs,abc)
            self.assertLess(math.dist(actual,center),1e-8)

    def test_7065_named_extra_triangle_confirms_retained_coordinate(self):
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[7065]
        for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],[(2,-3),(10,-1),(3,4)]]:
            sides=[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)]
            extra=[]
            for k in range(3):
                values=[-side if i==k else side for i,side in enumerate(sides)]
                weights=[]
                for i in range(3):
                    a,b,c=[values[(i+j)%3] for j in range(3)]
                    # X(107) has barycentric u=1/((b²-c²)(b²+c²-a²)²).
                    # Brisse transform, then the kth side extraversion.
                    u=1/((b*b-c*c)*(b*b+c*c-a*a)**2)
                    weights.append(a**4/((b+c-a)*u*u))
                extra.append(weighted_point(weights,abc))
            point=m.numeric_intersection([abc[0],extra[0],abc[1],extra[1]])
            self.assertLess(abs(cross(sub(point,abc[2]),sub(extra[2],abc[2]))),1e-8)
            self.assertLess(math.dist(m.numeric_formula(recipe,abc),point),1e-8)

    def test_reviewed_ideal_formulas_and_available_directions(self):
        numbers = {14988:8,19923:10,20403:11,30207:16,40327:21,46183:24,
                   53806:27,54028:28,54029:28,62503:32,70832:36,70855:36}
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        directions=m.read_native_status(m.DATA/'native-status.txt')[1]
        points=m.numeric_coordinates({},atlas,directions)
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        pages={part:dict(m.split_entries(m.prepare_source(part,
            (m.CACHE/'sources'/f'ETCPart{part}.html').read_text(encoding='utf-8')))) for part in set(numbers.values())}
        for n,part in numbers.items():
            fragment=pages[part][n]
            formulas=m.coordinate_candidates(fragment)
            self.assertTrue(formulas,n)
            for _,formula,_ in formulas:
                for shape,abc in atlas['triangles'].items():
                    ideal=m.numeric_formula_projective(Recipe(n,'B',(),formula=formula),abc)
                    self.assertIsInstance(ideal,Ideal,(n,formula,shape))
                    if n in seeds and seeds[n].references:
                        p,q=[points[shape][ref] for ref in seeds[n].references]
                        d=sub(q,p)
                        self.assertLess(abs(cross(d,(ideal.dx,ideal.dy)))/(math.hypot(*d)*math.hypot(ideal.dx,ideal.dy)),1e-7)
            if n in (70832,70855):
                recipes=m.extract_entry(n,fragment,part)
                expected=(244,1365) if n==70832 else (1,46403)
                self.assertIn(('I',expected),[(r.operation,r.references) for r in recipes])

    def test_steiner_major_vertices_and_curvature_centers(self):
        source = (m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8')
        entries = dict(m.split_entries(source))
        numbers = [39202,39203,39206,39207,39300,39301,39304,39305]
        recipes = {n: next(r for r in m.extract_entry(n,entries[n],20)
                           if r.operation=='F' and r.references[0]==2) for n in numbers}
        focus_recipes = {n: next(r for r in m.extract_entry(n,entries[n],20)
                                if r.operation=='B') for n in (39158,39159)}
        triangles = [[(0,0),(6,0),(1,4)], [(0,0),(6,0),(-1,2)],
                     [(2,-3),(10,-1),(3,4)], [(0,0),(4,0),(2,3.47)]]
        for abc in triangles:
            G = tuple(sum(p[i] for p in abc)/3 for i in (0,1))
            # Independent Cartesian covariance, no side-length radical formula.
            q = [[2/3*sum((p[i]-G[i])*(p[j]-G[j]) for p in abc)
                  for j in (0,1)] for i in (0,1)]
            gap = math.hypot(q[0][0]-q[1][1],2*q[0][1])
            major = (q[0][0]+q[1][1]+gap)/2
            minor = (q[0][0]+q[1][1]-gap)/2
            foci = {n: m.numeric_formula(r,abc) for n,r in focus_recipes.items()}
            for n, recipe in recipes.items():
                with self.subTest(triangle=abc,number=n):
                    focus = foci[recipe.references[1]]
                    v = sub(focus,G)
                    self.assertAlmostEqual(sum(x*x for x in v),gap,places=8)
                    self.assertLess(math.hypot(*(sum(q[i][j]*v[j] for j in (0,1))-major*v[i]
                                                for i in (0,1))),1e-8)
                    point = m.numeric_combo(recipe,[G,focus],abc)
                    offset = sub(point,G)
                    scale = .5 if n in (39206,39207,39304,39305) else 1
                    distance = math.sqrt(major) if n<39300 else gap/math.sqrt(major)
                    self.assertAlmostEqual(math.hypot(*offset),scale*distance,delta=1e-7)
                    self.assertGreater(sum(offset[i]*v[i] for i in (0,1)),0)
                    # Center of curvature: vertex minus inward normal * b^2/a.
                    if n>=39300:
                        vertex = tuple(G[i]+scale*math.sqrt(major/gap)*v[i] for i in (0,1))
                        expected = tuple(vertex[i]-scale*minor/math.sqrt(major*gap)*v[i] for i in (0,1))
                        self.assertLess(math.dist(point,expected),1e-8)
            # Both original preambles share a zero-sum base vector, so their
            # root multipliers fix the same branch as the original foci.
            for n in (39158,39202,39300):
                text = '\n'.join(m.coordinate_text(entries[n]))
                raw = re.search(r'Barycentrics\s+(.+?)(?: : :|\n)',text)[1]
                raw = raw.replace('J^2','(9-(a^2+b^2+c^2)/R^2)')
                printed = m.numeric_formula(Recipe(n,'B',(),formula=m.normalize_formula(raw)),abc)
                expected = foci[n] if n==39158 else m.numeric_combo(recipes[n],[G,foci[39158]],abc)
                self.assertLess(math.dist(printed,expected),1e-7)

    def test_steiner_title_rule_is_scoped_to_real_major_branches(self):
        for title in ['3RD VERTEX OF THE STEINER CIRCUMELLIPSE',
                      'CENTER OF OSCULATING CIRCLE OF VERTEX (-1,1,1) OF STEINER INELLIPSE',
                      '1ST VERTEX OF THE STEINER INELLIPSE IN THE EXCENTRAL TRIANGLE',
                      '1ST VERTEX OF THE STEINER INELLIPSE wrt X(4)']:
            self.assertIsNone(m.steiner_major_candidate(99999,title,20))
        recipe = m.steiner_major_candidate(39202,'1ST VERTEX OF THE STEINER CIRCUMELLIPSE',20)
        self.assertIsNone(m.numeric_combo(recipe,[(1,1),(1,1)],
                                         [(0,0),(2,0),(1,math.sqrt(3))]))

    def test_3232_reviewed_formula_agrees_with_isotomic_369(self):
        from triangle_center_import import DATA
        recipe = read_recipes(DATA / 'seeds.txt', {})[3232]
        for a, b, c in [(5, 6, 7), (13, 10, 7), (4, 5, 6)]:
            q = 12*(a*b+b*c+c*a)-(a+b+c)**2
            lp = (a+b+c)/2 + math.sqrt(q)*math.sinh(math.asinh(12*math.sqrt(3)*(b-c)*(c-a)*(a-b)/q**1.5)/3)/math.sqrt(3)
            def yff(x, y, z):
                return lp**2-(2*z+x)*lp-x*x+y*y+2*z*z+2*y*z+3*z*x+2*x*y
            reference = [1/yff(*sides) for sides in [(a,b,c), (b,c,a), (c,a,b)]]
            from triangle_center_coordinates import rotate_formula
            env = side_environment(a, b, c)
            actual = [evaluate_formula(rotate_formula(recipe.formula, i), env) for i in range(3)]
            for got, expected in zip(actual, reference):
                self.assertAlmostEqual(got/sum(actual), expected/sum(reference), places=10)


    def test_reviewed_conflicting_entries_have_independent_geometry(self):
        from triangle_center_import import DATA
        seeds = read_recipes(DATA / 'seeds.txt', {})
        ideal_formula = normalize_formula('(cos B cot B/2)/(1+cos B-cos C-cos A) - '
                                          '(cos C cot C/2)/(1+cos C-cos A-cos B)')
        ideal = Recipe(8063, 'B', (), formula=ideal_formula)

        def cross(u, v): return u[0]*v[1]-u[1]*v[0]
        def circle_center(A, B, C):
            u, v = (B[0]-A[0], B[1]-A[1]), (C[0]-A[0], C[1]-A[1])
            uu, vv, d = sum(x*x for x in u), sum(x*x for x in v), 2*cross(u, v)
            return (A[0]+(uu*v[1]-vv*u[1])/d, A[1]+(u[0]*vv-v[0]*uu)/d)
        def radical_center(triangle):
            radius = math.dist(circle_center(*triangle), triangle[0])
            circles = []
            for i in range(3):
                A, B, C = triangle[i], triangle[(i+1)%3], triangle[(i+2)%3]
                P = tuple(A[j]+radius*(B[j]-A[j])/math.dist(A,B) for j in (0,1))
                Q = tuple(A[j]+radius*(C[j]-A[j])/math.dist(A,C) for j in (0,1))
                center = circle_center(A,P,Q)
                circles.append((center, math.dist(center,A)))
            o, r = circles[0]
            equations = [((2*(p[0]-o[0]),2*(p[1]-o[1])),
                          p[0]**2+p[1]**2-radius**2-o[0]**2-o[1]**2+r**2)
                         for p, radius in circles[1:]]
            (u,e),(v,f) = equations
            d = cross(u,v)
            return ((e*v[1]-u[1]*f)/d, (u[0]*f-e*v[0])/d)

        for tri, x6, x26 in [
            ([(0,0),(6,0),(1,4)], (1.4680851063829787,1.5319148936170213), (9.336363636363624,1.7710227272727237)),
            ([(0,0),(6,0),(-1,2)], (-0.06382978723404253,0.7659574468085106), (-0.4415584415584488,-2.627435064935033)),
        ]:
            self.assertLess(math.dist(numeric_formula(seeds[5507], tri), radical_center(tri)), 1e-9)
            source = numeric_formula_projective(ideal, tri)
            self.assertIsInstance(source, Ideal)
            self.assertLess(math.dist(numeric_formula(seeds[8064], tri), numeric_conjugate(source, tri, True)), 1e-9)
            target = numeric_formula(seeds[72904], tri)
            self.assertLess(abs(cross((x26[0]-x6[0],x26[1]-x6[1]), (target[0]-x6[0],target[1]-x6[1]))), 1e-8)


    def test_reviewed_midpoint_trilinears(self):
        from triangle_center_import import DATA
        recipe = read_recipes(DATA / 'seeds.txt', {})[6160]
        for triangle in [[(0, 0), (6, 0), (1, 4)], [(0, 0), (6, 0), (-1, 2)]]:
            a, b, c = (math.dist(triangle[1], triangle[2]), math.dist(triangle[2], triangle[0]), math.dist(triangle[0], triangle[1]))
            trilinears = [[(a+c)/(a+b), (b+a)/(b+c), (c+b)/(c+a)],
                          [(a+b)/(a+c), (b+c)/(b+a), (c+a)/(c+b)]]
            points = []
            for values in trilinears:
                weights = [side*value for side, value in zip((a, b, c), values)]
                points.append(tuple(sum(w*p[i] for w, p in zip(weights, triangle))/sum(weights) for i in (0, 1)))
            midpoint = tuple((points[0][i]+points[1][i])/2 for i in (0, 1))
            self.assertLess(math.dist(numeric_formula(recipe, triangle), midpoint), 1e-9)



class ReviewedFileBoundaryErrors(TestCase):
    def test_preflight_recognizes_missed_boundaries_and_conflicting_titles(self):
        for anchor, title in [('X54357)', 54357), ('X67713 ', 67713), ('X57621', 57622)]:
            self.assertTrue(heading_issues(f'<h3 id="{anchor}">X({title}) = CENTER</h3>'))
        self.assertTrue(heading_issues('<h3 id="X4000">X(4000)</h3>' * 2))
        self.assertEqual(heading_issues('<h3 id="X4000">X(4000) = CENTER</h3>'), [])


    def test_reviewed_snapshots_have_unique_ordered_boundaries(self):
        for part in (1, 6, 28, 29, 31, 34, 35, 36):
            raw = (m.CACHE/'sources'/f'ETCPart{part}.html').read_text(encoding='utf-8', errors='replace')
            prepared = prepare_source(part, raw)
            self.assertEqual(heading_issues(prepared), [], part)
            entries = dict(m.split_entries(prepared))
            if part == 6:
                recipes = m.extract_entry(10043,entries[10043],6)
                self.assertTrue(any(r.operation=='B' for r in recipes))
                self.assertTrue(any(r.operation=='J' for r in recipes))
            if part == 28:
                self.assertEqual(len(entries), 2000)
                self.assertIn(54357, entries)
                self.assertNotIn('X(54357)', entries[54356])
            if part == 34:
                self.assertEqual(len(entries), 1999)
                self.assertNotIn(66288, entries)
                self.assertIn(67713, entries)
                self.assertNotIn('X(67713)', entries[67712])
            with self.assertRaisesRegex(ValueError, 'source changed'):
                prepare_source(part, raw+'<!-- changed source -->')


class PBClusterAnchors(TestCase):
    def test_reviewed_vijay_and_vu_bc_errors_agree_with_independent_geometry(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');native=m.numeric_coordinates({},atlas)
        source=(m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8',errors='replace')
        entries=dict(m.split_entries(source));seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        for n in [38493,38494,38538,38546,38547,38549,38550]:
            original=m.coordinate_candidates(entries[n])[0][1]
            self.assertFalse(m.homogeneous_degree(original)[0],n)
            fixed=reviewed_bc_formula(n);self.assertTrue(m.homogeneous_degree(fixed)[0])
            if n in seeds:self.assertEqual(seeds[n].formula,fixed)
            for shape,abc in atlas['triangles'].items():
                if n in (38493,38494):
                    P,V,T=vijay_triangles(abc);other=V if n==38493 else T
                    target=m.numeric_intersection([P[0],other[0],P[1],other[1]])
                    p,d=m.line_data(P[2],other[2]);error=abs(cross(d,sub(target,p)))/math.hypot(*d)
                else:
                    refs=tuple(map(int,m.VU_CIRCLES.fullmatch(m.entry_metadata(entries[n])['title']).groups()))
                    target,error=vu_pair_geometry(abc,*[native[shape][ref] for ref in refs])
                    generic=m.numeric_transform_formula(m.Recipe(n,'B',refs,formula=m.VU_CIRCLES_FORMULA),
                                 [native[shape][ref] for ref in refs],abc)
                    self.assertLess(math.dist(generic,target),1e-7)
                self.assertLess(error,1e-7)
                fixed_point=m.numeric_formula(m.Recipe(n,'B',(),formula=fixed),abc)
                self.assertLess(math.dist(fixed_point,target),1e-7)
        # A wholesale replacement would corrupt a genuine abc term in X(38494).
        bad=reviewed_bc_formula(38494).replace('a*b*c*(b+c-2*a)','b*c*(b+c-2*a)')
        self.assertFalse(m.homogeneous_degree(bad)[0])
    def test_vu_second_preamble_has_a_reviewed_extra_factor_not_a_new_parser_rule(self):
        raw = (m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8',errors='replace')
        text = ' '.join(m.coordinate_text(dict(m.split_entries(raw))[38899]))
        printed = re.search(r'T\(P\)\s*=\s*(.*?)\s*:\s*:',text)[1]
        self.assertIn('8a a^4',printed)
        def polynomial(value):
            value = re.sub(r'\b[pqr]\b',lambda hit:dict(p='x',q='y',r='z')[hit[0]],value)
            value = re.sub(r'(\d)([abcxyz])',r'\1*\2',value)
            value = re.sub(r'(?<=[a-z0-9)])\s+(?=[a-z0-9(])','*',value)
            return re.sub(r'\s+','',value)
        with self.assertRaises(ValueError): m.validate_transform_formula(polynomial(printed))
        corrected = polynomial(printed.replace('8a a^4','8*a^4'))
        m.validate_transform_formula(corrected)
        atlas = m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native = m.numeric_coordinates({},atlas)
        for shape,abc in atlas['triangles'].items():
            p = native[shape][9]
            a = m.numeric_transform_formula(m.Recipe(4000,'B',(9,),formula=corrected),p,abc)
            b = m.numeric_transform_formula(m.Recipe(4000,'B',(9,),formula=m.VU_SECOND_FORMULA),p,abc)
            self.assertLess(math.dist(a,b),1e-8)

    def test_11667_expanded_roots_match_independent_euler_combo(self):
        seeds = m.read_recipes(m.DATA/'seeds.txt',{})
        raw = (m.CACHE/'sources'/'ETCPart6.html').read_text(encoding='utf-8',errors='replace')
        text = '\n'.join(m.coordinate_text(dict(m.split_entries(raw))[11667]))
        radicand = m.normalize_formula(re.search(r'where U\^2\s*=\s*(.*), and V',text)[1])
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        native = m.numeric_coordinates({},atlas)
        for shape,abc in atlas['triangles'].items():
            env = m.side_environment(*[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)])
            U,V,W = [math.sqrt(m.evaluate_formula(m.rotate_formula(radicand,i),env)) for i in range(3)]
            a,SA,SB,SC,S = [env[key] for key in ('a','SA','SB','SC','S')]
            u = 3*(64*a*a*SA**3*SB*SC+(U+V)*(U+W))
            v = -2*(64*S*S*SA**2*SB*SC+(U+V)*(U+W))
            combo = tuple((u*native[shape][2][i]+v*native[shape][3][i])/(u+v) for i in (0,1))
            self.assertLess(math.dist(combo,m.numeric_formula(seeds[11667],abc)),1e-8)

    def test_11755_reviewed_intersection_matches_balanced_printed_coordinate(self):
        seeds = m.read_recipes(m.DATA/'seeds.txt', {})
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        selected = {n: seeds[n] for n in (11753,11755)}
        points = m.numeric_coordinates(selected,atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        formula = m.Recipe(11755,'B',(),formula=(
            '2*a^3*b*c*(sqrt(3)*(-a^2+b^2+c^2)+2*S)'
            '+sqrt(2*(a^2+b^2+c^2+2*sqrt(3)*S))*((-a+b+c)*(b-c)^2*(a+b+c)*S)'))
        for shape, abc in atlas['triangles'].items():
            self.assertLess(math.dist(points[shape][11755],m.numeric_formula(formula,abc)),1e-8)

    def test_two_anchors_match_independent_preamble_vertex_construction(self):
        seeds = m.read_recipes(m.DATA/'seeds.txt', {})
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        for abc in atlas['triangles'].values():
            sides = [math.dist(abc[1],abc[2]),math.dist(abc[2],abc[0]),math.dist(abc[0],abc[1])]
            S = m.side_environment(*sides)['S']
            U = math.sqrt(2*(sum(v*v for v in sides)+2*math.sqrt(3)*S))
            vertices, excentral = [], []
            for j in range(3):
                a,b,c = [sides[(j+k)%3] for k in range(3)]
                weights = [a*a*(math.sqrt(3)*(-a*a+b*b+c*c)+2*S),
                           b*(math.sqrt(3)*b*(a*a-b*b+c*c)+2*S*(b+U)),
                           c*(math.sqrt(3)*c*(a*a+b*b-c*c)+2*S*(c+U))]
                vertices.append(tuple(sum(weights[k]*abc[(j+k)%3][i] for k in range(3))/sum(weights) for i in (0,1)))
                w = [-a,b,c]
                excentral.append(tuple(sum(w[k]*abc[(j+k)%3][i] for k in range(3))/sum(w) for i in (0,1)))
            for number, base in [(11753,abc),(11754,excentral)]:
                point = crossing(base[0],vertices[0],base[1],vertices[1])
                self.assertLess(abs(cross(sub(point,base[2]),sub(vertices[2],base[2]))),1e-8)
                self.assertLess(math.dist(point,m.numeric_formula(seeds[number],abc)),1e-8)

    def test_user_examples_produce_incidence_candidates(self):
        for part, number in [(6,11872),(21,41156)]:
            source = (m.CACHE/'sources'/f'ETCPart{part}.html').read_text(encoding='utf-8',errors='replace')
            fragment = dict(m.split_entries(source))[number]
            self.assertTrue(any(r.operation=='J' for r in m.extract_entry(number,fragment,part)))


class CircumcenterSourceConflict(TestCase):
    def test_11619_printed_formula_conflicts_with_named_circle_center(self):
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        points = m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        seed = m.read_recipes(m.DATA/'seeds.txt', {})[11619]
        corrected = m.numeric_coordinates({11619:seed},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        fragment = dict(m.split_entries((m.CACHE/'sources'/'ETCPart6.html').read_text(encoding='utf-8')))[11619]
        formula = next(r for r in m.extract_entry(11619,fragment,6) if r.operation=='B')
        for shape, xy in points.items():
            a,b,c = [xy[n] for n in (5,6,22)]
            ab,ac = sub(b,a),sub(c,a)
            mid1 = tuple((a[i]+b[i])/2 for i in (0,1))
            mid2 = tuple((a[i]+c[i])/2 for i in (0,1))
            center = crossing(mid1,(mid1[0]-ab[1],mid1[1]+ab[0]),
                              mid2,(mid2[0]-ac[1],mid2[1]+ac[0]))
            self.assertAlmostEqual(math.dist(center,a),math.dist(center,b),places=8)
            self.assertAlmostEqual(math.dist(center,a),math.dist(center,c),places=8)
            self.assertLess(math.dist(center,corrected[shape][11619]),1e-8)
            p,d = m.line_data(xy[2492],xy[2780])
            self.assertLess(abs(cross(sub(center,p),d))/math.hypot(*d),1e-8)
            self.assertGreater(math.dist(center,m.numeric_formula(formula,atlas['triangles'][shape])),1e-3)
