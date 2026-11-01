"""Failure reports distinguish source, graph, resource and formula blockers."""
from unittest import TestCase
import triangle_center_import as m
from triangle_center_support import extraction_source_fingerprint


class UncoveredDiagnosticsTest(TestCase):
    def test_solver_and_report_edits_do_not_invalidate_extraction(self):
        source = "VALUE = 3\ndef extract_entry(x):\n    return x+1\ndef select_recipes(x):\n    return x\n"
        original = extraction_source_fingerprint(source)
        self.assertEqual(original, extraction_source_fingerprint(source.replace('return x\n', 'return x*2\n')))
        self.assertNotEqual(original, extraction_source_fingerprint(source.replace('return x+1', 'return x+2')))
        self.assertNotEqual(original, extraction_source_fingerprint(source.replace('VALUE = 3', 'VALUE = 4')))
        helper = 'def extract_entry(x):\n    return helper(x)\ndef helper(x):\n    return x+1\n'
        self.assertNotEqual(extraction_source_fingerprint(helper),
                            extraction_source_fingerprint(helper.replace('return x+1', 'return x+2')))

    def test_candidate_blockers_do_not_collapse_to_unsupported(self):
        candidates = {
            4000: [], 4001: [m.Recipe(4001, 'M', (7000, 1))],
            4002: [m.Recipe(4002, 'M', (30, 1))],
            4003: [m.Recipe(4003, 'M', (90000, 1))],
            4004: [m.Recipe(4004, 'G', (5000,))],
            4005: [m.Recipe(4005, 'B', (), formula='a+b^2')],
            4006: [m.Recipe(4006, 'B', (), formula='b-c')],
            4007: [m.Recipe(4007, 'B', (), formula='a')],
            4008: [m.Recipe(4008, 'M', (66288, 1))], 7000: []}
        atlas = dict(triangles={'shape': [(0, 0), (6, 0), (1, 4)]}, coordinates={})
        result = m.uncovered_diagnostics(candidates, {5000: m.Recipe(5000, 'G', (1,))},
                                        {n: 3 for n in candidates}, atlas, {}, {30},
                                        {66288: 'source-error'}, (6, None, 1))
        actual = {row['id']: row['primary'] for row in result['entries']}
        self.assertEqual(actual, {
            4000: 'no_parsed_candidate', 4001: 'unclosed_dependency',
            4002: 'blocked_native', 4003: 'missing_source_dependency',
            4004: 'conjugate_budget', 4005: 'nonhomogeneous_formula',
            4006: 'ideal_formula', 4007: 'coordinate_admission_or_variants',
            4008: 'reviewed_skip_dependency', 7000: 'no_parsed_candidate'})
        self.assertEqual(result['count'], sum(result['summary'].values()))
        self.assertEqual(result['skipped'], {66288: 'source-error'})
