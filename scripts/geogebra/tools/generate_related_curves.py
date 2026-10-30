"""Generate small, offline polynomial recipes. Requires Python + SymPy.

The hand-maintained JSON is the definition source. Only arithmetic, nonnegative
integer powers, cyclic() and cyclicProduct() are accepted; no eval/sympify of
source text. Run from any directory; --check verifies the committed output.
"""
import argparse
import ast
import json
from functools import lru_cache
from pathlib import Path
import sympy as s

ROOT = Path(__file__).resolve().parents[3]
CUSTOM = ROOT / 'src/features/geogebra/commands/custom'
SOURCE = CUSTOM / 'data/related-curves/curves.json'
OUTPUT = CUSTOM / 'generated/relatedCurves.json'
a2, b2, c2, u, v, w, x, y = s.symbols('a2 b2 c2 u v w x y')
a, b, c = s.symbols('a b c')
SYMBOLS = dict(zip(('a2', 'b2', 'c2', 'u', 'v', 'w'), (a2, b2, c2, u, v, w)))
SYMBOLS.update(a=a, b=b, c=c, sa=(b2+c2-a2)/2, sb=(c2+a2-b2)/2, sc=(a2+b2-c2)/2)
ROTATE = {a2: b2, b2: c2, c2: a2, a: b, b: c, c: a, u: v, v: w, w: u}


def parse_equation(text):
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return s.Integer(node.value)
        if isinstance(node, ast.Name) and node.id in SYMBOLS:
            return SYMBOLS[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            return visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        if isinstance(node, ast.BinOp):
            if isinstance(node.op, (ast.Add, ast.Sub)):
                pending, terms = [(node, 1)], []
                while pending:
                    item, sign = pending.pop()
                    if isinstance(item, ast.BinOp) and isinstance(item.op, (ast.Add, ast.Sub)):
                        pending.append((item.left, sign))
                        pending.append((item.right, -sign if isinstance(item.op, ast.Sub) else sign))
                    else:
                        terms.append(sign * visit(item))
                return s.Add(*terms)
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Mult): return left * right
            if isinstance(node.op, ast.Pow) and right.is_Integer and 0 <= right <= 12: return left ** right
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and len(node.args) == 1 and not node.keywords:
            term = visit(node.args[0])
            terms = [term, term.xreplace(ROTATE), term.xreplace(ROTATE).xreplace(ROTATE)]
            if node.func.id == 'cyclic': return sum(terms)
            if node.func.id == 'cyclicProduct': return s.prod(terms)
        raise ValueError(f'Unsupported equation syntax: {ast.dump(node)}')
    return s.expand(visit(ast.parse(text.replace('^', '**'), mode='eval').body))


@lru_cache(maxsize=None)
def cartesian_terms(monomials, compact):
    """Compile the common frame once for each barycentric monomial pattern."""
    frame_values = s.symbols('p0:9')
    frame = [frame_values[3*i]*x+frame_values[3*i+1]*y+frame_values[3*i+2] for i in range(3)]
    weights = s.symbols(f'k0:{len(monomials)}')
    world = s.Poly(sum(k*s.prod(frame[i]**power for i, power in enumerate(monomial))
                       for monomial, k in zip(monomials, weights)), x, y)
    coefficients = world.coeffs()
    if compact:
        # Keep degree >= 7 within the existing named-expression budget without
        # changing the polynomial or introducing hundreds of helper objects.
        # Interleaving the three barycentric frame rows keeps the denser
        # degree-seven patterns within the named-expression budget.
        order = ([frame_values[i] for i in (0,3,6,1,4,7,2,5,8)]
                 if sum(monomials[0]) == 7 and len(monomials) >= 24 else frame_values)
        coefficients = [s.factor_terms(s.horner(value, *order, *weights)) for value in coefficients]
    return tuple((i, j, s.sstr(value).replace('**', '^'))
                 for (i, j), value in zip(world.monoms(), coefficients))


def generate(records):
    result = {}
    seen = set()
    for record in records:
        key = record['id']
        if key in seen: raise ValueError(f'Duplicate ID: {key}')
        seen.add(key)
        f = parse_equation(record['equation'])
        poly = s.Poly(f, u, v, w)
        if poly.is_zero or {sum(m) for m in poly.monoms()} != {record['degree']}:
            raise ValueError(f'{key}: incorrect degree/homogeneity')
        if 'alternateEquation' in record:
            other = parse_equation(record['alternateEquation'])
            if not other or s.cancel(f / other).free_symbols & {u, v, w}:
                raise ValueError(f'{key}: alternate equation is not proportional')
        if record.get('backend'):
            if record['backend'] != 'similarityPolynomial':
                raise ValueError(f'{key}: unknown opt-in backend {record["backend"]}')
            # Separately generated and verified by generate_related_curve_circuits.py.
            # Do not expand a specialized construction back into world coefficients.
            continue
        replacements, coefficients = s.cse([s.factor(c) for c in poly.coeffs()], symbols=s.numbered_symbols('h'))
        if len(replacements) > 100:
            replacements, coefficients = [], [s.factor(c) for c in poly.coeffs()]
        # The world frame depends only on the monomial pattern, so repeated
        # patterns share the same offline work and need no runtime CAS.
        terms = cartesian_terms(tuple(poly.monoms()), record['degree'] >= 7)
        render = lambda value: s.sstr(value).replace('**', '^')
        result[key] = {
            'degree': record['degree'],
            'locals': [[str(name), render(value)] for name, value in replacements],
            'coefficients': [render(value) for value in coefficients],
            'monomials': [list(m) for m in poly.monoms()],
            'terms': [list(term) for term in terms],
        }
    return json.dumps(result, indent=2, ensure_ascii=False) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = generate(json.loads(SOURCE.read_text(encoding='utf8')))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf8') != text:
            raise SystemExit('Generated curve recipes are stale. Run generate_related_curves.py.')
        print('Related curve recipes are up to date.')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(text, encoding='utf8')
        print(f'Generated {OUTPUT.relative_to(ROOT)}')
