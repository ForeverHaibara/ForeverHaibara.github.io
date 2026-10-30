"""Check available simple catalogue points using exact barycentric arithmetic."""
import json
from generate_related_curves import SOURCE, parse_equation, a2, b2, c2, u, v, w, s
from generate_related_curves import a as side_a, b as side_b, c as side_c
from related_curve_points import centers, orthic_feet

midpoints = {'Q036A': (0, 1, 1), 'Q036B': (1, 0, 1), 'Q036C': (1, 1, 0)}
sample_coordinates = {'(B+C)/2': (0,1,1), '(C+A)/2': (1,0,1), '(A+B)/2': (1,1,0),
                      '-A+B+C': (-1,1,1), 'A-B+C': (1,-1,1), 'A+B-C': (1,1,-1)}

excenter_a = '((-Distance(B,C))*A+Distance(C,A)*B+Distance(A,B)*C)/(-Distance(B,C)+Distance(C,A)+Distance(A,B))'
midpoint_incenter_excenter_a = f'(TriangleCenter(A,B,C,1)+{excenter_a})/2'

records = json.loads(SOURCE.read_text(encoding='utf8'))

for record in records:
    equation = parse_equation(record['equation'])
    count = 0
    for a, b, c in [(13, 14, 15), (5, 6, 7), (7, 8, 9)]:
        aa, bb, cc = a*a, b*b, c*c
        points = centers(a, b, c)
        ex = (-a, b, c)
        inc = (a, b, c)
        halfway = tuple(inc[i]*sum(ex) + ex[i]*sum(inc) for i in range(3))
        samples = sample_coordinates | orthic_feet(a, b, c) | {excenter_a: ex, midpoint_incenter_excenter_a: halfway}
        candidates = [(f'X({index})', points[index]) for index in record['centers'] if index in points]
        if record['id'] in midpoints and midpoints[record['id']] not in [samples.get(point) for point in record.get('samplePoints', [])]:
            candidates.append(('opposite midpoint', midpoints[record['id']]))
        candidates.extend((point, samples[point]) for point in record.get('samplePoints', []) if point in samples)
        candidates.extend((f'projective {point}', tuple(point)) for point in record.get('projectivePoints', []))
        for label, coordinates in candidates:
            value = equation.subs({side_a: a, side_b: b, side_c: c, a2: aa, b2: bb, c2: cc, u: coordinates[0], v: coordinates[1], w: coordinates[2]})
            if value != 0:
                raise SystemExit(f"{record['id']} {label} on {a},{b},{c}: residual {value}")
            count += 1
    print(f"{record['id']}: {count} exact incidence checks")

# Derived definitions are checked symbolically against the source relationships.
def equation_for(identifier):
    return parse_equation(next(record['equation'] for record in records if record['id'] == identifier))

q034 = equation_for('Q034')
q036_sum = sum(equation_for(identifier) for identifier in ('Q036A', 'Q036B', 'Q036C'))
assert s.expand(2*q034 - q036_sum) == 0, 'Q034 must equal half the sum of Q036A/B/C'
complement = q034.subs({u:v+w, v:w+u, w:u+v}, simultaneous=True)
assert s.expand(equation_for('Q074') - complement) == 0, 'Q074 must be the anticomplement of Q034'
sa, sb, sc = (b2+c2-a2)/2, (c2+a2-b2)/2, (a2+b2-c2)/2
polar = a2*sa*s.diff(q034,u) + b2*sb*s.diff(q034,v) + c2*sc*s.diff(q034,w)
assert s.expand(equation_for('Q099') - polar) == 0, 'Q099 must be the polar of O in Q034'
print('Q034/Q074/Q099: derived relationships checked symbolically')

# Q201 is the homothetic image of Q200 about the incenter with ratio 1/2.
for side_a_value, side_b_value, side_c_value in [(13, 14, 15), (5, 6, 7)]:
    values = {side_a:side_a_value, side_b:side_b_value, side_c:side_c_value,
              a2:side_a_value**2, b2:side_b_value**2, c2:side_c_value**2}
    side_sum = side_a_value + side_b_value + side_c_value
    coord_sum = u+v+w
    pullback = equation_for('Q200').subs(values).subs(
        {u:2*side_sum*u-side_a_value*coord_sum, v:2*side_sum*v-side_b_value*coord_sum,
         w:2*side_sum*w-side_c_value*coord_sum}, simultaneous=True)
    ratio = s.cancel(pullback / equation_for('Q201').subs(values))
    assert ratio != 0 and not ratio.free_symbols, 'Q200/Q201 homothety mismatch'
print('Q200/Q201: homothety checked on two exact triangles')

# The pages state these pairs are isogonal transforms. Homogenize the
# isogonal substitution and compare symbolically, including the expected
# side-length and barycentric factors removed from the transformed equation.
for source_id, target_id, factor in [
    ('Q042', 'Q043', -a2*b2*c2*u**2*v**2*w**2),
    ('Q083', 'Q084', -a2*b2*c2*u*v*w),
]:
    transformed = equation_for(source_id).subs(
        {u:a2*v*w, v:b2*w*u, w:c2*u*v}, simultaneous=True)
    assert s.expand(transformed-factor*equation_for(target_id)) == 0, f'{source_id}/{target_id} isogonal relationship mismatch'
    print(f'{source_id}/{target_id}: isogonal relationship checked symbolically')
