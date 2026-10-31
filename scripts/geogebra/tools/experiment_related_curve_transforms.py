"""Offline research: compare isogonal transforms against recorded equations.

Pass the locally cached candidate JSON from inspect_related_curve_candidates.py.
This script does not write the database or production recipes.
"""
import argparse
import json
import sys
from pathlib import Path
import sympy as s
from generate_related_curves import SOURCE, parse_equation, a2, b2, c2, u, v, w


def transform(f):
    p = s.Poly(f, u, v, w)
    degree = p.total_degree()
    # (a²/u:b²/v:c²/w), multiplied by (uvw)^degree.
    terms = [((degree-i, degree-j, degree-k), coeff*a2**i*b2**j*c2**k)
             for (i, j, k), coeff in p.terms()]
    factors = tuple(min(m[n] for m, _ in terms) for n in range(3))
    result = sum(coeff*u**(m[0]-factors[0])*v**(m[1]-factors[1])*w**(m[2]-factors[2])
                 for m, coeff in terms)
    return s.Poly(result, u, v, w), factors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidates', type=Path)
    args = parser.parse_args()
    records = json.loads(SOURCE.read_text(encoding='utf8'))
    candidates = json.loads(args.candidates.read_text(encoding='utf8'))
    records += candidates['candidates'] if isinstance(candidates,dict) else candidates
    by_id = {r['id']: r for r in records}
    for source, target in [('Q008','Q007'), ('Q071','Q001'), ('Q010','Q009'),
                           ('Q037','Q030'), ('Q097','Q096'), ('Q023','Q038')]:
        left, factors = transform(parse_equation(by_id[source]['equation']))
        right = s.Poly(parse_equation(by_id[target]['equation']), u, v, w)
        if left.monoms() != right.monoms():
            print(source, target, 'different supports', flush=True)
            continue
        # Check a single global rational factor including possible side factors.
        ratio = s.factor(s.cancel(left.coeffs()[0] / right.coeffs()[0]))
        equal = all(s.expand(a - ratio*b) == 0 for a, b in zip(left.coeffs(), right.coeffs()))
        print(f'{source}->{target}: factors uvw={factors}, ratio={ratio}, '
              f'monomials={len(right.monoms())}, equal={equal}, '
              f'source_chars={len(by_id[source]["equation"])}, '
              f'target_chars={len(by_id[target]["equation"])}', flush=True)
        if not equal:
            sys.exit(1)


if __name__ == '__main__':
    main()
