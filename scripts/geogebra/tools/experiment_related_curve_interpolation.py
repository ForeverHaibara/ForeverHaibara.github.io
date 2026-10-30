"""Research prototype for total-degree polynomial interpolation, not a builder.

Estimates named-expression sizes and checks exact arithmetic on an integer
triangle. No GeoGebra calls and no writes to the curve database.
"""
import argparse
import json
import math
import random
import re
from pathlib import Path
import sympy as s
from generate_related_curves import SOURCE, parse_equation, a, b, c, a2, b2, c2, u, v, w


def run(record):
    poly = s.Poly(parse_equation(record['equation']), u, v, w)
    degree = record['degree']
    replacements, coefficients = s.cse([s.factor(c) for c in poly.coeffs()], symbols=s.numbered_symbols('h'))
    if len(replacements) > 100:
        replacements, coefficients = [], [s.factor(c) for c in poly.coeffs()]
    k = s.symbols(f'k0:{len(poly.monoms())}')
    generic = sum(ki*u**i*v**j*w**z for ki,(i,j,z) in zip(k,poly.monoms()))
    horner = s.horner(generic, u, v, w)
    # Upper-size model: every bound value is replaced by the same placeholder
    # length as a typical named intermediate, including substitution brackets.
    name = '(ggbaux0123456789abcdefnv000)'
    total_samples = 0
    for i in range(degree+1):
        for j in range(degree+1-i):
            linear = [s.Symbol(f'p{3*t}')*i+s.Symbol(f'p{3*t+1}')*j+s.Symbol(f'p{3*t+2}') for t in range(3)]
            expr = str(horner.xreplace(dict(zip((u,v,w),linear)))).replace('**','^')
            expr = re.sub(r'\b(?:p|k)\d+\b', name, expr)
            total_samples += len(expr)
    # Interpolation: sum Δx^i Δy^j f(0,0) binom(x,i)binom(y,j).
    # Finite differences use samples at (p,q), p+q <= degree.
    points = (degree+1)*(degree+2)//2
    references = sum((i+1)*(j+1) for i in range(degree+1) for j in range(degree+1-i))
    local_count = 3 + len(replacements) + len(coefficients) + 9 + points
    estimated_output = total_samples + references*(len(name)+12) + points*100
    print(f'{record["id"]}: degree={degree}, monomials={len(coefficients)}, '
          f'locals={len(replacements)}, sample bindings={points}, '
          f'estimated bindings={local_count}, sample_expr_chars={total_samples}, '
          f'rough total chars={estimated_output}, difference_references={references}', flush=True)
    # Exact integer test: compare a random bivariate polynomial at random integer
    # coordinates with its forward-difference/Newton reconstruction.
    rng = random.Random(1030 + degree)
    coeff = {(i,j):rng.randint(-9,9) for i in range(degree+1) for j in range(degree+1-i)}
    def f(x,y): return sum(c*x**i*y**j for (i,j),c in coeff.items())
    samples = {(i,j):f(i,j) for i in range(degree+1) for j in range(degree+1-i)}
    def choose(x,n):
        return math.prod(x-i for i in range(n))//math.factorial(n)
    for x,y in [(-3,2),(3,-2),(8,7)]:
        got = sum(sum((-1)**(i+j-p-q)*math.comb(i,p)*math.comb(j,q)*samples[p,q]
                      for p in range(i+1) for q in range(j+1))*choose(x,i)*choose(y,j)
                  for i in range(degree+1) for j in range(degree+1-i))
        assert got == f(x,y)
    print(f'{record["id"]}: exact integer interpolation samples passed', flush=True)
    # A concrete nondegenerate triangle A=(0,0), B=(7,0), C=(2,5),
    # preserving the common homogeneous frame rather than normalizing it.
    actual = poly.as_expr().subs({a2:50,b2:29,c2:49,a:s.sqrt(50),b:s.sqrt(29),c:7})
    def curve(x,y):
        return actual.subs({u:-5*x-5*y+35,v:5*x-2*y,w:7*y})
    samples = {(i,j):curve(i,j) for i in range(degree+1) for j in range(degree+1-i)}
    for x,y in [(-3,2),(3,-2),(8,7)]:
        got = sum(sum((-1)**(i+j-p-q)*math.comb(i,p)*math.comb(j,q)*samples[p,q]
                      for p in range(i+1) for q in range(j+1))*choose(x,i)*choose(y,j)
                  for i in range(degree+1) for j in range(degree+1-i))
        assert s.simplify(got-curve(x,y)) == 0
    print(f'{record["id"]}: actual equation on concrete triangle passed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidates', type=Path)
    args = parser.parse_args()
    records = json.loads(SOURCE.read_text(encoding='utf8')) + json.loads(args.candidates.read_text(encoding='utf8'))['candidates']
    by_id = {r['id']:r for r in records}
    for identifier in ('Q001', 'Q008', 'Q007', 'Q018', 'Q070', 'Q109'):
        run(by_id[identifier])
    # A small counterexample to treating exact interpolation as stable in
    # floating point: an affine translation moves the relevant root far from
    # the grid. This is not a GeoGebra benchmark.
    for shift in (0, 10, 100, 1000):
        samples = [float((i-shift)**8) for i in range(9)]
        differences = [sum((-1)**(i-j)*math.comb(i,j)*samples[j] for j in range(i+1)) for i in range(9)]
        value = sum(differences[i]*math.comb(shift,i) for i in range(9))
        print(f'translated (x-{shift})^8 at root: exact=0, floating={value}', flush=True)
