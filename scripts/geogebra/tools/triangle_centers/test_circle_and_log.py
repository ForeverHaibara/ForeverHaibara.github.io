"""Circle-center recipes and dimensionless natural-log coordinate syntax."""
import math
from unittest import TestCase
import triangle_center_import as m
from triangle_center_coordinates import coordinate_candidates, homogeneous_degree, evaluate_formula, side_environment


class CircleAndLogTest(TestCase):
    def test_center_parse_finite_domain_and_degenerate_inputs(self):
        recipes = m.extract_entry(4000, '<h3 id="X4000">X(4000) = CENTER OF THE CIRCLE {X(5),X(6),X(22)}</h3>', 3)
        self.assertEqual(recipes[0].row(), '4000 O 5 6 22')
        self.assertEqual(m.numeric_circle_center([(0,0),(4,0),(0,2)]), (2,1))
        self.assertIsNone(m.numeric_circle_center([(0,0),(1,0),(2,0)]))
        self.assertIsNone(m.numeric_circle_center([m.Ideal(1,0),(1,0),(0,1)]))
        with self.assertRaises(ValueError):
            m.validate_types({4000:m.Recipe(4000,'O',(30,1,2))}, {30})
        self.assertEqual(m.extract_entry(4000, 'X(4000) = center of circle {X(1),X(2),X(3)} when acute', 3), [])

    def test_log_coordinates_equal_prefix_and_homogeneity(self):
        result = coordinate_candidates('Barycentrics = a/log(c/b) : b/log(a/c) : c/log(b/a)')
        self.assertEqual(result[0][1], 'a/ln(c/b)')
        self.assertTrue(homogeneous_degree(result[0][1])[0])
        self.assertFalse(homogeneous_degree('ln(a)')[0])
        self.assertAlmostEqual(evaluate_formula(result[0][1],side_environment(5,6,7)),5/math.log(7/6))
        self.assertIsNone(evaluate_formula('ln(-1)',{}))
        self.assertEqual(coordinate_candidates('Barycentrics ln(a,b) : :'), [])

    def test_power_curve_poles_match_tangent_line_reciprocals(self):
        for exponent in (1,2):
            sides=(5,6,7)
            p=[a**exponent for a in sides]
            derivative=[x*math.log(a) for a,x in zip(sides,p)]
            line=[p[1]*derivative[2]-p[2]*derivative[1],
                  p[2]*derivative[0]-p[0]*derivative[2],
                  p[0]*derivative[1]-p[1]*derivative[0]]
            actual=[a**exponent/math.log(c/b) for a,b,c in [(5,6,7),(6,7,5),(7,5,6)]]
            expected=[1/x for x in line]
            for a,b in zip(actual,expected):
                self.assertAlmostEqual(a/sum(actual),b/sum(expected))
