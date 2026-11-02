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
