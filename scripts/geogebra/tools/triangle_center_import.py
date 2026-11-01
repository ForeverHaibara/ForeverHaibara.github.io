"""Manually fetch ETC pages, extract short constructions, and build compact chunks.

Requires Python 3 and beautifulsoup4. No network access occurs during build/check.
The extractor recognizes explicit relations and a conservative subset of cyclic
coordinates within each X(n) entry; it never interprets unrelated incidences.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from html import unescape
from itertools import combinations
from pathlib import Path
import json
import math
import re
import sys
import time
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from triangle_center_coordinates import (coordinate_candidates, evaluate_formula,
                                         rotate_formula, side_environment, validate_formula,
                                         MAX_FORMULA_LENGTH)


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'src/features/geogebra/commands/custom/data/triangle-centers'
CACHE = ROOT / '.cache/triangle-centers'
NATIVE_MAX = 3053
HEADING = re.compile(r'<h3\b[^>]*\bid\s*=\s*["\']X(\d+)["\'][^>]*>', re.I)
POINT = r'X\s*\(\s*(\d+)\s*\)'
PAIR = re.compile(r'[({]\s*(\d+)\s*,\s*(\d+)\s*[)}]')
RELATION = re.compile(r'^X\s*\(\s*(\d+)\s*\)\s*(?:=|is)\s*(.+)$', re.I)
MIDPOINT = re.compile(rf'^midpoint (?:of|between) {POINT}\s+and\s+{POINT}', re.I)
REFLECTION = re.compile(rf'^reflection of {POINT}\s+in\s+{POINT}', re.I)
COMPLEMENT = re.compile(rf'^complement of {POINT}', re.I)
ANTICOMPLEMENT = re.compile(rf'^anticomplement of {POINT}', re.I)
INTERSECTION = re.compile(rf'^intersection of (?:lines? )?{POINT}\s*{POINT}\s+and\s+{POINT}\s*{POINT}', re.I)
SYMBOLIC_INTERSECTION = re.compile(rf'^{POINT}\s*{POINT}\s*∩\s*{POINT}\s*{POINT}', re.I)
PROJECTION = re.compile(rf'^orthogonal projection of {POINT}\s+on\s+(?:the\s+)?line\s+{POINT}\s*{POINT}', re.I)
LINE_REFLECTION = re.compile(rf'^reflection of {POINT}\s+in\s+(?:the\s+)?line\s+{POINT}\s*{POINT}', re.I)
ISOGONAL = re.compile(rf'^isogonal conjugate of {POINT}', re.I)
ISOTOMIC = re.compile(rf'^isotomic conjugate of {POINT}', re.I)
CONDITIONAL = re.compile(r'\b(?:if|when|provided|assuming|unless|only for|for acute|for obtuse|wrt|with respect to|relative to)\b', re.I)
INFINITE_DEFINITION = re.compile(r'\bX\s*\(\s*(\d+)\s*\)\s*(?:=|is)\s*(?:the\s+)?'
                                 r'(?:infinite point|infinity point|ideal point|point at infinity)\b', re.I)
ARITY = {'M': 2, 'R': 2, 'J': 4, 'I': 2, 'C': 1, 'A': 1, 'P': 3, 'L': 3, 'G': 1, 'T': 1, 'B': 0}
PRIORITY = {'M': 0, 'R': 1, 'C': 2, 'A': 3, 'P': 4, 'L': 5, 'I': 6, 'J': 7, 'G': 8, 'T': 9, 'B': 10}
RISK = {'M': 0, 'R': 0, 'C': 0, 'A': 0, 'I': 0, 'P': 1, 'L': 1, 'J': 2, 'G': 3, 'T': 3, 'B': 4}
LINE_LIST = re.compile(r'^(?:X\s*)?\(\s*(\d+)\s*\)\s*(?:=\s*)?lies on\b.*\bthese\s*(?:\(parallel\)\s*)?lines\s*:\s*(.*)$', re.I)
SINGLE_LINE = re.compile(r'^(?:X\s*)?\(\s*(\d+)\s*\)\s+lies on this line\s*:\s*[\{\(]?\s*(\d+)\s*,\s*(\d+)', re.I)
LINE_PAIR = re.compile(r'\s*[,;]?\s*[\{\(]*\s*(\d+)\s*[,\.]\s*(\d+)\s*[\}\)]*')
BROKEN_LINE_TOKEN = re.compile(r'\s*[,;]?\s*\d{5,}(?=\s|$)')
MAX_LIST_LINES = 10


@dataclass(frozen=True)
class Recipe:
    number: int
    operation: str
    references: tuple[int, ...]
    part: int = 0
    evidence: str = ''
    formula: str = ''

    def row(self) -> str:
        if self.operation == 'B':
            return f'{self.number} {self.operation} {self.formula}'
        return f'{self.number} {self.operation} {" ".join(map(str, self.references))}'


@dataclass(frozen=True)
class Ideal:
    dx: float
    dy: float


Coordinate = tuple[float, float] | Ideal


def direction(p: Coordinate, q: Coordinate) -> tuple[float, float] | None:
    if isinstance(p, Ideal) and isinstance(q, Ideal):
        return None
    if isinstance(p, Ideal):
        return p.dx, p.dy
    if isinstance(q, Ideal):
        return q.dx, q.dy
    return q[0] - p[0], q[1] - p[1]


def line_data(p: Coordinate, q: Coordinate) -> tuple[tuple[float, float], tuple[float, float]] | None:
    d = direction(p, q)
    base = q if isinstance(p, Ideal) else p
    if d is None or isinstance(base, Ideal) or math.hypot(*d) < 1e-9:
        return None
    return base, d


def quality(recipe: Recipe) -> tuple[int, int]:
    # An explicitly stated intersection is stronger evidence than choosing
    # two arbitrary pairs from a list of lines that merely pass through X(n).
    incidence_only = int('lies on these lines:' in recipe.evidence.lower())
    return RISK[recipe.operation], incidence_only


def split_entries(source: str):
    headings = list(HEADING.finditer(source))
    for index, match in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(source)
        yield int(match.group(1)), source[match.start():end]



def entry_lines(fragment: str) -> list[str]:
    def normalize_heading(match: re.Match) -> str:
        heading = match.group()
        heading = heading.replace('\r\n', '\n').replace('\r', '\n')
        return re.sub(
            r'[ \t]*\n(?:[ \t]*\n)*[ \t]*',
            lambda m: ' ' if m.group().count('\n') == 1 else '\n',
            heading,
        )

    # Normalize raw line breaks inside <h3> headings.
    fragment = re.sub(
        r'<h3\b[^>]*>.*?</h3>',
        normalize_heading,
        fragment,
        flags=re.I | re.S,
    )

    # Preserve explicit HTML line and block boundaries.
    fragment = re.sub(
        r'<br\s*/?>|</(?:p|h3|div)>|<hr\b[^>]*>',
        '\n', fragment, flags=re.I,
    )
    plain = unescape(BeautifulSoup(fragment, 'html.parser').get_text())
    plain = plain.replace('\u00ad', '')
    return [
        re.sub(r'\s+', ' ', line).strip()
        for line in plain.splitlines() if line.strip()
    ]


def relation_lines(fragment: str) -> list[str]:
    lines = entry_lines(fragment)
    joined: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        while index + 1 < len(lines):
            following = lines[index + 1]
            broken_intersection = (re.match(r'^X\s*\(\d+\)\s*=\s*intersection of\b', line, re.I)
                                   and (re.search(r'\b(?:and|line)\s*$', line, re.I)
                                        or following.lower() == 'and')
                                   and (following.lower() == 'and'
                                        or re.match(r'^X\s*\(\d+\)\s*X\s*\(\d+\)', following, re.I)))
            continued_pairs = ('for these' in line.lower() and re.match(r'^[({]\s*\d+\s*,\s*\d+', following))
            broken_line_heading = (re.match(r'^X\s*\(\d+\)\s+lies on\b', line, re.I)
                                   and re.match(r'^and (?:on )?these lines\s*:', following, re.I))
            if not (broken_intersection or continued_pairs or broken_line_heading):
                break
            line += ' ' + following
            index += 1
        joined.append(line)
        index += 1
    return joined


def listed_lines(number: int, lines: list[str], excluded: set[int] | None = None,
                 limit: int | None = MAX_LIST_LINES) -> list[tuple[int, int]]:
    """Read and merge line pairs from all matching line-list headings."""
    excluded = excluded or set()
    pairs: set[tuple[int, int]] = set()

    for index, line in enumerate(lines):
        heading = LINE_LIST.match(line)
        if not heading or int(heading.group(1)) != number:
            continue

        # Stop at the next line-list heading.
        tail_lines = [heading.group(2)]
        for following in lines[index + 1:]:
            if LINE_LIST.match(following):
                break
            tail_lines.append(following)

        tail = ' '.join(tail_lines)
        position = 0
        while position < len(tail):
            match = LINE_PAIR.match(tail, position)
            if match:
                a, b = map(int, match.groups())
                if a > 0 and b > 0 and a != b and a not in excluded and b not in excluded:
                    pairs.add(tuple(sorted((a, b))))
                position = match.end()
                continue

            broken = BROKEN_LINE_TOKEN.match(tail, position)
            if not broken:
                break
            position = broken.end()

    ordered = sorted(
        pairs,
        key=lambda pair: (
            sum(ref > NATIVE_MAX for ref in pair),
            max(pair),
            sum(pair),
        ),
    )
    return ordered[:limit] if limit is not None else ordered


def coordinate_incidence_lines(number: int, lines: list[str]) -> list[tuple[int, int]]:
    pairs = listed_lines(number, lines, limit=None)
    for line in lines:
        match = SINGLE_LINE.match(line)
        if match and int(match.group(1)) == number:
            a, b = int(match.group(2)), int(match.group(3))
            if a > 0 and b > 0 and a != b:
                pairs.append(tuple(sorted((a, b))))
    return sorted(set(pairs))


def is_infinite_entry(number: int, lines: list[str]) -> bool:
    for line in lines:
        heading = LINE_LIST.match(line)
        if heading and int(heading.group(1)) == number:
            if '(parallel)' in line[:heading.start(2)].lower() or (30, 511) in listed_lines(number, lines, limit=None):
                return True
    return any(int(match.group(1)) == number for line in lines
               for match in INFINITE_DEFINITION.finditer(line))


def extract_entry(number: int, fragment: str, part: int,
                  excluded: set[int] | None = None) -> list[Recipe]:
    found: dict[tuple[str, tuple[int, ...]], str] = {}
    lines = relation_lines(fragment)
    if is_infinite_entry(number, lines):
        for first, second in listed_lines(number, lines, excluded, limit=None):
            if (first, second) != (30, 511):
                found[('I', (first, second))] = f'X({number}) is the ideal point in direction X({first})X({second})'
        return [Recipe(number, opcode, refs, part, evidence) for (opcode, refs), evidence in sorted(found.items())
                if all(reference != number for reference in refs)]
    for first, second in combinations(listed_lines(number, lines, excluded), 2):
        if set(first).isdisjoint(second):
            found[('J', (*first, *second))] = f'X({number}) lies on these lines: {first}, {second}'
    for line in lines:
        relation = RELATION.match(line)
        if not relation or int(relation.group(1)) != number:
            continue
        body = relation.group(2)
        for pattern, opcode in ((MIDPOINT, 'M'), (REFLECTION, 'R'), (COMPLEMENT, 'C'),
                                (ANTICOMPLEMENT, 'A'), (INTERSECTION, 'J'),
                                (SYMBOLIC_INTERSECTION, 'J'), (PROJECTION, 'P'),
                                (LINE_REFLECTION, 'L'), (ISOGONAL, 'G'), (ISOTOMIC, 'T')):
            match = pattern.match(body)
            if match and not CONDITIONAL.search(body[match.end():]):
                found[(opcode, tuple(map(int, match.groups())))] = line
        # ETC also gives sets of equivalent midpoint/reflection constructions.
        for prefix, opcode in (('midpoint of X(i) and X(j) for these', 'M'),
                               ('reflection of X(i) in X(j) for these', 'R'),
                               ('reflection of X(i) and X(j) for these', 'R')):
            if body.lower().startswith(prefix.lower()):
                found.update({(opcode, tuple(map(int, pair))): line for pair in PAIR.findall(body)})
    recipes = [Recipe(number, opcode, refs, part, found[(opcode, refs)]) for opcode, refs in sorted(found)
               if all(reference > 0 and reference != number for reference in refs)]
    recipes.extend(Recipe(number, kind, (), part, evidence, formula)
                   for kind, formula, evidence in coordinate_candidates(fragment))
    return recipes


def read_page(part: int, excluded: set[int] | None = None,
              coordinate_lines: dict[int, list[tuple[int, int]]] | None = None) -> tuple[list[int], dict[int, list[Recipe]]]:
    path = CACHE / f'ETCPart{part}.html'
    source = path.read_text(encoding='utf-8', errors='replace')
    entries: list[int] = []
    candidates: dict[int, list[Recipe]] = {}
    for number, fragment in split_entries(source):
        if number in candidates:
            raise ValueError(f'Duplicate X({number}) heading in {path}')
        entries.append(number)
        candidates[number] = extract_entry(number, fragment, part, excluded)
        if coordinate_lines is not None and any(r.operation == 'B' for r in candidates[number]):
            coordinate_lines[number] = coordinate_incidence_lines(number, relation_lines(fragment))
    if not entries or entries != sorted(entries):
        raise ValueError(f'Missing or unordered X(n) headings in {path}')
    return entries, candidates


def read_recipes(path: Path) -> dict[int, Recipe]:
    records: dict[int, Recipe] = {}
    for row in path.read_text(encoding='utf-8').splitlines():
        if not row.strip() or row.lstrip().startswith('#'):
            continue
        fields = row.split()
        number, opcode = int(fields[0]), fields[1]
        formula = fields[2] if opcode == 'B' and len(fields) == 3 else ''
        refs = () if opcode == 'B' else tuple(map(int, fields[2:]))
        if (number <= NATIVE_MAX or opcode not in ARITY or len(refs) != ARITY[opcode]
                or any(reference <= 0 or reference == number for reference in refs) or number in records
                or (opcode == 'B' and (not formula or len(formula) > MAX_FORMULA_LENGTH))):
            raise ValueError(f'Invalid or duplicate recipe in {path}: {row}')
        if formula:
            validate_formula(formula)
        records[number] = Recipe(number, opcode, refs, formula=formula)
    return records


def read_native_status(path: Path) -> tuple[set[int], dict[int, tuple[int, int]]]:
    numbers: set[int] = set()
    directions: dict[int, tuple[int, int]] = {}
    for row in path.read_text(encoding='utf-8').splitlines():
        token = row.split('#', 1)[0].strip()
        if not token:
            continue
        if re.fullmatch(r'\d+(?:-\d+)?', token):
            bounds = list(map(int, token.split('-')))
            start, end = bounds[0], bounds[-1]
            if start > end or not 1 <= start <= end <= NATIVE_MAX:
                raise ValueError(f'Invalid native status range in {path}: {row}')
            entries = set(range(start, end + 1))
            if numbers & entries:
                raise ValueError(f'Duplicate native status in {path}: {row}')
            numbers.update(entries)
            continue
        if not re.fullmatch(r'\d+\s+\d+\s+\d+', token):
            raise ValueError(f'Invalid native status in {path}: {row}')
        number, a, b = map(int, token.split())
        if (number in numbers or not 1 <= number <= NATIVE_MAX
                or not 1 <= a <= NATIVE_MAX or not 1 <= b <= NATIVE_MAX
                or len({number, a, b}) != 3):
            raise ValueError(f'Invalid native direction in {path}: {row}')
        numbers.add(number)
        directions[number] = (a, b)
    if any(a in numbers or b in numbers for a, b in directions.values()):
        raise ValueError(f'Native direction uses an unavailable endpoint in {path}')
    return numbers, directions


def read_deferred_targets(path: Path) -> set[int]:
    numbers = {int(row.split()[0]) for row in path.read_text(encoding='utf-8').splitlines()
               if row.strip() and not row.lstrip().startswith('#')}
    if any(number <= NATIVE_MAX for number in numbers):
        raise ValueError(f'Invalid extended exclusion in {path}')
    return numbers


def read_coordinate_priority(path: Path) -> set[int]:
    numbers = {int(row.split('#', 1)[0].strip()) for row in path.read_text(encoding='utf-8').splitlines()
               if row.split('#', 1)[0].strip()}
    if any(number <= NATIVE_MAX for number in numbers):
        raise ValueError(f'Invalid coordinate priority in {path}')
    return numbers


def unresolved_components(candidates: dict[int, list[Recipe]], baseline: dict[int, Recipe],
                          excluded: set[int] | None = None
                          ) -> dict[int, int]:
    """Weak components of unresolved extended centers, ignoring shared native anchors."""
    pending = {number for number in candidates if number > NATIVE_MAX and number not in baseline
               and number not in (excluded or set())}
    parent = {number: number for number in pending}

    def root(number: int) -> int:
        while parent[number] != number:
            parent[number] = parent[parent[number]]
            number = parent[number]
        return number

    for target in pending:
        for recipe in candidates[target]:
            if recipe.operation == 'B':
                continue
            for reference in recipe.references:
                if reference in pending:
                    a, b = root(target), root(reference)
                    if a != b:
                        parent[max(a, b)] = min(a, b)
    return {number: root(number) for number in pending}


def coordinate_anchors(candidates: dict[int, list[Recipe]], baseline: dict[int, Recipe],
                       atlas: dict, per_component: int, priority: set[int],
                       coordinate_lines: dict[int, list[tuple[int, int]]],
                       native_directions: dict[int, tuple[int, int]],
                       excluded: set[int] | None = None) -> dict[int, Recipe]:
    """Screen formulas, then allocate anchors separately to dependency components."""
    if per_component <= 0:
        return {}
    components = unresolved_components(candidates, baseline, excluded)
    sizes = Counter(components.values())
    baseline_coordinates = numeric_coordinates(baseline, atlas, native_directions)

    def agrees_with_known_line(recipe: Recipe) -> bool:
        for shape, points in baseline_coordinates.items():
            center = numeric_formula(recipe, [tuple(xy) for xy in atlas['triangles'][shape]])
            if center is None:
                return False
            known: list[float] = []
            for a, b in coordinate_lines.get(recipe.number, []):
                if a not in points or b not in points:
                    continue
                line = line_data(points[a], points[b])
                if line is None:
                    continue
                p, d = line
                known.append(abs(d[0]*(center[1]-p[1])-d[1]*(center[0]-p[0])) / math.hypot(*d))
            if known and min(known) > 1e-5 * max(1, math.hypot(*center)):
                return False
        return True
    ranked: list[tuple[int, int, int, Recipe]] = []
    dependents: dict[int, set[int]] = defaultdict(set)
    for target, options in candidates.items():
        if target not in components:
            continue
        for recipe in options:
            if recipe.operation != 'B':
                for ref in recipe.references:
                    dependents[ref].add(target)
    for number, options in candidates.items():
        if number not in components:
            continue
        formulas = [recipe for recipe in options if recipe.operation == 'B'
                    and formula_candidate_supported(recipe, atlas) and agrees_with_known_line(recipe)]
        if not formulas:
            continue
        samples = [[numeric_formula(recipe, [tuple(xy) for xy in abc])
                    for abc in atlas['triangles'].values()] for recipe in formulas]
        if any(any(math.dist(p, q) > 1e-5 * max(1, math.hypot(*p), math.hypot(*q))
                   for p, q in zip(samples[0], other)) for other in samples[1:]):
            continue
        chosen = min(formulas, key=lambda recipe: (len(recipe.formula), recipe.formula))
        ranked.append((len(dependents[number]), len(chosen.formula), number, chosen))
    ranked.sort(key=lambda item: (-item[0], item[1], item[2]))
    selected: dict[int, Recipe] = {}
    by_component: dict[int, list[tuple[int, int, int, Recipe]]] = defaultdict(list)
    for item in ranked:
        by_component[components[item[2]]].append(item)
    for component in sorted(by_component):
        options = by_component[component]
        pinned = [item for item in options if item[2] in priority]
        # Large clusters can use several anchors. Previously selected anchors
        # remain eligible even when they exceed the ordinary local allowance.
        allowance = max(len(pinned), min(per_component, max(1, math.ceil(sizes[component] / 5))))
        for _, _, number, recipe in pinned:
            selected[number] = recipe
        count = len(pinned)
        for _, _, number, recipe in options:
            if count >= allowance:
                break
            if number in selected:
                continue
            selected[number] = recipe
            count += 1
    return selected


def estimated_recipe_length(recipe: Recipe, children: list[int]) -> int:
    if recipe.operation in {'G', 'T'}:
        # The builder binds its input point once before expanding the signed
        # area expressions, so a long coordinate source is not repeated.
        return 1100 + children[0]
    if recipe.operation == 'B':
        return 150 + 18 * len(recipe.formula)
    return 24 + sum(children)


def validate_graph(records: dict[int, Recipe]) -> tuple[dict[int, int], dict[int, int]]:
    depth: dict[int, int] = {}
    length: dict[int, int] = {}
    visiting: set[int] = set()

    def visit(number: int) -> tuple[int, int]:
        if number <= NATIVE_MAX:
            return 0, 27
        if number in visiting:
            raise ValueError(f'Cyclic triangle center recipe through X({number})')
        if number not in records:
            raise ValueError(f'Missing triangle center dependency X({number})')
        if number in depth:
            return depth[number], length[number]
        visiting.add(number)
        try:
            children = [visit(reference) for reference in records[number].references]
            depth[number] = 1 + max((item[0] for item in children), default=0)
            length[number] = estimated_recipe_length(records[number], [item[1] for item in children])
            return depth[number], length[number]
        finally:
            visiting.remove(number)

    for number in records:
        visit(number)
    return depth, length


def validate_types(records: dict[int, Recipe], native_ideal: set[int]) -> None:
    """Ensure every stored operation can be rendered with its point/ideal inputs."""
    for number, recipe in records.items():
        ideal = [ref in native_ideal or ref > NATIVE_MAX and records[ref].operation == 'I'
                 for ref in recipe.references]
        op = recipe.operation
        valid = (not any(ideal) if op in {'M', 'R', 'C', 'A', 'P', 'L', 'I'} else
                 not (ideal[0] and ideal[1] or ideal[2] and ideal[3]) if op == 'J' else True)
        if not valid:
            raise ValueError(f'Invalid ideal-point input in X({number}) {op}')


def conjugate_levels(records: dict[int, Recipe]) -> dict[int, int]:
    levels: dict[int, int] = {}

    def visit(number: int) -> int:
        if number <= NATIVE_MAX:
            return 0
        if number not in levels:
            recipe = records[number]
            levels[number] = int(recipe.operation in {'G', 'T'}) + max(
                (visit(ref) for ref in recipe.references), default=0)
        return levels[number]

    for number in records:
        visit(number)
    return levels


def numeric_intersection(points: list[Coordinate], allow_ideal: bool = False) -> Coordinate | None:
    p, q, r, s = points
    first, second = line_data(p, q), line_data(r, s)
    if first is None or second is None:
        return None
    p, u = first
    r, v = second
    lengths = math.hypot(*u) * math.hypot(*v)
    determinant = u[0] * v[1] - u[1] * v[0]
    if abs(determinant) < 1e-6 * lengths:
        return Ideal(*u) if allow_ideal else None
    t = ((r[0] - p[0]) * v[1] - (r[1] - p[1]) * v[0]) / determinant
    result = (p[0] + t * u[0], p[1] + t * u[1])
    return result if all(math.isfinite(value) for value in result) else None


def numeric_conjugate(p: Coordinate, abc: list[tuple[float, float]],
                      isogonal: bool, allow_ideal: bool = False) -> Coordinate | None:
    a, b, c = abc
    cross = lambda u, v: u[0]*v[1]-u[1]*v[0]
    sub = lambda u, v: (u[0]-v[0], u[1]-v[1])
    if isinstance(p, Ideal):
        d = (p.dx, p.dy)
        u, v, w = cross(d, sub(b,c)), cross(d, sub(c,a)), cross(d, sub(a,b))
    else:
        u, v, w = cross(sub(b,p),sub(c,p)), cross(sub(c,p),sub(a,p)), cross(sub(a,p),sub(b,p))
    weights = [v*w, w*u, u*v]
    if isogonal:
        weights = [weight * sum((x-y)**2 for x,y in zip(*side))
                   for weight, side in zip(weights, [(b,c),(c,a),(a,b)])]
    denominator = sum(weights)
    if abs(denominator) < 1e-12:
        d = (sum(weight * vertex[0] for weight, vertex in zip(weights, abc)),
             sum(weight * vertex[1] for weight, vertex in zip(weights, abc)))
        return Ideal(*d) if allow_ideal and math.hypot(*d) > 1e-12 else None
    answer = (sum(weight * vertex[0] for weight, vertex in zip(weights, abc))/denominator,
              sum(weight * vertex[1] for weight, vertex in zip(weights, abc))/denominator)
    return answer if all(math.isfinite(value) for value in answer) else None


def numeric_formula_projective(recipe: Recipe, abc: list[tuple[float, float]]) -> Coordinate | None:
    a, b, c = (math.dist(abc[1], abc[2]), math.dist(abc[2], abc[0]), math.dist(abc[0], abc[1]))
    values = side_environment(a, b, c)
    weights = [evaluate_formula(rotate_formula(recipe.formula, index), values) for index in range(3)]
    if any(weight is None for weight in weights):
        return None
    total = sum(weights)
    if not math.isfinite(total):
        return None
    if abs(total) <= 1e-8 * sum(abs(weight) for weight in weights):
        vector = (sum(weight * vertex[0] for weight, vertex in zip(weights, abc)),
                  sum(weight * vertex[1] for weight, vertex in zip(weights, abc)))
        return Ideal(*vector) if all(math.isfinite(value) for value in vector) and math.hypot(*vector) > 1e-9 else None
    point = (sum(weight * vertex[0] for weight, vertex in zip(weights, abc)) / total,
             sum(weight * vertex[1] for weight, vertex in zip(weights, abc)) / total)
    return point if all(math.isfinite(value) for value in point) else None


def numeric_formula(recipe: Recipe, abc: list[tuple[float, float]]) -> tuple[float, float] | None:
    coordinate = numeric_formula_projective(recipe, abc)
    return coordinate if isinstance(coordinate, tuple) else None


def numeric_coordinates(records: dict[int, Recipe], atlas: dict,
                        native_directions: dict[int, tuple[int, int]] | None = None) -> dict[str, dict[int, Coordinate]]:
    results: dict[str, dict[int, Coordinate]] = {}
    for shape, native in atlas['coordinates'].items():
        points: dict[int, Coordinate] = {int(number): tuple(xy) for number, xy in native.items()}
        for number, (a, b) in (native_directions or {}).items():
            if a in points and b in points and not isinstance(points[a], Ideal) and not isinstance(points[b], Ideal):
                d = direction(points[a], points[b])
                if d is not None and math.hypot(*d) > 1e-9:
                    points[number] = Ideal(*d)
        abc = [tuple(xy) for xy in atlas['triangles'][shape]]
        visiting: set[int] = set()

        def point(number: int) -> Coordinate | None:
            if number in points:
                return points[number]
            if number <= NATIVE_MAX or number not in records or number in visiting:
                return None
            visiting.add(number)
            recipe = records[number]
            children = [point(ref) for ref in recipe.references]
            visiting.remove(number)
            if any(child is None for child in children):
                return None
            values = children  # type: ignore[assignment]
            op = recipe.operation
            if op == 'J':
                answer = numeric_intersection(values)
            elif op == 'B':
                answer = numeric_formula(recipe, abc)
            elif op == 'I':
                d = direction(*values)
                answer = Ideal(*d) if d is not None and all(not isinstance(v, Ideal) for v in values) and math.hypot(*d) > 1e-9 else None
            elif op in {'M', 'R'}:
                p, q = values
                if isinstance(p, Ideal) or isinstance(q, Ideal):
                    return None
                answer = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) if op == 'M' else (2*q[0]-p[0], 2*q[1]-p[1])
            elif op in {'C', 'A'}:
                p = values[0]
                if isinstance(p, Ideal):
                    return None
                total = (sum(v[0] for v in abc), sum(v[1] for v in abc))
                answer = ((total[0] - p[0]) / 2, (total[1] - p[1]) / 2) if op == 'C' else (total[0]-2*p[0], total[1]-2*p[1])
            elif op in {'P', 'L'}:
                p, q, r = values
                if any(isinstance(v, Ideal) for v in values):
                    return None
                d = (r[0]-q[0], r[1]-q[1])
                denominator = d[0]**2 + d[1]**2
                if denominator < 1e-12:
                    return None
                t = ((p[0]-q[0])*d[0]+(p[1]-q[1])*d[1])/denominator
                foot = (q[0]+t*d[0], q[1]+t*d[1])
                answer = foot if op == 'P' else (2*foot[0]-p[0], 2*foot[1]-p[1])
            else:
                answer = numeric_conjugate(values[0], abc, op == 'G')
            if answer is not None and all(math.isfinite(value) for value in
                                          ((answer.dx, answer.dy) if isinstance(answer, Ideal) else answer)):
                points[number] = answer
                return answer
            return None

        for number in records:
            point(number)
        results[shape] = points
    return results


def line_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]],
                             incidence_lines: list[tuple[int, int]]) -> bool:
    for points in coordinates.values():
        try:
            endpoints = [points[ref] for ref in recipe.references]
        except KeyError:
            return False
        crossing = numeric_intersection(endpoints)
        if crossing is None:
            return False
        if 'lies on these lines:' not in recipe.evidence.lower() or len(incidence_lines) < 3:
            continue
        directions = [direction(endpoints[i], endpoints[i+1]) for i in (0, 2)]
        support = False
        for a, b in incidence_lines:
            if (a, b) in (recipe.references[:2], recipe.references[2:]) or a not in points or b not in points:
                continue
            line = line_data(points[a], points[b])
            if line is None:
                continue
            p, d = line
            length = math.hypot(*d)
            if length < 1e-6:
                continue
            if any(abs(d[0]*base[1]-d[1]*base[0])
                   < 1e-6 * length * math.hypot(*base) for base in directions):
                continue
            distance = abs(d[0]*(crossing[1]-p[1])-d[1]*(crossing[0]-p[0]))/length
            if distance < 1e-5 * max(1, math.hypot(*crossing)):
                support = True
                break
        if not support:
            return False
    return True


def direction_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]],
                                  incidence_lines: list[tuple[int, int]]) -> bool:
    for points in coordinates.values():
        if any(ref not in points for ref in recipe.references):
            return False
        source = line_data(*(points[ref] for ref in recipe.references))
        if source is None or any(isinstance(points[ref], Ideal) for ref in recipe.references):
            return False
        _, base = source
        comparable = [line_data(points[a], points[b]) for a, b in incidence_lines
                      if (a, b) != recipe.references and a in points and b in points
                      and not isinstance(points[a], Ideal) and not isinstance(points[b], Ideal)]
        comparable = [line for line in comparable if line is not None]
        if comparable and not any(abs(base[0]*d[1]-base[1]*d[0])
                                  < 1e-5 * math.hypot(*base) * math.hypot(*d)
                                  for _, d in comparable):
            return False
    return True


def conjugate_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]],
                                  atlas: dict) -> bool:
    for shape, points in coordinates.items():
        source = points.get(recipe.references[0])
        if source is None or numeric_conjugate(source, atlas['triangles'][shape],
                                               recipe.operation == 'G') is None:
            return False
    return True


def formula_candidate_supported(recipe: Recipe, atlas: dict) -> bool:
    return all(numeric_formula(recipe, [tuple(xy) for xy in abc]) is not None
               for abc in atlas['triangles'].values())


def read_native_atlas(path: Path) -> dict:
    atlas = json.loads(path.read_text(encoding='utf-8'))
    if set(atlas['coordinates']) != {'acute', 'obtuse'} or set(atlas['triangles']) != {'acute', 'obtuse'}:
        raise ValueError(f'Unexpected native coordinate sample: {path}')
    return atlas


def derive_native_directions(atlas: dict, blocked_native: set[int]) -> tuple[dict[int, tuple[int, int]], list[int]]:
    """Choose a finite line for each explicitly ideal native ETC entry."""
    directions: dict[int, tuple[int, int]] = {}
    weak: list[int] = []
    for part in (1, 2):
        source = (CACHE / f'ETCPart{part}.html').read_text(encoding='utf-8', errors='replace')
        for number, fragment in split_entries(source):
            if number > NATIVE_MAX:
                continue
            lines = relation_lines(fragment)
            if not is_infinite_entry(number, lines):
                continue
            if number not in blocked_native:
                raise ValueError(f'ETC calls native X({number}) ideal, but the native screen reports finite')
            eligible: list[tuple[tuple[int, int], list[tuple[float, float]]]] = []
            for pair in listed_lines(number, lines, limit=None):
                if any(ref in blocked_native or ref > NATIVE_MAX for ref in pair):
                    continue
                samples: list[tuple[float, float]] = []
                for points in atlas['coordinates'].values():
                    if any(str(ref) not in points for ref in pair):
                        break
                    p, q = (points[str(ref)] for ref in pair)
                    d = q[0]-p[0], q[1]-p[1]
                    if math.hypot(*d) < 1e-9:
                        break
                    samples.append(d)
                if len(samples) == len(atlas['coordinates']):
                    eligible.append((pair, samples))
            if not eligible:
                raise ValueError(f'No finite direction line for native X({number})')
            def agreement(item: tuple[tuple[int, int], list[tuple[float, float]]]) -> int:
                pair, samples = item
                return sum(other != pair and all(
                    abs(d[0]*v[1]-d[1]*v[0]) < 1e-5 * math.hypot(*d) * math.hypot(*v)
                    for d, v in zip(samples, other_samples)) for other, other_samples in eligible)
            chosen = max(eligible, key=lambda item: (agreement(item), -max(item[0]), -sum(item[0])))
            if len(eligible) > 1 and agreement(chosen) == 0:
                weak.append(number)
                continue
            directions[number] = chosen[0]
    return dict(sorted(directions.items())), weak


def native_status_rows(unavailable: set[int], directions: dict[int, tuple[int, int]],
                       weak: list[int]) -> str:
    header = ('# Native centers undefined on at least one screened triangle.\n'
              '# id = unavailable; id p q = ideal direction along finite X(p)X(q).\n'
              '# A=(0,0), B=(6,0), C=(1,4) or C=(-1,2); 2026-10-31.\n'
              '# Refresh the unavailable set from the GeoGebra native screen, then run:\n'
              '# python scripts/geogebra/tools/triangle_center_import.py native\n'
              + ''.join(f'# X({number}) has conflicting direction lines.\n' for number in weak))
    return header + ''.join(f'{number} {directions[number][0]} {directions[number][1]}\n'
                            if number in directions else f'{number}\n'
                            for number in sorted(unavailable))


def select_recipes(candidates: dict[int, list[Recipe]], seeds: dict[int, Recipe],
                   max_depth: int, max_length: int, max_conjugates: int = 1,
                   blocked_native: set[int] | None = None,
                   deferred_targets: set[int] | None = None, atlas: dict | None = None,
                   native_directions: dict[int, tuple[int, int]] | None = None,
                   require_seeds: bool = True) -> dict[int, Recipe]:
    # A reviewed seed may depend on another extended center. Admit it only
    # after its references have closed, just like automatically parsed recipes.
    selected = {number: recipe for number, recipe in seeds.items()
                if all(reference <= NATIVE_MAX for reference in recipe.references)}
    native_directions = native_directions or {}
    blocked_native = (blocked_native or set()) - set(native_directions)
    deferred_targets = deferred_targets or set()
    if set(seeds) & deferred_targets:
        raise ValueError('A reviewed seed is marked deferred')
    if any(ref in blocked_native for recipe in seeds.values() for ref in recipe.references):
        raise ValueError('A reviewed seed references an unavailable native center')
    validate_graph(selected)
    pending = {number for number in set(candidates) | set(seeds) if number > NATIVE_MAX
               and number not in selected and number not in deferred_targets}
    incidence_lines: dict[int, list[tuple[int, int]]] = {}
    for number, options in candidates.items():
        incidence_lines[number] = sorted({tuple(recipe.references[index:index+2]) for recipe in options
                                          if recipe.operation == 'J' and 'lies on these lines:' in recipe.evidence.lower()
                                          for index in (0, 2)}
                                         | {recipe.references for recipe in options if recipe.operation == 'I'})
    while pending:
        possible: list[tuple[tuple, Recipe]] = []
        depth, length = validate_graph(selected)
        nonlinear = conjugate_levels(selected)
        coordinates = numeric_coordinates(selected, atlas, native_directions) if atlas else None
        for number in pending:
            for recipe in ([seeds[number]] if number in seeds else candidates.get(number, [])):
                if any(ref in blocked_native or ref in deferred_targets
                       or ref > NATIVE_MAX and ref not in selected
                       for ref in recipe.references):
                    continue
                if coordinates and recipe.operation == 'J' and not line_candidate_supported(
                        recipe, coordinates, incidence_lines[number]):
                    continue
                if coordinates and recipe.operation == 'I' and not direction_candidate_supported(
                        recipe, coordinates, incidence_lines[number]):
                    continue
                if coordinates and recipe.operation in {'G', 'T'} and not conjugate_candidate_supported(
                        recipe, coordinates, atlas):
                    continue
                if atlas and recipe.operation == 'B' and not formula_candidate_supported(recipe, atlas):
                    continue
                candidate_depth = 1 + max((depth.get(ref, 0) for ref in recipe.references), default=0)
                candidate_length = estimated_recipe_length(recipe,
                                                           [length.get(ref, 27) for ref in recipe.references])
                candidate_nonlinear = int(recipe.operation in {'G', 'T'}) + max(
                    (nonlinear.get(ref, 0) for ref in recipe.references), default=0)
                if (candidate_depth <= max_depth and candidate_length <= max_length
                        and candidate_nonlinear <= max_conjugates):
                    key = (*quality(recipe), candidate_depth, candidate_length,
                           PRIORITY[recipe.operation], recipe.references)
                    possible.append((key, recipe))
        if not possible:
            break
        # Add every currently reachable point; prefer safer operations before
        # construction depth and estimated expression length.
        best: dict[int, tuple[tuple, Recipe]] = {}
        for item in possible:
            number = item[1].number
            if number not in best or item[0] < best[number][0]:
                best[number] = item
        selected.update({number: item[1] for number, item in best.items()})
        pending.difference_update(best)
    if require_seeds and set(seeds) - set(selected):
        raise ValueError(f'Unclosed reviewed seeds: {sorted(set(seeds) - set(selected))}')
    # A line-list intersection may enter before the point needed by a simpler
    # definition. Reconsider it after the reachable graph has closed.
    refine_coordinates = numeric_coordinates(selected, atlas, native_directions) if atlas else None
    for number in sorted(set(selected) - set(seeds)):
        current = selected[number]
        alternatives = [recipe for recipe in candidates.get(number, [])
                        if quality(recipe) < quality(current)
                        and all(ref not in blocked_native and ref not in deferred_targets
                                and (ref <= NATIVE_MAX or ref in selected)
                                for ref in recipe.references)]
        alternatives.sort(key=lambda recipe: (*quality(recipe), PRIORITY[recipe.operation],
                                              recipe.references))
        for recipe in alternatives:
            if refine_coordinates and recipe.operation == 'J' and not line_candidate_supported(
                    recipe, refine_coordinates, incidence_lines[number]):
                continue
            if refine_coordinates and recipe.operation == 'I' and not direction_candidate_supported(
                    recipe, refine_coordinates, incidence_lines[number]):
                continue
            if refine_coordinates and recipe.operation in {'G', 'T'} and not conjugate_candidate_supported(
                    recipe, refine_coordinates, atlas):
                continue
            if atlas and recipe.operation == 'B' and not formula_candidate_supported(recipe, atlas):
                continue
            selected[number] = recipe
            try:
                depth, length = validate_graph(selected)
                nonlinear = conjugate_levels(selected)
                valid = (max(depth.values()) <= max_depth and max(length.values()) <= max_length
                         and max(nonlinear.values()) <= max_conjugates)
            except ValueError:
                valid = False
            if valid:
                break
            selected[number] = current
    # A later substitution may move a supporting line. Recheck the finished
    # graph and replace any intersection whose final lines disagree.
    if atlas:
        for _ in range(30):
            coordinates = numeric_coordinates(selected, atlas, native_directions)
            finite = set.intersection(*(set(points) for points in coordinates.values()))
            missing = set(selected) - finite
            if missing:
                number = min(missing)
                doomed = {number}
                while True:
                    more = {target for target, recipe in selected.items()
                            if target not in doomed and any(ref in doomed for ref in recipe.references)}
                    if not more:
                        break
                    doomed.update(more)
                if doomed & set(seeds):
                    raise ValueError(f'Nonfinite result reaches a reviewed seed through X({number})')
                for target in doomed:
                    del selected[target]
                print(f'Deferred nonfinite X({number}) and {len(doomed)-1} dependent recipes')
                continue
            invalid = [number for number, recipe in selected.items()
                       if (recipe.operation == 'J' and not line_candidate_supported(
                           recipe, coordinates, incidence_lines.get(number, [])))
                       or (recipe.operation == 'I' and not direction_candidate_supported(
                           recipe, coordinates, incidence_lines.get(number, [])))]
            if not invalid:
                break
            pruned = False
            for number in invalid:
                if number not in selected:
                    continue
                current = selected[number]
                options = sorted(candidates.get(number, []),
                                 key=lambda recipe: (*quality(recipe), PRIORITY[recipe.operation],
                                                     recipe.references))
                repaired = False
                for recipe in options:
                    if (recipe.operation != current.operation or recipe == current
                            or any(ref in blocked_native or ref in deferred_targets
                                   or ref > NATIVE_MAX and ref not in selected for ref in recipe.references)
                            or (recipe.operation == 'J' and not line_candidate_supported(
                                recipe, coordinates, incidence_lines[number]))
                            or (recipe.operation == 'I' and not direction_candidate_supported(
                                recipe, coordinates, incidence_lines[number]))):
                        continue
                    selected[number] = recipe
                    try:
                        depth, length = validate_graph(selected)
                        nonlinear = conjugate_levels(selected)
                        repaired = (max(depth.values()) <= max_depth and max(length.values()) <= max_length
                                    and max(nonlinear.values()) <= max_conjugates)
                    except ValueError:
                        repaired = False
                    if repaired:
                        break
                    selected[number] = current
                if not repaired:
                    selected[number] = current
                    doomed = {number}
                    while True:
                        more = {target for target, recipe in selected.items()
                                if target not in doomed and any(ref in doomed for ref in recipe.references)}
                        if not more:
                            break
                        doomed.update(more)
                    if doomed & set(seeds):
                        raise ValueError(f'Invalid line pair reaches a reviewed seed through X({number})')
                    for target in doomed:
                        del selected[target]
                    print(f'Deferred X({number}) and {len(doomed)-1} dependent recipes after final line screen')
                    pruned = True
                    break
            if pruned:
                continue
        else:
            raise ValueError('Line-pair consistency did not stabilize')
        coordinates = numeric_coordinates(selected, atlas, native_directions)
        for shape, points in coordinates.items():
            missing = set(selected) - set(points)
            if missing:
                raise ValueError(f'Nonfinite generated centers for {shape}: {sorted(missing)[:10]}')
    validate_graph(selected)
    validate_types(selected, set(native_directions))
    return selected


def chunks(records: dict[int, Recipe]) -> dict[str, str]:
    grouped: dict[int, list[Recipe]] = defaultdict(list)
    for recipe in records.values():
        grouped[recipe.number // 1000].append(recipe)
    return {f'{part}.txt': '\n'.join(recipe.row() for recipe in sorted(items, key=lambda item: item.number)) + '\n'
            for part, items in grouped.items()}


def fetch(parts: list[int]) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for index, part in enumerate(parts):
        if not 1 <= part <= 100:
            raise ValueError(f'Unexpected ETC part: {part}')
        if index:
            time.sleep(2)
        url = ('https://faculty.evansville.edu/ck6/encyclopedia/ETC.html' if part == 1
               else f'https://faculty.evansville.edu/ck6/encyclopedia/ETCPart{part}.html')
        for attempt in range(3):
            try:
                with urlopen(Request(url, headers={'User-Agent': 'triangle-center-import/1.0'}), timeout=90) as response:
                    source = response.read()
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        if len(source) < 10_000 or not HEADING.search(source.decode('utf-8', errors='replace')):
            raise ValueError(f'ETC page {part} has no recognizable entries')
        path = CACHE / f'ETCPart{part}.html'
        path.write_bytes(source)
        print(f'Fetched Part {part}: {len(source):,} bytes')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('fetch', 'native', 'build', 'check', 'verify'))
    parser.add_argument('--parts', type=int, nargs='*', default=[3, 4, 5, 37])
    parser.add_argument('--auto-operations', default='MRCAPLIJGTB',
                        help='Operations allowed from text extraction; existing seeds are always kept')
    parser.add_argument('--max-coordinate-anchors-per-component', type=int, default=6)
    parser.add_argument('--max-depth', type=int, default=6)
    parser.add_argument('--max-length', type=int, default=6000)
    parser.add_argument('--max-conjugates', type=int, default=1)
    args = parser.parse_args()
    if args.action == 'fetch':
        fetch(args.parts)
        return
    chunk_dir = DATA / 'chunks'
    blocked_native, native_directions = read_native_status(DATA / 'native-status.txt')
    if args.action == 'native':
        directions, weak = derive_native_directions(read_native_atlas(CACHE / 'native-atlas.json'), blocked_native)
        (DATA / 'native-status.txt').write_text(native_status_rows(blocked_native, directions, weak),
                                                encoding='utf-8', newline='\n')
        print(f'Native ideal directions: {len(directions)}; omitted conflicting IDs: {weak}')
        return
    blocked_native -= set(native_directions)
    deferred_targets = read_deferred_targets(DATA / 'deferred-centers.txt')
    if args.action == 'verify':
        records: dict[int, Recipe] = {}
        for path in sorted(chunk_dir.glob('*.txt')):
            for number, recipe in read_recipes(path).items():
                if number in records or number // 1000 != int(path.stem):
                    raise ValueError(f'Duplicate or misplaced X({number}) in {path}')
                records[number] = recipe
        depth, length = validate_graph(records)
        validate_types(records, set(native_directions))
        if any(ref in blocked_native for recipe in records.values() for ref in recipe.references):
            raise ValueError('Generated recipe references an unavailable native center')
        if set(records) & deferred_targets or any(ref in deferred_targets for recipe in records.values()
                                                   for ref in recipe.references):
            raise ValueError('Generated recipe includes a deferred center')
        print(f'Valid: {len(records)} recipes, max depth {max(depth.values())}, max estimated length {max(length.values())}')
        return
    if set(args.auto_operations) - set(ARITY):
        raise ValueError(f'Unknown operation in {args.auto_operations}')
    seeds = read_recipes(DATA / 'seeds.txt')
    all_candidates: dict[int, list[Recipe]] = {}
    coordinate_lines: dict[int, list[tuple[int, int]]] = {}
    entry_count = 0
    for part in args.parts:
        entries, candidates = read_page(part, blocked_native | deferred_targets, coordinate_lines)
        entry_count += len(entries)
        for number, options in candidates.items():
            if number in all_candidates:
                raise ValueError(f'X({number}) appears in multiple ETC parts')
            all_candidates[number] = options
        print(f'Part {part}: {len(entries)} entries, {sum(bool(v) for v in candidates.values())} with explicit parsed constructions')
    atlas = read_native_atlas(CACHE / 'native-atlas.json')
    eligible = {number: [recipe for recipe in options if recipe.operation in args.auto_operations]
                for number, options in all_candidates.items()}
    relation_only = {number: [recipe for recipe in options if recipe.operation != 'B']
                     for number, options in eligible.items()}
    baseline = select_recipes(relation_only, seeds, args.max_depth, args.max_length, args.max_conjugates,
                              blocked_native, deferred_targets, atlas, native_directions, require_seeds=False)
    priority = read_coordinate_priority(DATA / 'coordinate-priority.txt') if args.max_coordinate_anchors_per_component else set()
    anchors = coordinate_anchors(eligible, baseline, atlas, args.max_coordinate_anchors_per_component, priority,
                                 coordinate_lines, native_directions, deferred_targets)
    ideal_formulas = [(number, recipe) for number, options in eligible.items() for recipe in options
                      if number > NATIVE_MAX and recipe.operation == 'B' and all(
                          isinstance(numeric_formula_projective(recipe, [tuple(xy) for xy in abc]), Ideal)
                          for abc in atlas['triangles'].values())]
    print(f'Coordinate anchors: {len(anchors)} barycentric; '
          f'{len(ideal_formulas)} parsed formulas deferred as ideal')
    selected = select_recipes({number: options + ([anchors[number]] if number in anchors else [])
                               for number, options in relation_only.items()},
                              seeds, args.max_depth, args.max_length, args.max_conjugates,
                              blocked_native, deferred_targets, atlas, native_directions)
    output = chunks(selected)
    generated = len(selected) - len(seeds)
    print(f'Selected {len(selected)} recipes ({generated} automatic), from {entry_count} entries')
    print(f'Operations: {dict(sorted(Counter(recipe.operation for recipe in selected.values()).items()))}')
    print(f'Chunks: {len(output)}, {sum(len(value.encode()) for value in output.values()):,} bytes')
    if args.action == 'build':
        chunk_dir.mkdir(parents=True, exist_ok=True)
        for name, content in output.items():
            (chunk_dir / name).write_text(content, encoding='utf-8', newline='\n')
        for path in chunk_dir.glob('*.txt'):
            if path.name not in output:
                path.unlink()
        audit = 'id\tpart\top\trefs\tevidence\n' + ''.join(
            f'{recipe.number}\t{recipe.part}\t{recipe.operation}\t'
            f'{recipe.formula or ",".join(map(str, recipe.references))}\t{recipe.evidence[:300]}\n'
            for recipe in sorted(selected.values(), key=lambda item: item.number) if recipe.part)
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / 'selected.tsv').write_text(audit, encoding='utf-8', newline='\n')
    else:
        actual = {path.name: path.read_text(encoding='utf-8') for path in chunk_dir.glob('*.txt')}
        if output != actual:
            raise ValueError('Generated chunks differ from committed files; run build after reviewing source pages')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileNotFoundError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
