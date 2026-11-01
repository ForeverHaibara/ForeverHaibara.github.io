"""Independent constructions for source conflicts exposed by fresh snapshots."""
import math
from unittest import TestCase

import triangle_center_import as m


def sub(p, q):
    return p[0]-q[0], p[1]-q[1]


def cross(p, q):
    return p[0]*q[1]-p[1]*q[0]


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
        atlas = m.read_native_atlas(m.CACHE/'native-atlas.json')
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
