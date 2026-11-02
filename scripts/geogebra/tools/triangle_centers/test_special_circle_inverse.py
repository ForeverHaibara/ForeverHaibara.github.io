"""Finite circle inversion and strictly scoped Brocard-circle definitions."""
import math
from unittest import TestCase
import triangle_center_import as m


class SpecialCircleInverseTest(TestCase):
    def test_circle_inverse_fixed_points_involution_and_degeneracy(self):
        self.assertEqual(m.numeric_circle_inverse([(4,0),(0,0),(2,0)]),(1,0))
        self.assertEqual(m.numeric_circle_inverse([(2,0),(0,0),(2,0)]),(2,0))
        p = (3,4)
        q = m.numeric_circle_inverse([p,(1,2),(4,2)])
        self.assertLess(math.dist(p,m.numeric_circle_inverse([q,(1,2),(4,2)])),1e-12)
        for points in [[(0,0),(0,0),(2,0)],[(3,0),(0,0),(0,0)],
                       [m.Ideal(1,0),(0,0),(2,0)]]:
            self.assertIsNone(m.numeric_circle_inverse(points))

    def test_only_unqualified_brocard_definitions_are_admitted(self):
        for body in ['Brocard-circle-inverse of X(654)','inverse-in-Brocard circle of X(654)']:
            recipes = m.extract_entry(41158,'X(41158) = '+body,21)
            self.assertEqual([r.row() for r in recipes],['41158 K 654 182 3'])
            for suffix in [' wrt excentral triangle',' in the medial triangle',' relative to ABC',' when ABC is acute']:
                self.assertEqual(m.extract_entry(41158,'X(41158) = '+body+suffix,21),[])
        with self.assertRaises(ValueError):
            m.validate_types({41158:m.Recipe(41158,'K',(30,182,3))},{30})

    def test_native_brocard_center_and_inverse_dependency_closure(self):
        atlas = m.read_native_atlas(m.CACHE/'native-atlas.json')
        records = {41158:m.Recipe(41158,'K',(654,182,3))}
        native = m.numeric_coordinates({},atlas)
        values = m.numeric_coordinates(records,atlas)
        for shape,points in native.items():
            midpoint = tuple((points[3][i]+points[6][i])/2 for i in (0,1))
            self.assertLess(math.dist(midpoint,points[182]),1e-10)
            p = values[shape][41158]
            self.assertLess(math.dist(m.numeric_circle_inverse([p,points[182],points[3]]),points[654]),1e-8)
            self.assertLess(abs((p[0]-points[182][0])*(points[654][1]-points[182][1])
                                -(p[1]-points[182][1])*(points[654][0]-points[182][0])),1e-8)
