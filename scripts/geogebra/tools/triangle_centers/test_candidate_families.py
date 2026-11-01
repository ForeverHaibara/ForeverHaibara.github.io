"""Lazy families preserve alternatives while explicit definitions bypass expansion."""
from unittest import TestCase
from unittest.mock import patch

from compact_topology_cache import pack, unpack, ranges
from triangle_center_import import Recipe, RecipeCandidates, extract_entry, select_recipes


class CandidateFamilyTest(TestCase):
    def test_lazy_extraction_has_the_same_recipes_and_evidence(self):
        fragment = ('<h3 id="X4000">X(4000) = intersection of X(1)X(2) and X(3)X(4)</h3>'
                    '<p>X(4000) lies on these lines: 1,2 3,4 5,6 7,8</p>')
        eager = extract_entry(4000, fragment, 3)
        lazy = extract_entry(4000, fragment, 3, compact=True)
        self.assertIsInstance(lazy, RecipeCandidates)
        self.assertEqual(set(lazy), set(eager))
        self.assertEqual(len(lazy.explicit), 1)
        filtered = lazy.filtered(lambda r: r.operation != 'J')
        self.assertEqual(list(filtered), [])

    def test_valid_explicit_intersection_never_expands_line_pairs(self):
        explicit = Recipe(4000, 'J', (1, 2, 3, 4), evidence='explicit intersection')
        pool = RecipeCandidates(4000, [explicit], [(1, 2), (3, 4), (5, 6)])
        with patch.object(RecipeCandidates, 'inferred', side_effect=AssertionError('unnecessary expansion')):
            selected = select_recipes({4000: pool}, {}, 6, None)
        self.assertEqual(selected[4000], explicit)

    def test_unclosed_explicit_definition_falls_back_to_inferred_pair(self):
        explicit = Recipe(4000, 'M', (9999, 1))
        pool = RecipeCandidates(4000, [explicit], [(1, 2), (3, 4)])
        selected = select_recipes({4000: pool}, {}, 6, None)
        self.assertEqual(selected[4000].operation, 'J')
        self.assertEqual(selected[4000].references, (1, 2, 3, 4))

    def test_failed_numeric_candidate_does_not_block_next_pair(self):
        points = {1: (0, 0), 2: (1, 0), 3: (0, 1), 4: (1, 1), 5: (0, -1), 6: (0, 2)}
        atlas = dict(triangles={'sample': [(0, 0), (6, 0), (1, 4)]},
                     coordinates={'sample': {str(n): xy for n, xy in points.items()}})
        # An explicit list, rather than incidence evidence, isolates pair fallback
        # from the independent third-line consistency requirement.
        options = [Recipe(4000, 'J', (1, 2, 3, 4)), Recipe(4000, 'J', (1, 2, 5, 6))]
        selected = select_recipes({4000: options}, {}, 6, None, atlas=atlas)
        self.assertEqual(selected[4000].references, (1, 2, 5, 6))

    def test_late_third_support_line_reactivates_target(self):
        pool = RecipeCandidates(4000, [], [(1, 2), (3, 4), (5, 4001)])
        points = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1),
                  5: (2, 2), 6: (0, 0), 7: (2, 2)}
        atlas = dict(triangles={'sample': [(0, 0), (6, 0), (1, 4)]},
                     coordinates={'sample': {str(n): xy for n, xy in points.items()}})
        selected = select_recipes({4000: pool, 4001: [Recipe(4001, 'M', (6, 7))]},
                                  {}, 6, None, atlas=atlas)
        self.assertEqual(set(selected), {4000, 4001})
        self.assertEqual(selected[4000].references, (1, 2, 3, 4))


class TopologyEncodingTest(TestCase):
    def test_range_and_adjacency_roundtrip_with_gaps_and_empty_rows(self):
        record = dict(entries=[3000, 3001, 3002, 4000], structurally_direct=[3001, 3002],
                      adjacency={'3001': [4000, 4001, 73269], '3002': [], '4000': [3001]},
                      source_sha256='sample', alternatives=[3, 0, 2])
        self.assertEqual(unpack(pack(record)), record)
        self.assertEqual(ranges([3000, 3001, 3002, 4000]), [[3000, 3002], [4000, 4000]])
        with self.assertRaises(ValueError):
            ranges([2, 1])
