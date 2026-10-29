"""Inspect locally downloaded Gibert pages and TXT files; never downloads or edits the database.

Usage: python scripts/geogebra/tools/inspect_related_curve_candidates.py CACHE_DIR OUTPUT.json
Candidates require a single explicitly labelled equation, an admissible degree,
and at least one source-listed simple center or midpoint checked on two exact triangles.
The output is an inspection queue and must be reviewed before importing.
"""
import json
import re
import sys
from pathlib import Path
from html.parser import HTMLParser
from generate_related_curves import SOURCE, parse_equation, a2, b2, c2, u, v, w, s


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
    def handle_data(self, data):
        self.text.append(data)


def convert(text):
    def side(match):
        exponent = int(match[2])
        if exponent % 2: raise ValueError('odd side exponent')
        return match[1] + '2' + (f'^{exponent // 2}' if exponent > 2 else '')
    text = re.sub(r'\b([abc])\^(\d+)', side, text)
    return re.sub(r'\b([xyz])\b', lambda m: {'x':'u','y':'v','z':'w'}[m[1]], ' '.join(text.split()))


def centers(a, b, c):
    aa, bb, cc = a*a, b*b, c*c
    sa = s.Rational(bb+cc-aa, 2); sb = s.Rational(cc+aa-bb, 2); sc = s.Rational(aa+bb-cc, 2)
    return {1:(a,b,c), 2:(1,1,1), 3:(aa*sa,bb*sb,cc*sc), 4:(sb*sc,sc*sa,sa*sb), 6:(aa,bb,cc)}


if __name__ == '__main__':
    cache, output = map(Path, sys.argv[1:3])
    existing = {r['id'] for r in json.loads(SOURCE.read_text(encoding='utf8'))}
    catalogue = {r['id']:r for r in json.loads((SOURCE.parent/'catalogue.json').read_text(encoding='utf8'))}
    candidates, deferred = [], []
    for file in sorted(cache.glob('curves_Resources_Q*.txt')):
        identifier = file.stem.removeprefix('curves_Resources_').upper()
        if identifier in existing or identifier not in catalogue: continue
        page = cache / f'curves_{identifier.lower()}.html'
        if not page.exists(): continue
        try:
            source = file.read_text(encoding='utf8')
            matches = re.findall(r'(?is)\b'+identifier+r'\s*:\s*(.*?)=\s*0', source)
            if len(matches) != 1: raise ValueError('ambiguous or missing labelled equation')
            expression = convert(matches[0])
            f = parse_equation(expression)
            poly = s.Poly(f,u,v,w)
            degrees = {sum(m) for m in poly.monoms()}
            if poly.is_zero or len(degrees) != 1: raise ValueError('zero or nonhomogeneous')
            degree = degrees.pop()
            expected = catalogue[identifier]['degree']
            if degree not in (3,4,5,6): raise ValueError(f'degree {degree} needs performance evaluation')
            if expected is not None and expected != degree: raise ValueError(f'catalogue degree {expected} differs from {degree}')
            html = Page(); html.feed(page.read_text(encoding='utf8'))
            content = ' '.join(html.text).split('Related Curves',1)[-1]
            # Only use points listed near the beginning, not incidental later mentions.
            prefix = content[:1600]
            mentioned = [i for i in (1,2,3,4,6) if re.search(r'X\s*\(\s*'+str(i)+r'\s*\)',prefix)]
            checked = []
            for index in mentioned:
                good = True
                for a,b,c in [(13,14,15),(5,6,7)]:
                    xyz = centers(a,b,c)[index]
                    value = f.subs({a2:a*a,b2:b*b,c2:c*c,u:xyz[0],v:xyz[1],w:xyz[2]})
                    if value != 0: good = False; break
                if good: checked.append(index)
            sample_points = []
            if re.search(r'midpoints? of ABC', prefix, re.I):
                for coords, sample_expression in [((0,1,1),'(B+C)/2'),((1,0,1),'(C+A)/2'),((1,1,0),'(A+B)/2')]:
                    if all(f.subs({a2:a*a,b2:b*b,c2:c*c,u:coords[0],v:coords[1],w:coords[2]}) == 0 for a,b,c in [(13,14,15),(5,6,7)]):
                        sample_points.append(sample_expression)
            if not checked and not sample_points: raise ValueError('no source-listed simple center or midpoint verified')
            record = {'id':identifier,'name':catalogue[identifier]['name'],'degree':degree,
                'source':'http://bernard-gibert.fr/curves/Resources/'+identifier+'.txt',
                'equation':expression,'centers':checked,
                'notes':'Barycentric equation from the linked TXT; listed test points checked on two exact triangles.'}
            if sample_points: record['samplePoints'] = sample_points
            candidates.append(record)
        except Exception as error:
            deferred.append({'id':identifier,'reason':str(error)})
    output.write_text(json.dumps({'candidates':candidates,'deferred':deferred},indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print(f'{len(candidates)} candidates; {len(deferred)} deferred; review {output}')
