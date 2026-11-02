"""Regression checks for import boundaries, cache invalidation and seed directives."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import triangle_center_import as importer


class ImportInfrastructureTest(unittest.TestCase):

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
            page.write_text('<h3 id="X4000">X(4000) = midpoint of X(1) and X(2)</h3>'
                            '<p>X(4000) lies on these lines: 1,2 3,4 5,6</p>')
            original = importer.extract_entry
            with patch.object(importer, 'extract_entry', wraps=original) as extract:
                cold_metadata,warm_metadata = {},{}
                cold = importer.read_page(3,metadata=cold_metadata)
                warm = importer.read_page(3,metadata=warm_metadata)
                self.assertEqual(cold_metadata,warm_metadata)
                self.assertEqual(cold_metadata[4000]['title'],'midpoint of X(1) and X(2)')
                self.assertEqual(warm, cold)
                self.assertEqual(set(warm[1][4000]), set(cold[1][4000]))
                self.assertEqual(len(list(warm[1][4000].inferred())), 3)
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
