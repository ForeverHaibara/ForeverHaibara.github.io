"""Check available simple catalogue points using exact barycentric arithmetic."""
import json
from generate_related_curves import SOURCE, parse_equation, a2, b2, c2, u, v, w, s

midpoints = {'Q036A': (0, 1, 1), 'Q036B': (1, 0, 1), 'Q036C': (1, 1, 0)}
sample_coordinates = {'(B+C)/2': (0,1,1), '(C+A)/2': (1,0,1), '(A+B)/2': (1,1,0),
                      '-A+B+C': (-1,1,1), 'A-B+C': (1,-1,1), 'A+B-C': (1,1,-1)}

for record in json.loads(SOURCE.read_text(encoding='utf8')):
    equation = parse_equation(record['equation'])
    count = 0
    for a, b, c in [(13, 14, 15), (5, 6, 7)]:
        aa, bb, cc = a*a, b*b, c*c
        sa = s.Rational(bb + cc - aa, 2)
        sb = s.Rational(cc + aa - bb, 2)
        sc = s.Rational(aa + bb - cc, 2)
        points = {1: (a, b, c), 2: (1, 1, 1), 3: (aa*sa, bb*sb, cc*sc), 6: (aa, bb, cc)}
        candidates = [(f'X({index})', points[index]) for index in record['centers'] if index in points]
        if record['id'] in midpoints and midpoints[record['id']] not in [sample_coordinates.get(point) for point in record.get('samplePoints', [])]:
            candidates.append(('opposite midpoint', midpoints[record['id']]))
        candidates.extend((point, sample_coordinates[point]) for point in record.get('samplePoints', []) if point in sample_coordinates)
        for label, coordinates in candidates:
            value = equation.subs({a2: aa, b2: bb, c2: cc, u: coordinates[0], v: coordinates[1], w: coordinates[2]})
            if value != 0:
                raise SystemExit(f"{record['id']} {label} on {a},{b},{c}: residual {value}")
            count += 1
    print(f"{record['id']}: {count} exact incidence checks")
