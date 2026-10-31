"""Authoring-format tests; run with Python + SymPy."""
import copy
import unittest
from generate_related_curves import pool_recipes


class TemplatePoolTests(unittest.TestCase):
    def setUp(self):
        self.recipe={'degree':3,'monomials':[[3,0,0]],'terms':[[3,0,'k0*p0^3']],
                     'locals':[],'coefficients':['a2']}

    def test_exact_sharing_and_reconstruction(self):
        second=copy.deepcopy(self.recipe)
        second['locals']=[['h0','b2^2']]
        second['coefficients']=['h0']
        original={'Q001':self.recipe,'Q002':second}
        pooled=pool_recipes(original)
        self.assertEqual(len(pooled['templates']),1)
        for key,recipe in original.items():
            curve=pooled['curves'][key]
            restored=dict(pooled['templates'][curve['template']],locals=curve['locals'],coefficients=curve['coefficients'])
            self.assertEqual(restored,recipe)

    def test_template_ids_do_not_depend_on_catalogue_insertion_order(self):
        other=dict(self.recipe,monomials=[[0,3,0]],terms=[[0,3,'k0*p4^3']])
        forward=pool_recipes({'Q001':self.recipe,'Q002':other})
        reverse=pool_recipes({'Q002':other,'Q001':self.recipe})
        self.assertEqual(forward,reverse)
        self.assertEqual(len(forward['templates']),2)

    def test_same_support_with_different_arithmetic_must_not_merge(self):
        other=dict(self.recipe,terms=[[3,0,'p0^3*k0']])
        with self.assertRaisesRegex(ValueError,'incompatible formulas'):
            pool_recipes({'Q001':self.recipe,'Q002':other})

    def test_rejects_bad_coefficient_mapping(self):
        with self.assertRaisesRegex(ValueError,'coefficient count'):
            pool_recipes({'Q001':dict(self.recipe,coefficients=[])})
        with self.assertRaisesRegex(ValueError,'canonical'):
            pool_recipes({'Q001':dict(self.recipe,monomials=[[3,0,0],[3,0,0]])})


if __name__=='__main__':unittest.main()
