"""Source hints survive cache hits; title similarity is diagnostic only."""
from unittest import TestCase
from triangle_center_diagnostics import entry_metadata, title_groups


class TitleDiagnosticsTest(TestCase):
    def test_source_metadata_and_number_normalization(self):
        value = entry_metadata('<h3 id="X38923">X(38923) = VU 2ND PCC PERSPECTOR OF X(9)</h3><p>Barycentrics pending</p>X(38923) lies on this line: {9,3197}')
        self.assertEqual(value['title'],'VU 2ND PCC PERSPECTOR OF X(9)')
        self.assertEqual(value['source_features'],['coordinates','line_description'])
        entries = [dict(id=38923,title=value['title'],primary='no_parsed_candidate'),
                   dict(id=38910,title='VU 1ST PCC PERSPECTOR OF X(560)',primary='unclosed_dependency'),
                   dict(id=4000,title='BROCARD-CIRCLE-INVERSE OF X(9)',primary='no_parsed_candidate')]
        groups = title_groups(entries)
        self.assertEqual(len(groups),1)
        self.assertEqual(groups[0]['ids'],[38910,38923])
        self.assertEqual(groups[0]['primary_counts'],{'no_parsed_candidate':1,'unclosed_dependency':1})
        self.assertEqual(title_groups([dict(id=n,title='(name pending)',primary='no_parsed_candidate')
                                       for n in (4000,4001)]),[])
