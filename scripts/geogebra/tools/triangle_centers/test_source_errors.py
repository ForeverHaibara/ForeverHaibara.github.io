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
    return tuple(sum(weights[j]*abc[j][i] for j in range(len(weights)))/sum(weights) for i in (0,1))


def pb_vertices(abc, group, *, keep_original_u=False):
    """PB preamble vertices; star changes S inside U as well as outside it."""
    sides=[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)]
    area=m.side_environment(*sides)['S'];signed=area if group<2 else -area
    root_area=area if keep_original_u else signed
    U=math.sqrt(2*(sum(a*a for a in sides)+2*math.sqrt(3)*root_area))
    U*=1 if group%2==0 else -1
    vertices=[]
    for j in range(3):
        a,b,c=[sides[(j+k)%3] for k in range(3)]
        weights=[a*a*(math.sqrt(3)*(-a*a+b*b+c*c)+2*signed),
                 b*(math.sqrt(3)*b*(a*a-b*b+c*c)+2*signed*(b+U)),
                 c*(math.sqrt(3)*c*(a*a+b*b-c*c)+2*signed*(c+U))]
        vertices.append(weighted_point(weights,[abc[(j+k)%3] for k in range(3)]))
    return vertices


def pb_reference_vertices(abc, kind):
    # Independent trilinear vertex matrices, converted to barycentrics.
    # ETC IndexOfTrianglesReferencedInETC.html (accessed 2026-11-02).
    sides=[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)];vertices=[]
    for j in range(3):
        a,b,c=[sides[(j+k)%3] for k in range(3)];s=a+b+c
        if kind==0: w=[1,0,0]
        elif kind==1: w=[-a,b,c]
        elif kind==2: w=[-(b-c)**2*s,(a+c)**2*(a+b-c),(a+b)**2*(a-b+c)]
        elif kind==3: w=[-a*a*s,b*(a+c)*(a+b-c),c*(a+b)*(a-b+c)]
        elif kind==4: w=[(a**3-(b+c)*a*a-(b+c)**2*a+(b*b-c*c)*(b-c))/(4*b*c),b,c]
        elif kind==5: w=[-((b+c)*a+b*b+c*c)**2*a*a/s,b*b*(a+c)**2*(a+b-c),c*c*(a+b)**2*(a-b+c)]
        elif kind==6: w=[a*a/s,-b*b/(a+b-c),-c*c/(a-b+c)]
        elif kind==7: w=[-a,2*b*b/(a+b-c),2*c*c/(a-b+c)]
        elif kind==8:
            first=(2*a**5*(a+2*b+2*c)+4*a**3*(b*b+3*b*c+c*c)*s
                   +(3*b**4+3*c**4+4*b*c*(3*b*b+5*b*c+3*c*c))*a*a
                   +(b+c)**2*(2*(b+c)*(b*b+c*c)*a+b**4+c**4))
            w=[a*first,-b*(a+c)**2*(a*a+b*a+c*(b+c))**2,-c*(a+b)**2*(a*a+c*a+b*(c+b))**2]
        else: raise ValueError(kind)
        vertices.append(weighted_point(w,[abc[(j+k)%3] for k in range(3)]))
    return vertices


def pb_perspector(abc, group, kind):
    first,second=pb_vertices(abc,group),pb_reference_vertices(abc,kind)
    point=m.numeric_intersection([first[0],second[0],first[1],second[1]])
    p,d=m.line_data(first[2],second[2])
    error=abs(cross(sub(point,p),d))/math.hypot(*d)
    return point,error


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
    def test_4201_9858_primary_definitions_overrule_false_complement_relations(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        formulas={}
        for part,ns in [(3,[4201]),(5,[9858]),(7,[13740]),(11,[20012])]:
            entries=dict(m.split_entries((m.CACHE/f'sources/ETCPart{part}.html').read_text(encoding='utf-8',errors='replace')))
            for n in ns:formulas[n]=Recipe(n,'B',(),formula=m.coordinate_candidates(entries[n])[0][1])
        points=m.numeric_coordinates({n:seeds[n] for n in [4201,9858]},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for shape,abc in atlas['triangles'].items():
            for n in [4201,9858]:
                expected=m.numeric_formula(formulas[n],abc)
                self.assertLess(math.dist(points[shape][n],expected),1e-8)
            for n,other in [(4201,13740),(9858,20012)]:
                p=m.numeric_formula(formulas[other],abc)
                complement=tuple((sum(v[i] for v in abc)-p[i])/2 for i in (0,1))
                self.assertGreater(math.dist(points[shape][n],complement),1e-3)
            p=points[shape][4201]
            complement=tuple((sum(v[i] for v in abc)-p[i])/2 for i in (0,1))
            self.assertLess(math.dist(m.numeric_formula(formulas[13740],abc),complement),1e-8)
            # Independent native lines support the printed X(9858) combo.
            for first,second in [(3,9),(443,938)]:
                base,d=m.line_data(native[shape][first],native[shape][second])
                self.assertLess(abs(cross(sub(points[shape][9858],base),d))/math.hypot(*d),1e-8)

    def test_14821_accidental_6913_collinearity_is_not_general_incidence(self):
        from fractions import Fraction
        formulas=[]
        for part,n in [(8,14821),(6,11709),(8,14933)]:
            entries=dict(m.split_entries((m.CACHE/f'sources/ETCPart{part}.html').read_text(encoding='utf-8',errors='replace')))
            formulas.append(m.coordinate_candidates(entries[n])[0][1])
        ratios=[]
        for a,b,c in [(6,9,13),(13,14,15)]:
            # Checked polynomial ASTs, evaluated with integers: no cancellation
            # from floating point or native-center implementations in this witness.
            vectors=[[eval(m.rotate_formula(f,j).replace('^','**'),{'__builtins__':{}},dict(a=a,b=b,c=c))
                      for j in range(3)] for f in formulas]
            p,q,r=vectors
            determinant=p[0]*(q[1]*r[2]-q[2]*r[1])-p[1]*(q[0]*r[2]-q[2]*r[0])+p[2]*(q[0]*r[1]-q[1]*r[0])
            ratios.append(Fraction(determinant,sum(p)*sum(q)*sum(r)))
        self.assertEqual(ratios[0],Fraction(71298654909147,912201855096415469494240))
        self.assertLess(abs(ratios[0]),1e-9)
        self.assertGreater(abs(ratios[1]),0.5)
        fragment='X(14821) lies on this line: {11709,14933}, {1,2}'
        lines=m.relation_lines(fragment)
        # Keep the source faithfully; the reviewed definition is in seeds,
        # not a point-specific filter embedded in the parser.
        self.assertIn((11709,14933),m.listed_lines(14821,lines))
        self.assertIn((11709,14933),m.coordinate_incidence_lines(14821,lines))
        self.assertIn((1,2),m.listed_lines(14821,lines))
        self.assertIn((11709,14933),m.listed_lines(14822,['X(14822) lies on this line: {11709,14933}']))
        self.assertEqual(m.read_recipes(m.DATA/'seeds.txt',{})[14821].row(),'14821 B 38 7829 x*u')

    def test_8037_correct_ceva_relation_has_a_removable_base_point(self):
        seed=m.read_recipes(m.DATA/'seeds.txt',{})[8037]
        # Write X=a^2, Y=b^2, Z=c^2, T=S. Clearing the denominators of
        # X(1131) leaves a common t0*t1*t2; cancellation gives the seed.
        for X,Y,Z,T in [(53,5,36,12),(41,17,36,24),(8,13,17,7)]:
            q=[X+T,Y+T,Z+T];t=[Y+Z-X+T,Z+X-Y+T,X+Y-Z+T]
            for i in range(3):
                j,k=(i+1)%3,(i+2)%3
                self.assertEqual(-t[i]*q[i]+t[j]*q[j]+t[k]*q[k],t[j]*t[k])
        formula=Recipe(1131,'B',(),formula='1/(2*SA+S)')
        other=Recipe(3068,'B',(),formula='a^2+S')
        transform=Recipe(8037,'B',(1131,3068),formula=m.CEVA_CROSS_FORMULAS['ceva conjugate'])
        for abc in [[(0,0),(6,0),(1,4)],[(1,2),(8,2),(3,7)]]:
            source=m.numeric_formula(formula,abc);p=m.numeric_formula(other,abc)
            self.assertLess(math.dist(m.numeric_transform_formula(transform,[source,p],abc),m.numeric_formula(seed,abc)),1e-8)
        abc=[(0,0),(6,0),(-1,2)]
        self.assertIsNone(m.numeric_transform_formula(transform,[abc[0],m.numeric_formula(other,abc)],abc))
        self.assertLess(math.dist(m.numeric_formula(seed,abc),abc[0]),1e-12)

    def test_user_reviewed_intersections_and_dao_perspector_are_seeded(self):
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        for n,row in [(7742,'7742 J 1 3 22 1612'),(40822,'40822 J 5 264 290 1352'),
                      (72796,'72796 J 80 53618 1293 30198')]:
            self.assertEqual(seeds[n].row(),row)
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart25.html').read_text(encoding='utf-8',errors='replace')))
        self.assertEqual(seeds[48720].operation,'B')
        self.assertFalse(seeds[48720].references)
        self.assertEqual(seeds[48720].formula,m.coordinate_candidates(entries[48720])[0][1])

    def test_reviewed_title_repairs_match_coordinates_without_number_replacement(self):
        targets={40822:21,72796:37,71989:36,72498:37,72939:37,72941:37,73051:37}
        records={n:r for path in (m.DATA/'chunks').glob('*.txt') for n,r in m.read_recipes(path).items()}
        records.update(m.read_recipes(m.DATA/'seeds.txt',{}))
        closure={}
        def visit(n):
            if not m.requires_recipe(n) or n in closure:return
            closure[n]=records[n]
            for ref in records[n].references:visit(ref)
        for n in targets:visit(n)
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        points=m.numeric_coordinates(closure,atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for part in set(targets.values()):
            entries=dict(m.split_entries((m.CACHE/f'sources/ETCPart{part}.html').read_text(encoding='utf-8',errors='replace')))
            for n in [n for n in targets if targets[n]==part]:
                formulas=[Recipe(n,'B',(),formula=f) for _,f,_ in m.coordinate_candidates(entries[n])]
                for shape,abc in atlas['triangles'].items():
                    expected=[m.numeric_formula(r,abc) for r in formulas]
                    self.assertTrue(any(p is not None and math.dist(points[shape][n],p)<1e-7 for p in expected),(n,shape))
        # The parser must preserve the raw mistaken title as evidence. Only
        # the reviewed seed supplies the selected corrected construction.
        fragment='<h3>X(72796) = X(8)X(53618)&cap;X(1293)X(30198)</h3>'
        self.assertTrue(any(r.references==(8,53618,1293,30198) for r in m.extract_entry(72796,fragment,37)))

    def test_user_confirmed_singular_foci_are_pinned_without_rederivation(self):
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        self.assertEqual(seeds[14083].row(),'14083 J 120 4220 3 14680')
        self.assertEqual(seeds[14084].row(),'14084 J 729 2080 351 14830')

    def test_10685_missing_plus_confirmed_by_brocard_anticevian_geometry(self):
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[10685]
        for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],[(2,-3),(10,-1),(3,4)]]:
            a,b,c=[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)]
            lines=[]
            for weights in [[a*a*c*c,a*a*b*b,b*b*c*c],[a*a*b*b,b*b*c*c,c*c*a*a]]:
                p=weighted_point(weights,abc)
                tri=[weighted_point([-w if j==k else w for j,w in enumerate(weights)],abc) for k in range(3)]
                lines.extend([p,m.numeric_conjugate(p,tri,True)])
            target=m.numeric_intersection(lines)
            self.assertLess(math.dist(m.numeric_formula(recipe,abc),target),1e-8)
            # Homogeneity alone cannot determine the missing operator's sign.
            wrong=recipe.formula.replace('(b^2+c^2)+b^4','(b^2+c^2)-b^4')
            self.assertTrue(m.homogeneous_degree(wrong)[0])
            self.assertGreater(math.dist(m.numeric_formula(Recipe(10685,'B',(),formula=wrong),abc),target),1e-3)

    def test_steiner_minor_vertices_and_curvature_centers(self):
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        cases=[[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],
               [(2,-3),(10,-1),(3,4)],[(0,0),(4,0),(2.00001,3.47)],
               [(0,0),(4,0),(1.99999,3.47)]]
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8')))
        text='\n'.join(m.coordinate_text(entries[39204]))
        raw=re.search(r'Barycentrics\s+(.+?)(?: : :|\n)',text)[1]
        printed=Recipe(39204,'B',(),formula=m.normalize_formula(raw.replace('J^2','(9-(a^2+b^2+c^2)/R^2)')))
        for original in cases:
            for turn in range(3):
                abc=original[turn:]+original[:turn]
                G=tuple(sum(p[i] for p in abc)/3 for i in (0,1))
                q=[[2/3*sum((p[i]-G[i])*(p[j]-G[j]) for p in abc) for j in (0,1)] for i in (0,1)]
                gap=math.hypot(q[0][0]-q[1][1],2*q[0][1])
                major=(q[0][0]+q[1][1]+gap)/2;minor=major-gap
                sides=[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)]
                K=weighted_point([a*a for a in sides],abc);v=sub(K,G)
                projected=tuple(major*v[i]-sum(q[i][j]*v[j] for j in (0,1)) for i in (0,1))
                expected=tuple(G[i]+math.sqrt(minor)*projected[i]/math.hypot(*projected) for i in (0,1))
                vertex=m.numeric_formula(seeds[39204],abc)
                self.assertLess(math.dist(vertex,expected),1e-7)
                center=m.numeric_combo(seeds[39302],[G,vertex],abc)
                expected_center=tuple(G[i]-gap/minor*(vertex[i]-G[i]) for i in (0,1))
                self.assertLess(math.dist(center,expected_center),1e-7)
                if original in cases[:3]:
                    self.assertLess(math.dist(vertex,m.numeric_formula(printed,abc)),1e-8)
                # Three actual points on the ellipse near its minor vertex
                # independently approach the same osculating-circle center.
                e=sub(vertex,G);e=tuple(t/math.sqrt(minor) for t in e);n=(-e[1],e[0]);h=1e-3
                neighbors=[tuple(G[i]+math.sqrt(minor)*e[i]*math.cos(t)+math.sqrt(major)*n[i]*math.sin(t)
                                 for i in (0,1)) for t in (-h,0,h)]
                sampled=m.numeric_circle_center(neighbors)
                self.assertLess(math.dist(center,sampled),1e-4)
        self.assertIsNone(m.numeric_formula(seeds[39204],[(0,0),(4,0),(2,3.47)]))

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
        points=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
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
        points=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas,directions)
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
                                if r.operation=='B' and not r.references) for n in (39158,39159)}
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
            self.assertEqual(prepare_source(part, raw+'<!-- changed source -->'),
                             prepared+'<!-- changed source -->')



class SourcePatchContentTests(TestCase):
    def test_literal_repairs_and_already_fixed_sources(self):
        cases = [
            (1, '<h3 id="X164">X(164 =', '<h3 id="X164">X(164) ='),
            (6, 'p&gt;X(10043) lies on these lines:', '</p><p>X(10043) lies on these lines:'),
            (28, 'id="X54357)"', 'id="X54357"'),
            (29, '<h3 id="X57621">X(57622)', '<h3 id="X57621">X(57621)'),
            (31, '<h3 id="X60349">X(60349 =', '<h3 id="X60349">X(60349) ='),
            (34, 'id="X67713 "', 'id="X67713"'),
            (35, '<h3 id="X68618">X(68618 =', '<h3 id="X68618">X(68618) ='),
            (36, '<h3 id="X71412">X(714112)', '<h3 id="X71412">X(71412)'),
        ]
        for part, broken, fixed in cases:
            with self.subTest(part=part):
                self.assertEqual(prepare_source(part, 'changed '+broken), 'changed '+fixed)
                self.assertEqual(prepare_source(part, fixed), fixed)

    def test_duplicate_entries(self):
        entry = '<h3 id="X54980">X(54980)</h3><p>same</p>'
        end = '<h3 id="X54981">next</h3>'
        self.assertEqual(prepare_source(28, entry+entry+end), entry+end)
        self.assertEqual(prepare_source(28, entry+end), entry+end)
        with self.assertRaisesRegex(ValueError, 'duplicate entries differ'):
            prepare_source(28, entry+entry.replace('same', 'different')+end)

    def test_ambiguous_entries_are_quarantined_only_when_duplicated(self):
        first = '<h3 id="X66288">first</h3>'
        second = '<h3 id="X66288">second</h3>'
        end = '<h3 id="X66289">next</h3>'
        self.assertEqual(prepare_source(34, first+second+end), end)
        self.assertEqual(prepare_source(34, first+end), first+end)
        self.assertEqual(prepare_source(34, end), end)

class PBClusterAnchors(TestCase):
    def test_64802_coordinate_sum_is_identically_zero(self):
        # In each cyclic monomial family the coefficients are 4-2-2 and
        # -7+5+2. The zero-sum polynomial is not the zero vector generically.
        def f(a,b,c):return 4*a**6-7*a**4*b*b+5*a*a*b**4-2*b**6-7*a**4*c*c+2*b**4*c*c+5*a*a*c**4+2*b*b*c**4-2*c**6
        for a,b,c in [(5,6,7),(13,14,15)]:
            weights=[f(a,b,c),f(b,c,a),f(c,a,b)]
            self.assertEqual(sum(weights),0);self.assertTrue(any(weights))
        seed=m.read_recipes(m.DATA/'seeds.txt',{})[64802]
        self.assertEqual((seed.operation,seed.references),('I',()))

    def test_declared_oh_clusters_obey_independent_euler_relations(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');native=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas)
        formulas={}
        for part,numbers in [(10,[18871]),(20,[38001,38002])]:
            es=dict(m.split_entries((m.CACHE/'sources'/f'ETCPart{part}.html').read_text(encoding='utf-8')))
            for n in numbers:
                formulas[n]=next(r for r in m.extract_entry(n,es[n],part) if r.operation=='B')
        for shape,abc in atlas['triangles'].items():
            env=m.side_environment(*[math.dist(abc[(j+1)%3],abc[(j+2)%3]) for j in range(3)])
            J=math.dist(native[shape][3],native[shape][4])/env['R']
            first=3*(2*env['r']-env['R']-env['R']*J)
            second=-(6*env['r']-3*env['R']-env['R']*J)
            expected=weighted_point([first,second],[native[shape][2],native[shape][3]])
            self.assertLess(math.dist(m.numeric_formula(formulas[18871],abc),expected),1e-8)
            p,q=[m.numeric_formula(formulas[n],abc) for n in [38001,38002]]
            self.assertLess(math.dist(m.numeric_circum_inverse(p,abc),q),1e-8)
            for point in (p,q):
                self.assertLess(abs(cross(sub(point,native[shape][2]),sub(native[shape][3],native[shape][2]))),1e-7)

    def test_all_36_pb_perspectors_against_independent_vertex_matrices(self):
        es=dict(m.split_entries(prepare_source(6,(m.CACHE/'sources/ETCPart6.html').read_text(encoding='utf-8',errors='replace'))))
        candidates={n:m.extract_entry(n,es[n],6,compact=True) for n in range(11753,11789)}
        seeds={n:r for n,r in m.read_recipes(m.DATA/'seeds.txt',{}).items() if n in candidates}
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');blocked,directions=m.read_native_status(m.DATA/'native-status.txt')
        selected=m.select_recipes(candidates,seeds,6,None,1,blocked,set(),atlas,directions)
        self.assertEqual(set(selected),set(candidates))
        points=m.numeric_coordinates(selected,atlas,directions)
        for shape,abc in atlas['triangles'].items():
            for n in candidates:
                expected,error=pb_perspector(abc,(n-11753)//9,(n-11753)%9)
                self.assertLess(error,1e-7,(shape,n))
                self.assertLess(math.dist(points[shape][n],expected),1e-7,(shape,n))
        for abc in [[(0,0),(15,0),(8.4,11.2)],[(2,-3),(14,-3),(4,5)]]:
            for n in (11761,11770,11779,11788):
                expected,error=pb_perspector(abc,(n-11753)//9,8)
                self.assertLess(error,1e-7)
                self.assertLess(math.dist(m.numeric_formula(seeds[n],abc),expected),1e-7)

    def test_pb_star_recomputes_u_to_preserve_diameter_circle(self):
        for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],[(0,0),(15,0),(8.4,11.2)]]:
            for group in (0,2):
                first,second=pb_vertices(abc,group),pb_vertices(abc,group+1)
                for i in range(3):
                    center=tuple((first[i][j]+second[i][j])/2 for j in (0,1))
                    radius=math.dist(center,first[i])
                    for k in (1,2):self.assertAlmostEqual(math.dist(center,abc[(i+k)%3]),radius,places=7)
            first,second=pb_vertices(abc,2,keep_original_u=True),pb_vertices(abc,3,keep_original_u=True)
            center=tuple((first[0][j]+second[0][j])/2 for j in (0,1))
            self.assertGreater(abs(math.dist(center,abc[1])-math.dist(center,first[0])),1e-3)

    def test_user_reviewed_targets_keep_coordinates_without_overwriting_focal_endpoints(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        records={n:r for p in (m.DATA/'chunks').glob('*.txt') for n,r in m.read_recipes(p).items()}
        seeds=m.read_recipes(m.DATA/'seeds.txt',{});records.update(seeds)
        points=m.numeric_coordinates(records,atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for shape,abc in atlas['triangles'].items():
            expected=m.numeric_formula(Recipe(14079,'B',(),formula='a*abs(b-c)'),abc)
            self.assertLess(math.dist(expected,points[shape][14079]),1e-8)
            es=dict(m.split_entries((m.CACHE/'sources/ETCPart8.html').read_text(encoding='utf-8')))
            formula=m.coordinate_candidates(es[14821])[0][1]
            self.assertLess(math.dist(m.numeric_formula(Recipe(14821,'B',(),formula=formula),abc),points[shape][14821]),1e-8)

    def test_absolute_family_pins_bss_and_conjugates_not_conflicting_focus_paths(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        for abc in atlas['triangles'].values():
            p78=m.numeric_formula(Recipe(14078,'B',(),formula='abs(b-c)'),abc)
            p89=m.numeric_formula(Recipe(14089,'B',(),formula='abs((a^2-b^2)*(a^2-c^2))'),abc)
            p87,p88,p90=[m.numeric_formula(seeds[n],abc) for n in [14087,14088,14090]]
            self.assertLess(math.dist(p87,m.numeric_conjugate(p78,abc,False)),1e-8)
            self.assertLess(math.dist(p88,m.numeric_conjugate(p87,abc,True)),1e-8)
            self.assertLess(math.dist(p90,m.numeric_conjugate(p89,abc,True)),1e-8)
            p79=m.numeric_formula(seeds[14079],abc)
            target=m.numeric_formula(Recipe(60545,'B',(),formula='a*abs(b-c)*(-a+b+c)'),abc)
            p,d=m.line_data(p79,p88)
            self.assertLess(abs(cross(sub(target,p),d))/math.hypot(*d),1e-8)

    def test_reviewed_skips_are_not_guessed_homogeneous_repairs(self):
        skipped={};records=m.read_recipes(m.DATA/'seeds.txt',skipped)
        for n,part in [(12025,7),(32584,17)]:
            self.assertIn(n,skipped);self.assertNotIn(n,records)
            es=dict(m.split_entries((m.CACHE/'sources'/f'ETCPart{part}.html').read_text(encoding='utf-8')))
            formula=m.coordinate_candidates(es[n])[0][1]
            self.assertFalse(m.homogeneous_degree(formula)[0])
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas)
        for shape,abc in atlas['triangles'].items():
            a,b,c=[math.dist(abc[(j+1)%3],abc[(j+2)%3]) for j in range(3)]
            u,v,w=b*b-c*c,c*c-a*a,a*a-b*b
            M=[[0,w,v],[w,0,u],[v,u,0]]
            center=[u*u,v*v,w*w]
            result=[sum(M[i][j]*center[j] for j in range(3)) for i in range(3)]
            for value in result:self.assertAlmostEqual(value,-u*v*w,places=7)
            self.assertLess(math.dist(weighted_point(center,abc),native[shape][115]),1e-8)
            for i,p in enumerate([(u,-v,-w),(-u,v,-w),(-u,-v,w)]):
                polar=[sum(M[k][j]*p[j] for j in range(3)) for k in range(3)]
                for k in range(3):
                    if k!=i:self.assertAlmostEqual(polar[k],0,places=8)

    def test_13137_true_simson_reflection_rejects_mislabeled_line(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[13137]
        points=m.numeric_coordinates({13137:recipe},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        es=dict(m.split_entries((m.CACHE/'sources/ETCPart7.html').read_text(encoding='utf-8')))
        raw='\n'.join(m.coordinate_text(es[13137])).split('Barycentrics',1)[1].splitlines()[0]
        formula=m.normalize_formula(raw)
        for shape,abc in atlas['triangles'].items():
            ps=points[shape];P=ps[98];feet=[]
            for i in range(3):
                q,r=abc[(i+1)%3],abc[(i+2)%3];d=sub(r,q)
                t=sum((P[j]-q[j])*d[j] for j in (0,1))/sum(x*x for x in d)
                feet.append(tuple(q[j]+t*d[j] for j in (0,1)))
            q,d=m.line_data(feet[0],feet[1]);t=sum((P[j]-q[j])*d[j] for j in (0,1))/sum(x*x for x in d)
            reflected=tuple(2*(q[j]+t*d[j])-P[j] for j in (0,1))
            self.assertLess(math.dist(ps[13137],reflected),1e-8)
            self.assertLess(math.dist(ps[13137],m.numeric_formula(Recipe(13137,'B',(),formula=formula),abc)),1e-8)
            q,d=m.line_data(ps[115],ps[523])
            self.assertGreater(abs(cross(sub(feet[0],q),d))/math.hypot(*d),1e-3)

    def test_reviewed_vijay_and_vu_bc_errors_agree_with_independent_geometry(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');native=m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas)
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
        native = m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas)
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
        native = m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas)
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
        points = m.numeric_coordinates(m.read_recipes(m.NATIVE_PATCH_PATH),atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
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


class ReviewedUpstreamCorrections(TestCase):
    def test_reviewed_seeds_and_40619_native_alternative_match_coordinates(self):
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        ids={18131:10,34419:18,34307:18,34575:18,20211:11,22654:12,14838:8,40619:21,8430:5,38513:20}
        fragments={}
        for n,part in ids.items():
            entries=dict(m.split_entries((m.CACHE/f'sources/ETCPart{part}.html').read_text(encoding='utf-8',errors='replace')))
            fragments[n]=entries[n]
        records={n:r for path in (m.DATA/'chunks').glob('*.txt') for n,r in m.read_recipes(path).items()}
        records.update(seeds)
        records[40619]=Recipe(40619,'J',(11,693,100,2481))
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        points=m.numeric_coordinates(records,atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for n in ids:
            formulas=m.coordinate_candidates(fragments[n])
            self.assertTrue(formulas)
            for shape,abc in atlas['triangles'].items():
                printed=m.numeric_formula(Recipe(n,'B',(),formula=formulas[0][1]),abc)
                with self.subTest(number=n,shape=shape):
                    self.assertLess(math.dist(points[shape][n],printed),1e-7*max(1,math.hypot(*printed)))
        parsed=list(m.extract_entry(40619,fragments[40619],21))
        self.assertNotIn(('C',(19,)),[(r.operation,r.references) for r in parsed])
        self.assertTrue(any(r.operation=='J' for r in parsed))

    def test_32472_is_ideal_and_keeps_a_usable_direction(self):
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart17.html').read_text(encoding='utf-8',errors='replace')))
        recipes=m.extract_entry(32472,entries[32472],17)
        self.assertIn('32472 I 4 2489',[r.row() for r in recipes])
        formula=m.coordinate_candidates(entries[32472])[0][1]
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        for abc in atlas['triangles'].values():
            self.assertIsInstance(m.numeric_formula_projective(Recipe(32472,'B',(),formula=formula),abc),Ideal)


class RemainingCoordinateReview(TestCase):
    def test_morley_locals_are_expanded_cyclically_without_binding_xyz(self):
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart12.html').read_text(encoding='utf-8',errors='replace')))
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        abc=[(0,0),(6,0),(1,4)]
        env=m.side_environment(*[math.dist(abc[(j+1)%3],abc[(j+2)%3]) for j in range(3)])
        for n,shift in [(23032,0),(23033,2*math.pi),(23034,4*math.pi)]:
            first=next(l for l in m.coordinate_text(entries[n]) if l.startswith('Barycentrics')).removeprefix('Barycentrics').split(':')[0].strip()
            xyz={name:1/math.cos((env[angle]-shift)/3) for name,angle in zip('xyz','ABC')}
            weights=[m.evaluate_formula(m.rotate_formula(first,j),dict(env,**xyz)) for j in range(3)]
            self.assertLess(math.dist(m.numeric_formula(seeds[n],abc),weighted_point(weights,abc)),1e-8)

    def test_comma_triple_root_seeds_and_reflection_partners(self):
        from triangle_center_coordinates import expand_squared_locals
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart37.html').read_text(encoding='utf-8',errors='replace')))
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        for n in [72698,72699,72700,72701]:
            line=next(l for l in m.coordinate_text(entries[n]) if l.startswith('Barycentrics'))
            prefix,definitions=line.removeprefix('Barycentrics').split('where')
            parts=prefix.split(':')[0].split(',')
            for shape,abc in atlas['triangles'].items():
                env=m.side_environment(*[math.dist(abc[(j+1)%3],abc[(j+2)%3]) for j in range(3)])
                weights=[]
                for part in parts:
                    expanded=expand_squared_locals(part+' : : where '+definitions).split(':')[0]
                    weights.append(m.evaluate_formula(m.normalize_formula(expanded),env))
                source=seeds[n if n%2==0 else n-1]
                point=m.numeric_formula(source,abc)
                if any(w is None for w in weights):
                    self.assertIsNone(point)
                else:
                    if n%2:
                        G=tuple(sum(p[k] for p in abc)/3 for k in (0,1))
                        point=tuple(2*G[k]-point[k] for k in (0,1))
                    self.assertLess(math.dist(point,weighted_point(weights,abc)),1e-8)

    def test_hungerbuhler_closed_form_uses_the_equal_cevian_segment_root(self):
        recipe=m.read_recipes(m.DATA/'seeds.txt',{})[72483]
        for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)],[(0,0),(6,0),(3,math.sqrt(27))]]:
            a,b,c=[math.dist(abc[(j+1)%3],abc[(j+2)%3]) for j in range(3)]
            # Concurrent cevians with BD=CE=AF=x satisfy Ceva:
            # x^3=(a-x)(b-x)(c-x). This reference uses no hyperbolic formula.
            lo,hi=0,min(a,b,c)
            for _ in range(80):
                x=(lo+hi)/2
                if x**3>(a-x)*(b-x)*(c-x):hi=x
                else:lo=x
            x=(lo+hi)/2
            expected=weighted_point([a*(b+c)-2*x*(a-x),b*(c+a)-2*x*(b-x),c*(a+b)-2*x*(c-x)],abc)
            self.assertLess(math.dist(m.numeric_formula(recipe,abc),expected),1e-8)

    def test_72514_invariant_reduction_is_exact_and_numerically_stable(self):
        from fractions import Fraction
        from decimal import Decimal, localcontext
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart37.html').read_text(encoding='utf-8',errors='replace')))
        printed=m.coordinate_candidates(entries[72514])[0][1]
        seed=m.read_recipes(m.DATA/'seeds.txt',{})[72514]
        # Exact rational witnesses verify the removed common factor 16*S^14.
        reduced=re.sub(r'\bS\^(\d+)',lambda h:'H^'+str(int(h[1])//2),seed.formula)
        for a,b,c in [(5,6,7),(6,9,13),(13,14,15),(4,5,8)]:
            a,b,c=map(Fraction,(a,b,c));W=(a*a+b*b+c*c)/2
            H=(2*(a*a*b*b+b*b*c*c+c*c*a*a)-a**4-b**4-c**4)/4
            E=a*a*b*b*c*c/H
            env=dict(a=a,b=b,c=c,SW=W,E=E,F=W-E,H=H)
            for j in range(3):
                old=eval(m.rotate_formula(printed,j).replace('^','**'),{'__builtins__':{}},env)
                new=eval(m.rotate_formula(reduced,j).replace('^','**'),{'__builtins__':{}},env)
                self.assertEqual(old,16*H**7*new)
        # Compare double evaluation to a 90-digit source-polynomial reference.
        with localcontext() as ctx:
            ctx.prec=90
            for abc in [[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)]]:
                env=dict(zip('abc',[Decimal(sum((abc[(j+1)%3][k]-abc[(j+2)%3][k])**2 for k in range(2))).sqrt() for j in range(3)]))
                weights=[eval(m.rotate_formula(printed,j).replace('^','**'),{'__builtins__':{}},env) for j in range(3)]
                reference=tuple(float(sum(weights[j]*abc[j][k] for j in range(3))/sum(weights)) for k in range(2))
                self.assertLess(math.dist(m.numeric_formula(seed,abc),reference)/max(1,math.hypot(*reference)),1e-9)

    def test_isolated_source_repairs_and_deferred_cases_are_explicit(self):
        seeds=m.read_recipes(m.DATA/'seeds.txt',{})
        self.assertEqual(seeds[26653].row(),'26653 J 1 2 9 20248')
        self.assertEqual(seeds[26842].row(),'26842 J 2 7 149 354')
        self.assertEqual(seeds[3067].formula,'a^2/(A*(B-C))')
        for n in [10228,11811,13301,31957,36721,36731,38439,51777,65951,72483,72513]:
            self.assertTrue(m.homogeneous_degree(seeds[n].formula)[0],n)
        self.assertTrue(all(n not in seeds for n in [5373,5394,5626,40139]))


class NativePatchReview(TestCase):
    def test_all_native_repairs_match_signed_6913_reference_distances(self):
        expected={369:3.226427108490245,459:1.8571771799622385,1071:7.896654233888623,
                  1285:.10296691685647652,1908:1.2802359760886326,1913:.7225047024565878,
                  1939:.7993252177184844,2923:-5.853795909608209,2924:7.2931191813607,
                  2925:19.011461735073297,2926:53.48469040713851,
                  2927:-23.522547806981656,2928:-7.067034997766579,3020:2.8569360841651337}
        patches=m.read_recipes(m.NATIVE_PATCH_PATH)
        self.assertEqual(set(patches),set(expected))
        a,b,c=6,9,13
        ax=(a*a+c*c-b*b)/(2*a)
        abc=[(ax,math.sqrt(c*c-ax*ax)),(0,0),(a,0)]
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart1.html').read_text(encoding='utf-8',errors='replace')))
        native={str(n):m.numeric_formula(Recipe(n,'B',(),formula=m.coordinate_candidates(entries[n])[0][1]),abc) for n in [1,4,7,84]}
        native.update({str(n):(1e8,-1e8) for n in patches})
        atlas=dict(triangles={'6913':abc},coordinates={'6913':native})
        points=m.numeric_coordinates(patches,atlas)['6913']
        for n,reference in expected.items():
            with self.subTest(number=n):
                self.assertLess(abs(points[n][1]-reference),1e-6*max(1,abs(reference)))
        # Missing overrides cannot silently read poisoned native atlas values.
        self.assertFalse(set(patches)&m.numeric_coordinates({},atlas)['6913'].keys())

    def test_repaired_native_inputs_propagate_and_missing_patch_fails_closed(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        patches=m.read_recipes(m.NATIVE_PATCH_PATH)
        records={**patches,10202:Recipe(10202,'M',(1071,5927)),5927:Recipe(5927,'C',(1,))}
        points=m.numeric_coordinates(records,atlas)
        for shape,ps in points.items():
            midpoint=tuple((ps[1071][k]+ps[5927][k])/2 for k in (0,1))
            self.assertEqual(ps[10202],midpoint)
            self.assertNotEqual(ps[1071],tuple(atlas['coordinates'][shape]['1071']))
        self.assertEqual(m.validate_graph(records)[0][10202],2)
        with self.assertRaisesRegex(ValueError,'Missing'):
            m.validate_graph({4000:Recipe(4000,'M',(1071,1))})
        with self.assertRaisesRegex(ValueError,'Missing recipe'):
            m.validate_recipe_inputs(Recipe(4000,'M',(1071,1)),{},set())

    def test_1071_repair_restores_10202_and_both_26842_incidences(self):
        records={n:r for path in (m.DATA/'chunks').glob('*.txt') for n,r in m.read_recipes(path).items()}
        needed={10202,26842,6894,6840};pending=list(needed)
        while pending:
            n=pending.pop()
            for ref in records[n].references if n in records else ():
                if m.requires_recipe(ref) and ref not in needed:needed.add(ref);pending.append(ref)
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        points=m.numeric_coordinates({n:records[n] for n in needed if n in records},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart6.html').read_text(encoding='utf-8',errors='replace')))
        coordinate=Recipe(10202,'B',(),formula=m.coordinate_candidates(entries[10202])[0][1])
        for shape,abc in atlas['triangles'].items():
            ps=points[shape]
            self.assertLess(math.dist(ps[10202],m.numeric_formula(coordinate,abc)),1e-8)
            for pair in [(1071,6894),(6840,10202)]:
                base,d=m.line_data(*[ps[n] for n in pair])
                self.assertLess(abs(cross(sub(ps[26842],base),d))/math.hypot(*d),1e-8)

    def test_15276_user_verified_coefficient_is_only_a_seed_correction(self):
        seed=m.read_recipes(m.DATA/'seeds.txt',{})[15276]
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart8.html').read_text(encoding='utf-8',errors='replace')))
        self.assertIn('fd12',entries[15276])
        self.assertEqual(seed.formula,m.coordinate_candidates(entries[15276].replace('fd12','12'))[0][1])
        self.assertTrue(m.homogeneous_degree(seed.formula)[0])


class GeminiSourceCoordinates(TestCase):
    def test_25962_gemini37_circumcenter_image_matches_printed_coordinates(self):
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart13.html').read_text(encoding='utf-8',errors='replace')))
        candidates=m.extract_entry(25962,entries[25962],13,compact=True).explicit
        self.assertIn('25962 B 3 @g37',[r.row() for r in candidates])
        printed=Recipe(25962,'B',(),formula=m.coordinate_candidates(entries[25962])[0][1])
        mapping=Recipe(25962,'B',(3,),formula='@g37')
        triangles=[[(0,0),(6,0),(1,4)],[(0,0),(6,0),(-1,2)]]
        for a,b,c in [(6,9,13),(13,14,15)]:
            x=(a*a+c*c-b*b)/(2*a)
            triangles.append([(x,math.sqrt(c*c-x*x)),(0,0),(a,0)])
        for abc in triangles:
            O=m.numeric_circle_center(abc)
            expected=m.numeric_formula(printed,abc)
            actual=m.numeric_transform_formula(mapping,O,abc)
            self.assertLess(math.dist(actual,expected),1e-8*max(1,math.hypot(*expected)))
