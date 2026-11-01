"""Regression checks for import boundaries, cache invalidation and seed directives."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import triangle_center_import as importer
from triangle_center_support import heading_issues


class ImportInfrastructureTest(unittest.TestCase):
    def test_preflight_recognizes_missed_boundaries_and_conflicting_titles(self):
        for anchor, title in [('X54357)', 54357), ('X67713 ', 67713), ('X57621', 57622)]:
            self.assertTrue(heading_issues(f'<h3 id="{anchor}">X({title}) = CENTER</h3>'))
        self.assertTrue(heading_issues('<h3 id="X4000">X(4000)</h3>' * 2))
        self.assertEqual(heading_issues('<h3 id="X4000">X(4000) = CENTER</h3>'), [])

    def test_seed_skip_is_explicit_and_cannot_conflict(self):
        with tempfile.TemporaryDirectory(dir=importer.CACHE) as folder:
            path = Path(folder) / 'seeds.txt'
            path.write_text('4000 SKIP source-error: conflicting definitions # reviewed\n4001 M 1 2 # source\n')
            skipped = {}
            self.assertEqual(set(importer.read_recipes(path, skipped)), {4001})
            self.assertEqual(skipped, {4000: 'source-error: conflicting definitions'})
            with self.assertRaises(ValueError):
                importer.read_recipes(path)  # Runtime chunks cannot contain directives.
            path.write_text('4000 SKIP reason\n4000 M 1 2\n')
            with self.assertRaises(ValueError):
                importer.read_recipes(path, {})

    def test_page_cache_preserves_evidence_and_invalidates_inputs(self):
        with tempfile.TemporaryDirectory(dir=importer.CACHE) as folder, patch.object(importer, 'CACHE', Path(folder)):
            page = Path(folder) / 'ETCPart3.html'
            page.write_text('<h3 id="X4000">X(4000) = midpoint of X(1) and X(2)</h3>')
            original = importer.extract_entry
            with patch.object(importer, 'extract_entry', wraps=original) as extract:
                cold = importer.read_page(3)
                self.assertEqual(importer.read_page(3), cold)
                self.assertEqual(extract.call_count, 1)
                importer.read_page(3, {2})
                self.assertEqual(extract.call_count, 2)
                for cache in (Path(folder) / 'extracted').glob('*.gz'):
                    cache.write_bytes(b'broken')
                self.assertEqual(importer.read_page(3), cold)
                self.assertEqual(extract.call_count, 3)
                page.write_text('<h3 id="X4000">X(4000) = midpoint of X(1) and X(3)</h3>')
                self.assertNotEqual(importer.read_page(3), cold)
                page.write_text('<h3 id="X4000)">X(4000) = midpoint of X(1) and X(3)</h3>')
                with self.assertRaisesRegex(ValueError, 'preflight'):
                    importer.read_page(3)


if __name__ == '__main__':
    unittest.main()
