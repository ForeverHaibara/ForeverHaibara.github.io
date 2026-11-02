"""Absolute values and explicit min/max of sides preserve their dimensions."""
from unittest import TestCase
from triangle_center_coordinates import normalize_formula, homogeneous_degree, evaluate_formula, side_environment, coordinate_candidates


class AbsoluteCoordinatesTest(TestCase):
    def test_side_extrema_match_absolute_value_identity_under_permutations(self):
        for a,b,c in [(5,6,7),(7,5,6),(6,7,5),(5,5,6)]:
            env = side_environment(a,b,c)
            for source,expected in [('max(b,c)',max(b,c)),('MAX(b,c)',max(b,c)),('min(b,c)',min(b,c)),
                                    ('|b-c|',abs(b-c)),('abs(b^2-c^2)',abs(b*b-c*c))]:
                formula = normalize_formula(source)
                self.assertAlmostEqual(evaluate_formula(formula,env),expected)
                self.assertEqual(homogeneous_degree(formula),(True,2 if '^2' in source else 1))
        for source in ['max(a,b,c)','min(a,unknown)','|b-c','||b-c||','abs(a,b)']:
            self.assertIsNone(normalize_formula(source),source)
        self.assertFalse(homogeneous_degree('abs(a+b^2)')[0])

    def test_explicit_and_cyclic_coordinates_agree(self):
        self.assertTrue(coordinate_candidates('Trilinears max(b,c) : max(c,a) : max(a,b)'))
        self.assertTrue(coordinate_candidates('Barycentrics bc|b-c| : ca|c-a| : ab|a-b| : :'))
        self.assertEqual(coordinate_candidates('Barycentrics a : b : c : a : :'),[])
