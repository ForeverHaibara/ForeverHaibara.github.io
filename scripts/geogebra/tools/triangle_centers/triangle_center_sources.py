"""Apply reviewed corrections when their erroneous source content is present."""
import hashlib
import re
from triangle_center_support import report

def prepare_source(part, source):
    if part not in (1, 6, 28, 29, 31, 34, 35, 36):
        return source
    digest = hashlib.sha256(source.encode()).hexdigest()
    quarantined = []
    if part == 6:
        # X(10043)'s literal broken tag joins its incidence list to q=cos(...).
        source = source.replace('p&gt;X(10043) lies on these lines:', '</p><p>X(10043) lies on these lines:')
    elif part in (1, 31, 35):
        number = {1: 164, 31: 60349, 35: 68618}[part]
        source = source.replace(f'<h3 id="X{number}">X({number} =',
                                f'<h3 id="X{number}">X({number}) =')
    elif part == 28:
        source = source.replace('id="X54357)"', 'id="X54357"')
        headings = list(re.finditer(r'<h3\b[^>]*\bid="X(\d+)"[^>]*>', source, re.I))
        copies = [(h.start(), headings[j+1].start() if j+1<len(headings) else len(source))
                  for j,h in enumerate(headings) if h[1] == '54980']
        if len(copies) > 1:
            fragments = [re.sub(r'\s+', '', source[slice(*copy)]) for copy in copies]
            if len(set(fragments)) != 1:
                raise ValueError('X(54980) duplicate entries differ; review before import')
            for start, end in reversed(copies[:-1]):
                source = source[:start] + source[end:]
    elif part == 29:
        source = source.replace('<h3 id="X57621">X(57622)', '<h3 id="X57621">X(57621)')
    elif part == 34:
        source = source.replace('id="X67713 "', 'id="X67713"')
        # Two different entries claim the same ID. Isolate BOTH complete
        # fragments, preserving every following boundary; never guess a new ID.
        headings = list(re.finditer(r'<h3\b[^>]*\bid="X(\d+)"[^>]*>', source, re.I))
        duplicates = [j for j, heading in enumerate(headings) if heading[1] == '66288']
        if len(duplicates) > 1:
            quarantined = [66288]
        for j in reversed(duplicates if quarantined else []):
            if headings[j][1] == '66288':
                end = headings[j+1].start() if j+1<len(headings) else len(source)
                source = source[:headings[j].start()] + source[end:]
    elif part == 36:
        source = source.replace('<h3 id="X71412">X(714112)', '<h3 id="X71412">X(71412)')
    report('source-patch', part=part, source_sha256=digest, quarantined=quarantined)
    return source
