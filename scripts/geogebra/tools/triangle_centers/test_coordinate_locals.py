"""Bounded, explicit local scalars and grouping; no symbolic variable guessing."""
import math
from unittest import TestCase
from triangle_center_coordinates import coordinate_candidates, evaluate_formula, side_environment


class CoordinateLocalTest(TestCase):
    def test_wrapped_two_locals_and_single_uppercase_local(self):
        env = side_environment(5, 6, 7)
        for source, expected in [
            ('Trilinears p+q : :<br>where p=sin(A/2), q=cos((B-C)/2)',
             5*(math.sin(env['A']/2)+math.cos((env['B']-env['C'])/2))),
            ('Trilinears a^3+D : :<br>where D=4*S*sqrt(R*(4*R+r))',
             5*(125+4*env['S']*math.sqrt(env['R']*(4*env['R']+env['r'])))),
            ('Trilinears p+q : : , where p=sin(A/2), q=cos((B-C)/2) : :',
             5*(math.sin(env['A']/2)+math.cos((env['B']-env['C'])/2))),
        ]:
            candidates = coordinate_candidates(source)
            self.assertEqual(len(candidates), 1, source)
            self.assertAlmostEqual(evaluate_formula(candidates[0][1], env), expected)

    def test_group_braces_are_arithmetic_not_sets(self):
        candidates = coordinate_candidates('Barycentrics {a^2+b*c}*(b+c) : :')
        self.assertAlmostEqual(evaluate_formula(candidates[0][1], side_environment(5, 6, 7)), 871)
        self.assertEqual(coordinate_candidates('Barycentrics {a,b,c} : :'), [])

    def test_local_chains_unknown_symbols_and_global_shadowing_rejected(self):
        for source in ['Barycentrics p+q : : , where p=q+1, q=a',
                       'Barycentrics a : : , where a=1',
                       'Barycentrics D+a : : , where D=unknown(3)']:
            self.assertEqual(coordinate_candidates(source), [], source)
