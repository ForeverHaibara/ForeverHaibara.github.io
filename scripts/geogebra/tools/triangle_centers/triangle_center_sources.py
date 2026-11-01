"""Reviewed file-boundary patches, guarded by exact source snapshot hashes."""
import hashlib
import re
from triangle_center_support import report

SNAPSHOTS = {28: '9dc382cda2bd1a13568ea43375936ebdfa4f4caed9dec8b6cf26da668406c371', 29: '46f081b5c09cb2aac0523e00b312c67c96ec5a3cb2b849b28bf75c4447472da9', 34: '164f0de41e204ce098f84b627165791398770042052a30f802f8c5210175f322', 36: 'c1175b21df78ea2989247161219bd34c426866d1345178b0780f583922f1c5c4', 1: '374c222535fe737a57f52da99fdde3cec6ba01d78b1d7ad84b7588e95e8d88cf', 31: '61167d9047a440ad539a0d0335d4fb8e97334cc0418e874d686015e8d3201d91', 35: '0d59a729dbb3120d4f4057fad34333b3475236f943995855c497ade6c257ad06'}


def prepare_source(part, source):
    if part not in SNAPSHOTS:
        return source
    digest = hashlib.sha256(source.encode()).hexdigest()
    if digest != SNAPSHOTS[part]:
        raise ValueError(f'Part {part} source changed: review boundary patches before import')
    if part in (1, 31, 35):
        number = {1: 164, 31: 60349, 35: 68618}[part]
        source = source.replace(f'<h3 id="X{number}">X({number} =',
                                f'<h3 id="X{number}">X({number}) =')
    elif part == 28:
        source = source.replace('id="X54357)"', 'id="X54357"')
        headings = list(re.finditer(r'<h3\b[^>]*\bid="X(\d+)"[^>]*>', source, re.I))
        copies = [(h.start(), headings[j+1].start() if j+1<len(headings) else len(source))
                  for j,h in enumerate(headings) if h[1] == '54980']
        if len(copies) != 2 or re.sub(r'\s+', '', source[slice(*copies[0])]) != re.sub(r'\s+', '', source[slice(*copies[1])]):
            raise ValueError('Reviewed X(54980) duplicate no longer identical')
        source = source[:copies[0][0]] + source[copies[0][1]:]
    elif part == 29:
        source = source.replace('<h3 id="X57621">X(57622)', '<h3 id="X57621">X(57621)')
    elif part == 34:
        source = source.replace('id="X67713 "', 'id="X67713"')
        # Two different entries claim the same ID. Isolate BOTH complete
        # fragments, preserving every following boundary; never guess a new ID.
        headings = list(re.finditer(r'<h3\b[^>]*\bid="X(\d+)"[^>]*>', source, re.I))
        for j in reversed(range(len(headings))):
            if headings[j][1] == '66288':
                end = headings[j+1].start() if j+1<len(headings) else len(source)
                source = source[:headings[j].start()] + source[end:]
    elif part == 36:
        source = source.replace('<h3 id="X71412">X(714112)', '<h3 id="X71412">X(71412)')
    report('source-patch', part=part, source_sha256=digest, quarantined=[66288] if part == 34 else [])
    return source
