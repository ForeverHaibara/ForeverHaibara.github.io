"""Check available simple catalogue points using exact barycentric arithmetic."""
import json
from generate_related_curves import SOURCE, parse_equation, a2, b2, c2, u, v, w, s

aa, bb, cc = 13**2, 14**2, 15**2
sa = s.Rational(bb + cc - aa, 2)
sb = s.Rational(cc + aa - bb, 2)
sc = s.Rational(aa + bb - cc, 2)
points = {1: (13, 14, 15), 2: (1, 1, 1), 3: (aa*sa, bb*sb, cc*sc), 6: (aa, bb, cc)}
midpoints = {'Q036A': (0, 1, 1), 'Q036B': (1, 0, 1), 'Q036C': (1, 1, 0)}

for record in json.loads(SOURCE.read_text(encoding='utf8')):
    equation = parse_equation(record['equation'])
    candidates = [(f'X({index})', points[index]) for index in record['centers'] if index in points]
    if record['id'] in midpoints:
        candidates.append(('opposite midpoint', midpoints[record['id']]))
    for label, coordinates in candidates:
        value = equation.subs({a2: aa, b2: bb, c2: cc, u: coordinates[0], v: coordinates[1], w: coordinates[2]})
        if value != 0:
            raise SystemExit(f"{record['id']} {label}: residual {value}")
    print(f"{record['id']}: {len(candidates)} exact incidence checks")
