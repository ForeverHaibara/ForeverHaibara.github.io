"""Reviewed Gemini vertex data and a deliberately narrow collineation grammar.

Production builds read the checked-in vertex table, never research statistics.
The convert command is an explicit, offline data-maintenance operation.
"""
from __future__ import annotations

import argparse
import ast
from functools import lru_cache
import hashlib
import math
from pathlib import Path
import re

from triangle_center_coordinates import (normalize_formula, validate_formula,
    homogeneous_degree, rotate_formula, side_environment, evaluate_formula)

CATALOG = Path(__file__).resolve().parents[4] / 'src/features/geogebra/commands/custom/data/triangle-centers/gemini-triangles.txt'
TAG = re.compile(r'@g([1-9]\d*)$')
# Only this complete frame is supported. Other anchors, inverse maps, triangles,
# doubled primes, and relative-triangle/conditional suffixes stay unrecognized.
COLLINEATION = re.compile(
    r"\(\s*A\s*,\s*B\s*,\s*C\s*,\s*X\s*\(\s*2\s*\)\s*;"
    r"\s*A'\s*,\s*B'\s*,\s*C'\s*,\s*X\s*\(\s*2\s*\)\s*\)"
    r"\s*COLLINEATION\s+IMAGE\s+OF\s+X\s*\(\s*(\d+)\s*\)\s*,?"
    r"\s*WHERE\s+A'\s*B'\s*C'\s*=\s*GEMINI\s+TRIANGLE\s+(\d+)[\s.;]*$", re.I)


def read_catalog(path: Path) -> dict[int, tuple[str, str, str]]:
    result = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        row = line.split('#', 1)[0].strip()
        if not row:
            continue
        number, raw = row.split(maxsplit=1)
        number = int(number)
        fields = tuple(raw.split('|'))
        if number < 1 or number in result or len(fields) != 3:
            raise ValueError(f'Invalid Gemini vertex: {line}')
        degrees = []
        for field in fields:
            validate_formula(field)
            valid, degree = homogeneous_degree(field)
            if not valid:
                raise ValueError(f'Nonhomogeneous Gemini vertex: {number}')
            if degree is not None:
                degrees.append(degree)
        if not degrees or any(not math.isclose(d, degrees[0]) for d in degrees):
            raise ValueError(f'Inconsistent Gemini vertex dimensions: {number}')
        result[number] = fields
    return result


@lru_cache(maxsize=1)
def catalog():
    return read_catalog(CATALOG)


def map_id(formula: str) -> int | None:
    if formula.startswith('@') and (match := TAG.fullmatch(formula)):
        number = int(match[1])
        if number in catalog():
            return number
    return None


def parse_gemini_collineation(body: str) -> tuple[int, str] | None:
    match = COLLINEATION.fullmatch(body.replace('′', "'").replace('’', "'"))
    if not match or int(match[1]) < 1 or int(match[2]) not in catalog():
        return None
    return int(match[1]), f'@g{int(match[2])}'


def cross(u, v):
    return tuple(u[(i+1)%3]*v[(i+2)%3]-u[(i+2)%3]*v[(i+1)%3] for i in range(3))


def frame_matrix(columns):
    """M diag(adj(M) 1), with independent homogeneous column normalization.

    adj(M)1 are the column weights that make the fourth image (1:1:1).
    det(M) and all three weights must be nonzero for a regular frame.
    """
    normalized = []
    for col in columns:
        if any(v is None or not math.isfinite(v) for v in col):
            return None
        norm = sum(abs(v) for v in col)
        if norm == 0:
            return None
        normalized.append(tuple(v/norm for v in col))
    cofactors = [cross(normalized[(j+1)%3], normalized[(j+2)%3]) for j in range(3)]
    determinant = sum(normalized[0][i]*cofactors[0][i] for i in range(3))
    weights = [sum(col) for col in cofactors]
    if (abs(determinant) <= 1e-12 or
            any(abs(d) <= 1e-12*sum(abs(v) for v in col) for d,col in zip(weights,cofactors))):
        return None
    return tuple(tuple(normalized[j][i]*weights[j] for j in range(3)) for i in range(3))


@lru_cache(maxsize=4096)
def gemini_matrix(number: int, sides: tuple[float, float, float]):
    env = side_environment(*sides)
    vertex = catalog()[number]
    columns = []
    for turn in range(3):
        values = [evaluate_formula(rotate_formula(f,turn),env) for f in vertex]
        columns.append(tuple(values[(i-turn)%3] for i in range(3)))
    return frame_matrix(columns)


def map_weights(number: int, weights, sides):
    matrix = gemini_matrix(number, tuple(sides))
    if matrix is None:
        return None
    return [sum(row[i]*weights[i] for i in range(3)) for row in matrix]


def barycentric_component(raw: str, side: str) -> str:
    normalized = normalize_formula(raw)
    if normalized is None:
        raise ValueError(f'Invalid trilinear component: {raw}')
    tree = validate_formula(normalized).body
    # Cancel only an entire top-level division by the corresponding side.
    # No heuristic substring cancellation inside sums or products.
    if isinstance(tree, ast.BinOp) and isinstance(tree.op, ast.Div) and isinstance(tree.right,ast.Name) and tree.right.id == side:
        return ast.unparse(tree.left).replace(' ', '').replace('**', '^')
    return normalize_formula(f'{side}*({normalized})')


def clear_isolated_secant(vertex):
    """Clear a homogeneous secant pole before runtime column normalization.

    (sec(A):v:w) = (1:cos(A)*v:cos(A)*w). This is an exact
    projective rescaling, and preserves the finite chart at a right angle.
    """
    tree=validate_formula(vertex[0]).body
    negative=isinstance(tree,ast.UnaryOp) and isinstance(tree.op,ast.USub)
    call=tree.operand if negative else tree
    if isinstance(call,ast.Call) and call.func.id=='sec':
        denominator='cos('+ast.unparse(call.args[0]).replace(' ','').replace('**','^')+')'
        return ('-1' if negative else '1',*(denominator if f=='1' else normalize_formula(f'({denominator})*({f})') for f in vertex[1:]))
    return vertex


def convert(source: Path, output: Path):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(source.read_text(encoding='utf-8'), 'html.parser')
    for label in soup.find_all('label'):
        label.decompose()  # Red duplication notes are not coordinate syntax.
    vertices = {}
    for tr in soup.find_all('tr'):
        cells = tr.find_all('td', recursive=False)
        if len(cells) % 2:
            raise ValueError('Incomplete Gemini table row')
        for i in range(0, len(cells), 2):
            number = int(cells[i].get_text(strip=True))
            fields = cells[i+1].get_text(' ',strip=True).split(':')
            if len(fields) != 3 or number in vertices:
                raise ValueError(f'Invalid or duplicate Gemini source row {number}')
            vertices[number] = '|'.join(clear_isolated_secant(tuple(barycentric_component(f, side) for f,side in zip(fields,'abc'))))
    if not vertices:
        raise ValueError('No Gemini vertices found')
    text = ('# Gemini A-vertex BARYCENTRICS, converted from the user-provided ETC table.\n'
            '# Source: Cesar E. Lozada, 2019-10-08; red notes 2021-09-18.\n'
            '# Source SHA256: '+hashlib.sha256(source.read_bytes()).hexdigest()+'\n'
            '# Isolated secant poles are cleared by a common homogeneous column scale.\n'
            '# id u|v|w; B=(w_bca,u_bca,v_bca), C=(v_cab,w_cab,u_cab).\n')
    text += ''.join(f'{n} {vertices[n]}\n' for n in sorted(vertices))
    output.parent.mkdir(parents=True, exist_ok=True)
    # Validate before publishing the maintained data file.
    import tempfile
    with tempfile.NamedTemporaryFile(dir=output.parent,suffix='.tmp',delete=False) as temp:
        path = Path(temp.name)
    try:
        path.write_text(text,encoding='utf-8')
        read_catalog(path)
        path.replace(output)
    finally:
        path.unlink(missing_ok=True)
    print(f'Converted {len(vertices)} Gemini vertices: {len(text.encode())} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['convert'])
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=CATALOG)
    args = parser.parse_args()
    convert(args.source, args.output)
