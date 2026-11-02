"""Complex domains describe evidence without pruning valid real alternatives."""
from pathlib import Path
import cmath
import math
from tempfile import TemporaryDirectory
from unittest import TestCase

import triangle_center_import as m
from triangle_center_domains import complex_dependency_roots


class DomainAnnotationsTest(TestCase):
    def test_reviewed_seed_metadata_is_not_a_recipe_or_skip(self):
        with TemporaryDirectory(dir=m.CACHE) as directory:
            path = Path(directory)/'seeds.txt'
            path.write_text('4000 DOMAIN conditional_complex # reviewed\n4000 B a\n4001 DOMAIN nonreal\n')
            skipped, domains = {}, {}
            recipes = m.read_recipes(path, skipped, domains)
            self.assertEqual(set(recipes), {4000})
            self.assertEqual(skipped, {})
            self.assertEqual(domains, {4000:'conditional_complex',4001:'nonreal'})
            self.assertEqual(m.read_recipes(path, {}), recipes)
            # A runtime chunk cannot silently accept metadata as a construction.
            with self.assertRaises(ValueError):
                m.read_recipes(path)
            for rows in ['4000 DOMAIN real', '4000 DOMAIN nonreal\n4000 DOMAIN nonreal',
                         '4000 SKIP source-error\n4000 DOMAIN nonreal',
                         '4000 DOMAIN nonreal\n4000 SKIP source-error']:
                path.write_text(rows)
                with self.assertRaises(ValueError, msg=rows):
                    m.read_recipes(path, {}, {})

    def test_cycles_families_and_selected_alternatives_propagate_only_risk(self):
        class Family:
            explicit = []
            lines = [(1,4000),(2,4002)]
            def __iter__(self):
                raise AssertionError('must not expand inferred pairs')
        candidates = {4000:[],4001:[m.Recipe(4001,'M',(4000,4002))],
                      4002:[m.Recipe(4002,'C',(4001,))],4003:Family(),
                      4004:[m.Recipe(4004,'C',(4000,))],
                      4005:[m.Recipe(4005,'C',(4004,))]}
        chosen = {4004:m.Recipe(4004,'B',(),formula='a')}
        roots = complex_dependency_roots(candidates,chosen,{4000:'nonreal'})
        self.assertEqual(dict(roots), {n:{4000} for n in (4000,4001,4002,4003)})
        # Even an actual dependency is not a theorem about the result's reality.
        self.assertEqual(((2+3j)+(2-3j))/2, 2)

    def test_diagnostic_separates_reviewed_nonreal_from_unclosed_risk(self):
        candidates = {4000:[],4001:[m.Recipe(4001,'C',(4000,))]}
        result = m.uncovered_diagnostics(candidates,{}, {4000:3,4001:3},
            {'triangles':{}}, {}, set(), {}, (6,None,1), {4000:'nonreal'})
        a,b = result['entries']
        self.assertEqual(a['primary'],'reviewed_nonreal_domain')
        self.assertEqual(a['candidate_primary'],'no_parsed_candidate')
        self.assertEqual(b['primary'],'unclosed_dependency')
        self.assertEqual(b['possible_complex_dependencies'],[4000])
        self.assertEqual(result['count'],2)

    def test_reviewed_etc_roots_keep_conditional_points_eligible(self):
        domains = {}
        recipes = m.read_recipes(m.DATA/'seeds.txt',{},domains)
        self.assertEqual({n:domains[n] for n in range(5000,5004)},
                         dict.fromkeys(range(5000,5004),'conditional_complex'))
        self.assertEqual({n for n,v in domains.items() if v=='nonreal'}, {39160,39161,39164,39165})
        self.assertFalse(set(domains) & set(recipes))

    def test_5002_5003_complex_midpoint_is_real_on_both_atlas_shapes(self):
        atlas = m.read_native_atlas(m.CACHE/'native-atlas.json')
        native = m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        real_cases, complex_cases = 0,0
        for shape,abc in atlas['triangles'].items():
            env = m.side_environment(math.dist(abc[1],abc[2]),math.dist(abc[2],abc[0]),math.dist(abc[0],abc[1]))
            E,F = env['E'],env['F']
            root = cmath.sqrt(F*(E+F))
            pair = []
            for sign in (1,-1):
                u,v = 3*(E+2*F+sign*2*root),-2*(E+F+sign*root)
                pair.append(tuple((u*native[shape][2][i]+v*native[shape][4][i])/(u+v) for i in (0,1)))
            is_complex = any(abs(z.imag)>1e-8 for point in pair for z in point)
            complex_cases += is_complex
            real_cases += not is_complex
            for i in (0,1):
                midpoint = (pair[0][i]+pair[1][i])/2
                self.assertLess(abs(midpoint-native[shape][858][i]),1e-8)
        self.assertGreater(real_cases,0)
        self.assertGreater(complex_cases,0)
