"""Manually fetch ETC pages, extract short constructions, and build compact chunks.

Requires Python 3 and beautifulsoup4. No network access occurs during build/check.
The extractor recognizes explicit relations and a conservative subset of cyclic
coordinates within each X(n) entry; it never interprets unrelated incidences.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from html import unescape
from itertools import combinations
from functools import lru_cache
from pathlib import Path
import json
import math
import re
import sys
import time
from urllib.request import Request, urlopen

import triangle_center_support as support
from triangle_center_support import stage, report
from triangle_center_graph import SelectedGraph, NumericTransactions, CoordinateOverlay
from triangle_center_sources import prepare_source
from triangle_center_domains import DOMAIN_KINDS, complex_dependency_roots

from bs4 import BeautifulSoup
from triangle_center_coordinates import (coordinate_candidates, coordinate_text, normalize_formula, evaluate_formula, homogeneous_degree,
                                         rotate_formula, side_environment, validate_formula)


ROOT = Path(__file__).resolve().parents[4]
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
CIRCUM_INVERSE = re.compile(rf'^(?:inverse-in-circumcircle|circumcircle-inverse) of {POINT}', re.I)
CIRCLE_CENTER = re.compile(rf'^center of (?:the )?circle\s*\{{\s*{POINT}\s*,\s*{POINT}\s*,\s*{POINT}\s*\}}', re.I)
CONDITIONAL = re.compile(r'\b(?:if|when|provided|assuming|unless|only for|for acute|for obtuse|wrt|with respect to|relative to)\b', re.I)
INFINITE_DEFINITION = re.compile(r'\bX\s*\(\s*(\d+)\s*\)\s*(?:=|is)\s*(?:the\s+)?'
                                 r'(?:infinite point|infinity point|ideal point|point at infinity)\b', re.I)
ARITY = {'M': 2, 'R': 2, 'J': 4, 'I': 2, 'C': 1, 'A': 1, 'P': 3, 'L': 3, 'G': 1, 'T': 1, 'V': 1, 'F': -1, 'B': 0, 'O': 3}
PRIORITY = {'M': 0, 'R': 1, 'C': 2, 'A': 3, 'P': 4, 'L': 5, 'I': 6, 'V': 7, 'J': 8, 'G': 9, 'T': 10, 'F': 11, 'B': 12, 'O': 7}
RISK = {'M': 0, 'R': 0, 'C': 0, 'A': 0, 'I': 0, 'P': 1, 'L': 1, 'V': 1, 'J': 2, 'G': 3, 'T': 3, 'F': 3, 'B': 4, 'O': 1}
LINE_LIST = re.compile(r'^(?:X\s*)?\(\s*(\d+)\s*\)\s*(?:=\s*)?lies(?: on)?\b.*\b(?:these|this)\s*(?:\(parallel\)\s*)?lines?\s*:\s*(.*)$', re.I)
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
        if self.operation == 'F':
            return f'{self.number} F ' + ' '.join(f'{ref}:{coef}' for ref, coef in zip(self.references, self.formula.split('|')))
        return ' '.join((str(self.number), self.operation, *map(str, self.references)))


class RecipeCandidates:
    """Explicit recipes plus a shared incidence family, expanded only on demand."""
    def __init__(self, number, explicit, lines, part=0, line_filters=()):
        self.number = number
        self.explicit = list(explicit)
        self.lines = tuple(tuple(pair) for pair in lines)
        self.part = part
        self.line_filters = line_filters

    def inferred(self):
        explicit = {(r.operation, r.references) for r in self.explicit}
        for first, second in combinations(self.lines, 2):
            refs = (*first, *second)
            if (self.number in refs or not set(first).isdisjoint(second)
                    or ('J', refs) in explicit):
                continue
            recipe = Recipe(self.number, 'J', refs, self.part,
                            f'X({self.number}) lies on these lines: {first}, {second}')
            if all(predicate(recipe) for predicate in self.line_filters):
                yield recipe

    def __iter__(self):
        yield from self.explicit
        yield from self.inferred()

    def __bool__(self):
        return bool(self.explicit) or next(self.inferred(), None) is not None

    def filtered(self, predicate):
        return RecipeCandidates(self.number, [r for r in self.explicit if predicate(r)],
                                self.lines, self.part, (*self.line_filters, predicate))

    def __add__(self, extra):
        return RecipeCandidates(self.number, self.explicit + extra, self.lines, self.part, self.line_filters)

    def append(self, recipe):
        self.explicit.append(recipe)

    def __eq__(self, other):
        return isinstance(other, RecipeCandidates) and (self.number, self.explicit, self.lines, self.part) == (
            other.number, other.explicit, other.lines, other.part)


def filter_candidates(options, predicate):
    return options.filtered(predicate) if isinstance(options, RecipeCandidates) else [r for r in options if predicate(r)]


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


def quality(recipe: Recipe) -> tuple[float, int]:
    # An explicitly stated intersection is stronger evidence than choosing
    # two arbitrary pairs from a list of lines that merely pass through X(n).
    incidence_only = int('lies on these lines:' in recipe.evidence.lower())
    if recipe.operation == 'F':
        return (0 if all(not re.search(r'[A-Za-z_]', c) for c in recipe.formula.split('|')) else 3.5), incidence_only
    return RISK[recipe.operation], incidence_only


def combo_candidate(number: int, line: str, part: int) -> Recipe | None:
    """Parse complete sums of scalar times X(n), without interpreting prose."""
    head = re.match(r'^X\s*\(\s*(\d+)\s*\)\s*=\s*(.*)$', line, re.I)
    if not head or int(head.group(1)) != number:
        return None
    body = head.group(2)
    matches = list(re.finditer(r'X\s*(?:\(\s*(\d+)\s*\)|\[\s*(\d+)\s*\])', body, re.I))
    if not 2 <= len(matches) <= 6 or body[matches[-1].end():].strip():
        return None
    refs, coefficients = [], []
    start = 0
    for i, match in enumerate(matches):
        scalar = body[start:match.start()].strip()
        if i and (not scalar or scalar[0] not in '+-'):
            return None
        if scalar.endswith('*'):
            scalar = scalar[:-1].strip()
        scalar = {'': '1', '+': '1', '-': '-1'}.get(scalar, scalar)
        depth = 0
        for pos, char in enumerate(scalar):
            if char in '([':
                depth += 1
            elif char in ')]':
                depth -= 1
            elif char in '+-' and depth == 0 and pos and scalar[pos-1] != '^':
                return None
            if depth < 0:
                return None
        if depth:
            return None
        formula = normalize_formula(scalar)
        reference = int(match.group(1) or match.group(2))
        if not formula or reference <= 0 or reference == number:
            return None
        refs.append(reference)
        coefficients.append(formula)
        start = match.end()
    if len(set(refs)) != len(refs):
        return None
    return Recipe(number, 'F', tuple(refs), part, line, '|'.join(coefficients))


def shinagawa_candidates(number: int, line: str, part: int) -> list[Recipe]:
    """Convert ETC's (u,v) into the ordinary normalized combo (3u)X(2)+vX(4)."""
    head = re.search(r'\bAs\s+a\s+point\s+on\s+the\s+Euler\s+line\s*,\s*X\s*\(\s*(\d+)\s*\)\s+has\s+Shinagawa\s+coefficients\s*', line, re.I)
    if not head or int(head.group(1)) != number or CONDITIONAL.search(line[head.end():]):
        return []

    def parse_pair(start: int):
        if start >= len(line) or line[start] != '(':
            return None
        depth, comma, in_sum = 0, None, False
        for pos in range(start, len(line)):
            char = line[pos]
            if char == '$':
                in_sum = not in_sum
            elif not in_sum and char in '([':
                depth += 1
            elif not in_sum and char in ')]':
                depth -= 1
                if depth == 0:
                    if char != ')' or comma is None:
                        return None
                    return line[start+1:comma], line[comma+1:pos], pos+1
                if depth < 0:
                    return None
            elif not in_sum and char == ',' and depth == 1:
                if comma is not None:
                    return None
                comma = pos
        return None

    def scalar(raw: str) -> str | None:
        def expand(match: re.Match) -> str:
            term = normalize_formula(match.group(1))
            if not term:
                raise ValueError('Invalid cyclic sum')
            return '(' + '+'.join(rotate_formula(term, i) for i in range(3)) + ')'
        try:
            return normalize_formula(re.sub(r'\$([^$]+)\$', expand, raw))
        except ValueError:
            return None

    found: list[Recipe] = []
    position = head.end()
    while (pair := parse_pair(position)) is not None:
        u, v, end = pair
        first, second = scalar(u), scalar(v)
        if first and second:
            valid_first, degree_first = homogeneous_degree(first)
            valid_second, degree_second = homogeneous_degree(second)
            if valid_first and valid_second and (degree_first is None or degree_second is None
                    or math.isclose(degree_first, degree_second, abs_tol=1e-10)):
                weighted = normalize_formula(f'3*({first})')
                if weighted:
                    found.append(Recipe(number, 'F', (2, 4), part, line, f'{weighted}|{second}'))
        following = re.match(r'\s*,?\s*and\s+also\s*(?:Shinagawa\s+coefficients\s*)?', line[end:], re.I)
        if not following:
            break
        position = end + following.end()
    return found


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
        r'<br\s*/?>|</?(?:p|h3|div)\b[^>]*>|<hr\b[^>]*>',
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
    # ETC uses both “these lines” lists and “this line” for the line at infinity.
    if (30, 511) in coordinate_incidence_lines(number, lines):
        return True
    for line in lines:
        heading = LINE_LIST.match(line)
        if heading and int(heading.group(1)) == number:
            if '(parallel)' in line[:heading.start(2)].lower():
                return True
    return any(int(match.group(1)) == number for line in lines
               for match in INFINITE_DEFINITION.finditer(line))


def extract_entry(number: int, fragment: str, part: int,
                  excluded: set[int] | None = None, *, compact: bool = False):
    found: dict[tuple[str, tuple[int, ...]], str] = {}
    lines = relation_lines(fragment)
    if is_infinite_entry(number, lines):
        found[('I', ())] = f'X({number}) is ideal; no usable direction selected'
        for first, second in listed_lines(number, lines, excluded, limit=None):
            if (first, second) != (30, 511):
                found[('I', (first, second))] = f'X({number}) is the ideal point in direction X({first})X({second})'
        return [Recipe(number, opcode, refs, part, evidence) for (opcode, refs), evidence in sorted(found.items())
                if all(reference != number for reference in refs)]
    incidence = listed_lines(number, lines, excluded)
    for first, second in (() if compact else combinations(incidence, 2)):
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
                                (LINE_REFLECTION, 'L'), (ISOGONAL, 'G'), (ISOTOMIC, 'T'),
                                (CIRCUM_INVERSE, 'V'), (CIRCLE_CENTER, 'O')):
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
    coordinate_view = coordinate_text(fragment)
    recipes.extend(candidate for line in coordinate_view
                   if (candidate := combo_candidate(number, line, part)) is not None)
    recipes.extend(candidate for line in coordinate_view
                   for candidate in shinagawa_candidates(number, line, part))
    recipes.extend(Recipe(number, kind, (), part, evidence, formula)
                   for kind, formula, evidence in coordinate_candidates(fragment, coordinate_view))
    return RecipeCandidates(number, recipes, incidence, part) if compact else recipes


@stage
def read_page(part: int, excluded: set[int] | None = None,
              coordinate_lines: dict[int, list[tuple[int, int]]] | None = None) -> tuple[list[int], dict[int, list[Recipe]]]:
    path = CACHE / f'ETCPart{part}.html'
    source = prepare_source(part, path.read_text(encoding='utf-8', errors='replace'))
    issues = support.heading_issues(source)
    if issues:
        raise ValueError(f'Part {part} source preflight failed: ' + '; '.join(issues))
    cache_path = CACHE / 'extracted' / f'{support.cache_key(source, excluded or set(), part)}.json.gz'
    cached = support.read_cache(cache_path) if support.CACHE_ENABLED else None
    if isinstance(cached, dict) and cached.get('schema') == 2:
        try:
            def restore(number, value):
                explicit = [Recipe(row[0], row[1], tuple(row[2]), *row[3:]) for row in value['recipes']]
                return (RecipeCandidates(int(number), explicit, value['lines'], part)
                        if 'lines' in value else explicit)
            restored = {int(n): restore(n, value) for n, value in cached['candidates'].items()}
            restored_lines = {int(n): [tuple(pair) for pair in pairs] for n, pairs in cached['lines'].items()}
            entries = cached['entries']
        except (KeyError, TypeError, ValueError):
            pass
        else:
            if coordinate_lines is not None:
                coordinate_lines.update(restored_lines)
            report('cache-hit', part=part, entries=len(entries))
            return entries, restored
    report('cache-miss', part=part)
    entries: list[int] = []
    candidates: dict[int, list[Recipe]] = {}
    page_lines: dict[int, list[tuple[int, int]]] = {}
    for number, fragment in split_entries(source):
        if number in candidates:
            raise ValueError(f'Duplicate X({number}) heading in {path}')
        entries.append(number)
        candidates[number] = (extract_entry(number, fragment, part, excluded, compact=True)
                              if number > NATIVE_MAX else [])
        if any(r.operation == 'B' or 'Shinagawa coefficients' in r.evidence
               for r in (candidates[number].explicit if isinstance(candidates[number], RecipeCandidates) else candidates[number])):
            page_lines[number] = coordinate_incidence_lines(number, relation_lines(fragment))
    if not entries or entries != sorted(entries):
        raise ValueError(f'Missing or unordered X(n) headings in {path}')
    if support.CACHE_ENABLED:
        def compact_value(options):
            explicit = options.explicit if isinstance(options, RecipeCandidates) else options
            value = dict(recipes=[[r.number, r.operation, r.references, r.part, r.evidence, r.formula] for r in explicit])
            if isinstance(options, RecipeCandidates):
                value['lines'] = options.lines
            return value
        support.write_cache(cache_path, dict(schema=2, entries=entries,
            candidates={n: compact_value(options) for n, options in candidates.items()}, lines=page_lines))
    if coordinate_lines is not None:
        coordinate_lines.update(page_lines)
    return entries, candidates


def read_recipes(path: Path, skipped: dict[int, str] | None = None,
                 domains: dict[int, str] | None = None) -> dict[int, Recipe]:
    records: dict[int, Recipe] = {}
    reviewed_domains: dict[int, str] = {}
    for row in path.read_text(encoding='utf-8').splitlines():
        if not row.strip() or row.lstrip().startswith('#'):
            continue
        row = row.split('#', 1)[0].strip()
        if not row:
            continue
        fields = row.split()
        number, opcode = int(fields[0]), fields[1]
        if opcode == 'DOMAIN' and skipped is not None:
            if (number <= NATIVE_MAX or len(fields) != 3 or fields[2] not in DOMAIN_KINDS
                    or number in reviewed_domains or number in skipped):
                raise ValueError(f'Invalid or duplicate domain in {path}: {row}')
            reviewed_domains[number] = fields[2]
            continue
        if opcode == 'SKIP' and skipped is not None:
            if number <= NATIVE_MAX or len(fields) < 3 or number in skipped or number in records or number in reviewed_domains:
                raise ValueError(f'Invalid or duplicate skip in {path}: {row}')
            skipped[number] = ' '.join(fields[2:])
            continue
        if skipped is not None and number in skipped:
            raise ValueError(f'Conflicting skip and recipe in {path}: {row}')
        formula = fields[2] if opcode == 'B' and len(fields) == 3 else ''
        if opcode == 'F':
            pairs = [field.split(':') for field in fields[2:]]
            if not all(len(pair) == 2 for pair in pairs):
                raise ValueError(f'Invalid combo in {path}: {row}')
            refs = tuple(int(pair[0]) for pair in pairs)
            formula = '|'.join(pair[1] for pair in pairs)
        else:
            refs = () if opcode == 'B' else tuple(map(int, fields[2:]))
        if (number <= NATIVE_MAX or opcode not in ARITY or (len(refs) != ARITY[opcode] and not (opcode == 'I' and not refs) and not (opcode == 'F' and 2 <= len(refs) <= 6))
                or any(reference <= 0 or reference == number for reference in refs) or number in records
                or (opcode == 'B' and not formula)
                or (opcode == 'F' and (len(set(refs)) != len(refs) or any(not f for f in formula.split('|'))))):
            raise ValueError(f'Invalid or duplicate recipe in {path}: {row}')
        if formula:
            for scalar in formula.split('|'):
                validate_formula(scalar)
        records[number] = Recipe(number, opcode, refs, formula=formula)
    if domains is not None:
        domains.update(reviewed_domains)
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


@stage
def coordinate_anchors(candidates: dict[int, list[Recipe]], baseline: dict[int, Recipe],
                       atlas: dict, per_component: int | None, priority: set[int],
                       coordinate_lines: dict[int, list[tuple[int, int]]],
                       native_directions: dict[int, tuple[int, int]],
                       excluded: set[int] | None = None) -> dict[int, Recipe]:
    """Screen formulas, then allocate anchors separately to dependency components."""
    if per_component is not None and per_component <= 0:
        return {}
    components = unresolved_components(candidates, baseline, excluded)
    sizes = Counter(components.values())
    baseline_coordinates = numeric_coordinates(baseline, atlas, native_directions)

    def agrees_with_known_line(recipe: Recipe) -> bool:
        for shape, points in baseline_coordinates.items():
            center = numeric_formula(recipe, [tuple(xy) for xy in atlas['triangles'][shape]])
            if center is None:
                continue
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
        formulas = [recipe for recipe in (options.explicit if isinstance(options, RecipeCandidates) else options) if recipe.operation == 'B' and homogeneous_degree(recipe.formula)[0]
                    and formula_candidate_supported(recipe, atlas) and agrees_with_known_line(recipe)]
        if not formulas:
            continue
        formulas.sort(key=lambda recipe: (-sum(numeric_formula(recipe, [tuple(xy) for xy in abc]) is not None
                                                for abc in atlas['triangles'].values()), len(recipe.formula)))
        samples = [[numeric_formula(recipe, [tuple(xy) for xy in abc])
                    for abc in atlas['triangles'].values()] for recipe in formulas]
        if any(any(math.dist(p, q) > 1e-5 * max(1, math.hypot(*p), math.hypot(*q))
                   for p, q in zip(samples[0], other) if p is not None and q is not None) for other in samples[1:]):
            continue
        chosen = formulas[0]
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
        allowance = (len(options) if per_component is None else
                     max(len(pinned), min(per_component, max(1, math.ceil(sizes[component] / 5)))))
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
    if recipe.operation == 'F':
        return 600 + 18 * len(recipe.formula) + sum(children)
    return (95 if recipe.operation == 'V' else 24) + sum(children)


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
        validate_recipe_inputs(recipe, records, native_ideal)


def validate_recipe_inputs(recipe: Recipe, records: dict[int, Recipe], native_ideal: set[int]) -> None:
    if any(ref > NATIVE_MAX and records[ref].operation == 'I' and not records[ref].references
           for ref in recipe.references):
        raise ValueError(f'Unknown ideal direction used in X({recipe.number}) {recipe.operation}')
    ideal = [ref in native_ideal or ref > NATIVE_MAX and records[ref].operation == 'I'
             for ref in recipe.references]
    op = recipe.operation
    valid = (not any(ideal) if op in {'M', 'R', 'C', 'A', 'P', 'L', 'I', 'V', 'F', 'O'} else
             not (ideal[0] and ideal[1] or ideal[2] and ideal[3]) if op == 'J' else True)
    if not valid:
        raise ValueError(f'Invalid ideal-point input in X({recipe.number}) {op}')


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


def numeric_circle_center(points):
    if any(isinstance(p, Ideal) for p in points):
        return None
    a,b,c = points
    u,v = (b[0]-a[0],b[1]-a[1]), (c[0]-a[0],c[1]-a[1])
    determinant = 2*(u[0]*v[1]-u[1]*v[0])
    if determinant == 0:
        return None
    uu,vv = sum(x*x for x in u),sum(x*x for x in v)
    result = (a[0]+(uu*v[1]-vv*u[1])/determinant,
              a[1]+(u[0]*vv-v[0]*uu)/determinant)
    return result if all(math.isfinite(x) for x in result) else None


def numeric_circum_inverse(p: Coordinate, abc: list[tuple[float, float]]) -> Coordinate | None:
    if isinstance(p, Ideal):
        return None
    a, b, c = abc
    u, v = (b[0]-a[0], b[1]-a[1]), (c[0]-a[0], c[1]-a[1])
    determinant = 2 * (u[0]*v[1]-u[1]*v[0])
    if abs(determinant) < 1e-12:
        return None
    uu, vv = u[0]**2+u[1]**2, v[0]**2+v[1]**2
    center = (a[0]+(uu*v[1]-vv*u[1])/determinant,
              a[1]+(vv*u[0]-uu*v[0])/determinant)
    offset = (p[0]-center[0], p[1]-center[1])
    squared = offset[0]**2+offset[1]**2
    if squared < 1e-12:
        return None
    radius_squared = (a[0]-center[0])**2+(a[1]-center[1])**2
    answer = (center[0]+radius_squared*offset[0]/squared,
              center[1]+radius_squared*offset[1]/squared)
    return answer if all(math.isfinite(value) for value in answer) else None


def numeric_formula_projective(recipe: Recipe, abc: list[tuple[float, float]]) -> Coordinate | None:
    return _formula_sample(recipe.formula, tuple(tuple(xy) for xy in abc))


@lru_cache(maxsize=16384)
def _formula_sample(formula: str, abc: tuple[tuple[float, float], ...]) -> Coordinate | None:
    # Pure, immutable sample results, including None/ideal; never keyed only by ID.
    a, b, c = (math.dist(abc[1], abc[2]), math.dist(abc[2], abc[0]), math.dist(abc[0], abc[1]))
    values = side_environment(a, b, c)
    weights = [evaluate_formula(rotate_formula(formula, index), values) for index in range(3)]
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


def numeric_combo(recipe: Recipe, values: list[Coordinate], abc: list[tuple[float, float]]) -> tuple[float, float] | None:
    if any(isinstance(p, Ideal) for p in values):
        return None
    a, b, c = math.dist(abc[1], abc[2]), math.dist(abc[2], abc[0]), math.dist(abc[0], abc[1])
    env = side_environment(a, b, c)
    weights = [evaluate_formula(f, env) for f in recipe.formula.split('|')]
    if any(w is None for w in weights):
        return None
    total = sum(weights)
    if abs(total) <= 1e-12 * max(1e-300, sum(abs(w) for w in weights)):
        return None
    result = tuple(sum(w * p[i] for w, p in zip(weights, values)) / total for i in (0, 1))
    return result if all(math.isfinite(v) for v in result) else None


def numeric_coordinates(records: dict[int, Recipe], atlas: dict,
                        native_directions: dict[int, tuple[int, int]] | None = None, *,
                        cached=None, dirty=None, overlay=False) -> dict[str, dict[int, Coordinate]]:
    results: dict[str, dict[int, Coordinate]] = {}
    for shape, native in atlas['coordinates'].items():
        points: dict[int, Coordinate] = (CoordinateOverlay(cached[shape], dirty or ()) if overlay and cached is not None else
                                          dict(cached[shape]) if cached is not None else
                                          {int(number): tuple(xy) for number, xy in native.items()})
        if not overlay:
            for number in dirty or ():
                points.pop(number, None)
        for number, (a, b) in ((native_directions or {}).items() if cached is None else ()):
            if a in points and b in points and not isinstance(points[a], Ideal) and not isinstance(points[b], Ideal):
                d = direction(points[a], points[b])
                if d is not None and math.hypot(*d) > 1e-9:
                    points[number] = Ideal(*d)
        abc = [tuple(xy) for xy in atlas['triangles'][shape]]
        visiting: set[int] = set()

        failed: set[int] = set()

        def point(number: int) -> Coordinate | None:
            if number in failed:
                return None
            result = evaluate_point(number)
            if result is None:
                failed.add(number)
            return result

        def evaluate_point(number: int) -> Coordinate | None:
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
            elif op == 'F':
                answer = numeric_combo(recipe, values, abc)
            elif op == 'I':
                if not values:
                    return None  # Directionless coverage markers are not numeric inputs.
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
            elif op == 'O':
                answer = numeric_circle_center(values)
            elif op == 'V':
                answer = numeric_circum_inverse(values[0], abc)
            else:
                answer = numeric_conjugate(values[0], abc, op == 'G')
            if answer is not None and all(math.isfinite(value) for value in
                                          ((answer.dx, answer.dy) if isinstance(answer, Ideal) else answer)):
                points[number] = answer
                return answer
            return None

        for number in (records if dirty is None else sorted(dirty)):
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


def inversion_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]],
                                  atlas: dict) -> bool:
    return all((source := points.get(recipe.references[0])) is not None
               and numeric_circum_inverse(source, atlas['triangles'][shape]) is not None
               for shape, points in coordinates.items())


def formula_candidate_supported(recipe: Recipe, atlas: dict) -> bool:
    results = [numeric_formula_projective(recipe, [tuple(xy) for xy in abc])
               for abc in atlas['triangles'].values()]
    # An undefined sample does not prove a formula is undefined everywhere.
    # Do not admit a direction-only result as a finite coordinate recipe.
    return any(isinstance(result, tuple) for result in results) or all(result is None for result in results)


def combo_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]], atlas: dict) -> bool:
    valid = 0
    for shape, points in coordinates.items():
        if any(ref not in points for ref in recipe.references):
            return False
        result = numeric_combo(recipe, [points[ref] for ref in recipe.references], atlas['triangles'][shape])
        if result is None:
            continue
        valid += 1
        known = points.get(recipe.number)
        if known is not None and (isinstance(known, Ideal) or math.dist(result, known) > 1e-5 * max(1, math.hypot(*result), math.hypot(*known))):
            return False
    return valid > 0


def shinagawa_candidate_supported(recipe: Recipe, coordinates: dict[str, dict[int, Coordinate]], atlas: dict,
                                  alternatives: list[Recipe], lines: list[tuple[int, int]]) -> bool:
    if not combo_candidate_supported(recipe, coordinates, atlas):
        return False
    for shape, points in coordinates.items():
        abc = atlas['triangles'][shape]
        target = numeric_combo(recipe, [points[ref] for ref in recipe.references], abc)
        if target is None:
            continue
        for option in alternatives:
            if option.operation != 'B' or not homogeneous_degree(option.formula)[0]:
                continue
            reference = numeric_formula(option, abc)
            if reference is not None and math.dist(target, reference) > 1e-5 * max(1, math.hypot(*target), math.hypot(*reference)):
                return False
        distances = []
        for a, b in lines:
            if a not in points or b not in points:
                continue
            line = line_data(points[a], points[b])
            if line is None:
                continue
            base, direction = line
            distances.append(abs(direction[0]*(target[1]-base[1])-direction[1]*(target[0]-base[0])) / math.hypot(*direction))
        if distances and min(distances) > 1e-5 * max(1, math.hypot(*target)):
            return False
    return True


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
              '# python scripts/geogebra/tools/triangle_centers/triangle_center_import.py native\n'
              + ''.join(f'# X({number}) has conflicting direction lines.\n' for number in weak))
    return header + ''.join(f'{number} {directions[number][0]} {directions[number][1]}\n'
                            if number in directions else f'{number}\n'
                            for number in sorted(unavailable))


@stage
def select_recipes(candidates: dict[int, list[Recipe]], seeds: dict[int, Recipe],
                   max_depth: int, max_length: int | None, max_conjugates: int = 1,
                   blocked_native: set[int] | None = None,
                   deferred_targets: set[int] | None = None, atlas: dict | None = None,
                   native_directions: dict[int, tuple[int, int]] | None = None,
                   require_seeds: bool = True) -> dict[int, Recipe]:
    # A reviewed seed may depend on another extended center. Admit it only
    # after its references have closed, just like automatically parsed recipes.
    selected = {number: recipe for number, recipe in seeds.items()
                if all(reference <= NATIVE_MAX for reference in recipe.references)}
    native_directions = native_directions or {}
    native_ideal = set(native_directions)
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
        if isinstance(options, RecipeCandidates):
            incidence_lines[number] = sorted(set(options.lines))
        else:
            incidence_lines[number] = sorted({tuple(recipe.references[index:index+2]) for recipe in options
                                              if recipe.operation == 'J' and 'lies on these lines:' in recipe.evidence.lower()
                                              for index in (0, 2)}
                                             | {recipe.references for recipe in options if recipe.operation == 'I'})

    families_expanded = active_visits = 0
    closure_screened = Counter()

    def ranked_options(options, depth, length, nonlinear):
        nonlocal families_expanded
        def ready_rank(recipes):
            ranked = []
            for recipe in recipes:
                if any(ref in blocked_native or ref in deferred_targets
                       or ref > NATIVE_MAX and ref not in selected for ref in recipe.references):
                    continue
                d = 1 + max((depth.get(ref, 0) for ref in recipe.references), default=0)
                size = estimated_recipe_length(recipe, [length.get(ref, 27) for ref in recipe.references])
                conjugates = int(recipe.operation in {'G', 'T'}) + max(
                    (nonlinear.get(ref, 0) for ref in recipe.references), default=0)
                if d <= max_depth and (max_length is None or size <= max_length) and conjugates <= max_conjugates:
                    ranked.append(((*quality(recipe), d, size, PRIORITY[recipe.operation], recipe.references), recipe))
            ranked.sort(key=lambda item: item[0])
            return ranked
        if isinstance(options, RecipeCandidates):
            # These groups have disjoint quality ranges. Only generate inferred
            # intersections if every better explicit construction has failed.
            yield from ready_rank(r for r in options.explicit if quality(r) <= (2, 1))
            families_expanded += 1
            yield from ready_rank(options.inferred())
            yield from ready_rank(r for r in options.explicit if quality(r) > (2, 1))
        else:
            yield from ready_rank(options)

    # Watch construction inputs AND incidence evidence. A newly available third
    # support line may make an intersection valid without changing its four inputs.
    watchers: dict[int, set[int]] = defaultdict(set)
    for number in pending:
        options = [seeds[number]] if number in seeds else candidates.get(number, [])
        explicit = options.explicit if isinstance(options, RecipeCandidates) else options
        refs = {ref for recipe in explicit for ref in recipe.references}
        if isinstance(options, RecipeCandidates):
            refs.update(ref for pair in options.lines for ref in pair)
        refs.update(ref for pair in incidence_lines.get(number, []) for ref in pair)
        for ref in refs:
            if ref > NATIVE_MAX:
                watchers[ref].add(number)
    frontier = set(pending)
    coordinate_snapshot = None
    coordinate_dirty = None
    while pending:
        if not frontier:
            frontier = set(pending)
            report('closure-audit', pending=len(pending))
        report('closure', selected=len(selected), pending=len(pending), active=len(frontier))
        possible: list[tuple[tuple, Recipe]] = []
        depth, length = validate_graph(selected)
        nonlinear = conjugate_levels(selected)
        coordinates = (numeric_coordinates(selected, atlas, native_directions,
                                           cached=coordinate_snapshot, dirty=coordinate_dirty) if atlas else None)
        coordinate_snapshot = coordinates
        coordinate_dirty = set()
        active_visits += len(frontier)
        for number in frontier:
            for key, recipe in ranked_options(
                    [seeds[number]] if number in seeds else candidates.get(number, []), depth, length, nonlinear):
                if any(ref in blocked_native or ref in deferred_targets
                       or ref > NATIVE_MAX and ref not in selected
                       for ref in recipe.references):
                    continue
                try:
                    validate_recipe_inputs(recipe, selected, native_ideal)
                except ValueError:
                    continue
                closure_screened[recipe.operation] += 1
                if coordinates and recipe.operation == 'J' and not line_candidate_supported(
                        recipe, coordinates, incidence_lines.get(number, [])):
                    continue
                if coordinates and recipe.operation == 'I' and not direction_candidate_supported(
                        recipe, coordinates, incidence_lines.get(number, [])):
                    continue
                if coordinates and recipe.operation in {'G', 'T'} and not conjugate_candidate_supported(
                        recipe, coordinates, atlas):
                    continue
                if coordinates and recipe.operation == 'V' and not inversion_candidate_supported(
                        recipe, coordinates, atlas):
                    continue
                if coordinates and recipe.operation == 'F' and not combo_candidate_supported(recipe, coordinates, atlas):
                    continue
                if atlas and recipe.operation == 'B' and not formula_candidate_supported(recipe, atlas):
                    continue
                possible.append((key, recipe))
                break  # First screened candidate is best in this fixed snapshot.
        if not possible:
            if frontier != pending:
                frontier = set(pending)
                report('closure-audit', pending=len(pending))
                continue
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
        coordinate_dirty = set(best)
        frontier = {target for number in best for target in watchers.get(number, ()) if target in pending}
    report('closure-done', active_visits=active_visits, screened=dict(closure_screened),
           families_expanded=families_expanded)
    if require_seeds and set(seeds) - set(selected):
        raise ValueError(f'Unclosed reviewed seeds: {sorted(set(seeds) - set(selected))}')
    # A line-list intersection may enter before the point needed by a simpler
    # definition. Reconsider it after the reachable graph has closed.
    graph = SelectedGraph(selected, NATIVE_MAX, estimated_recipe_length,
                          (max_depth, max_length, max_conjugates),
                          lambda recipe, records: validate_recipe_inputs(recipe, records, native_ideal))
    def supported(recipe, coordinates):
        if not atlas:
            return True
        op = recipe.operation
        if op == 'J':
            return line_candidate_supported(recipe, coordinates, incidence_lines.get(recipe.number, []))
        if op == 'I':
            return direction_candidate_supported(recipe, coordinates, incidence_lines.get(recipe.number, []))
        if op in {'G', 'T'}:
            return conjugate_candidate_supported(recipe, coordinates, atlas)
        if op == 'V':
            return inversion_candidate_supported(recipe, coordinates, atlas)
        if op == 'F':
            return combo_candidate_supported(recipe, coordinates, atlas)
        if op == 'B':
            return formula_candidate_supported(recipe, atlas)
        return True

    def valid_result(number, records, coordinates):
        recipe = records[number]
        if recipe.operation == 'B':
            return formula_candidate_supported(recipe, atlas)
        if not any(number in points for points in coordinates.values()):
            return False
        # Preserve the final-screen contract: conditional non-incidence results
        # need a valid sample; J/I must also retain their incidence evidence.
        return supported(recipe, coordinates) if recipe.operation in {'J', 'I'} else True

    geometry = (NumericTransactions(graph,
                lambda records, cached, dirty: numeric_coordinates(records, atlas, native_directions,
                                                                    cached=cached, dirty=dirty, overlay=True),
                valid_result, {n: {ref for pair in lines for ref in pair}
                               for n, lines in incidence_lines.items()}) if atlas else None)

    def attempt(recipe):
        if any(ref in blocked_native or ref in deferred_targets
               or ref > NATIVE_MAX and ref not in selected for ref in recipe.references):
            return False
        try:
            validate_recipe_inputs(recipe, selected, native_ideal)
        except ValueError:
            return False
        if geometry and not supported(recipe, geometry.coordinates):
            return False
        return geometry.apply(recipe) if geometry else graph.replace(recipe)

    for number in sorted(set(selected) - set(seeds)):
        current = selected[number]
        options = candidates.get(number, [])
        cheaper_options = (options.explicit if isinstance(options, RecipeCandidates)
                           and quality(current) <= (2, 1) else options)
        alternatives = sorted((recipe for recipe in cheaper_options if quality(recipe) < quality(current)),
                              key=lambda recipe: (*quality(recipe), PRIORITY[recipe.operation], recipe.references))
        for recipe in alternatives:
            if attempt(recipe):
                break

    # Repair arbitrary operation types, then reconsider removed/unclosed targets.
    # Dependencies and evidence changes enqueue only potentially affected targets.
    repair = deque()
    repair_queued = set()
    unresolved = set(pending)
    reopen = deque(sorted(unresolved))
    reopen_queued = set(unresolved)
    repairs = pruned = reopened = 0

    def enqueue_changes(changed):
        interested = {target for ref in changed for target in watchers.get(ref, ())}
        if geometry:
            interested.update(target for ref in changed for target in geometry.evidence.get(ref, ()))
        for target in sorted(interested):
            if target in selected and geometry and not geometry.valid(target) and target not in repair_queued:
                repair.append(target)
                repair_queued.add(target)
            if target in unresolved and target not in reopen_queued:
                reopen.append(target)
                reopen_queued.add(target)

    def choices(number):
        return sorted([seeds[number]] if number in seeds else candidates.get(number, []),
                      key=lambda recipe: (*quality(recipe), PRIORITY[recipe.operation], recipe.references))

    if geometry:
        repair.extend(sorted(n for n in selected if not geometry.valid(n)))
        repair_queued.update(repair)
    # Exact repeat detection is a convergence diagnostic, not a search-size cap.
    seen_states = set()
    def changed_state():
        signature = graph.fingerprint
        if signature in seen_states:
            raise ValueError('Repair repeated a selected graph; inspect conflicting incidence evidence')
        seen_states.add(signature)

    while True:
        while reopen or repair:
            # Reopening can restore an external support line before its reader
            # is considered for removal.
            if reopen:
                number = reopen.popleft()
                reopen_queued.discard(number)
                if number not in unresolved:
                    continue
                for recipe in choices(number):
                    if attempt(recipe):
                        unresolved.remove(number)
                        reopened += 1
                        changed_state()
                        enqueue_changes({number})
                        break
                continue
            number = repair.popleft()
            repair_queued.discard(number)
            if number not in selected or geometry.valid(number):
                continue
            current = selected[number]
            for recipe in choices(number):
                if recipe != current and attempt(recipe):
                    repairs += 1
                    changed_state()
                    enqueue_changes(graph.descendants({number}))
                    break
            else:
                doomed = graph.descendants({number})
                if doomed & set(seeds):
                    raise ValueError(f'Invalid construction reaches a reviewed seed through X({number})')
                geometry.remove(doomed)
                unresolved.update(doomed)
                pruned += len(doomed)
                changed_state()
                enqueue_changes(doomed)
                # Removed children may have independent alternatives, even if
                # none of their remaining inputs changed.
                for target in sorted(doomed):
                    if target not in reopen_queued:
                        reopen.append(target)
                        reopen_queued.add(target)
        if not geometry:
            break
        # Independently rebuild coordinates at quiescence to catch stale caches
        # or an omitted evidence edge; no fixed number of repair passes.
        geometry.refresh()
        invalid = sorted(n for n in selected if not geometry.valid(n))
        if not invalid:
            break
        repair.extend(invalid)
        repair_queued.update(invalid)
    report('repair-queue', repaired=repairs, pruned=pruned, reopened=reopened,
           unresolved=len(unresolved), numeric_visits=geometry.evaluated if geometry else 0,
           rejected=geometry.rejected if geometry else 0)
    validate_graph(selected)
    validate_types(selected, set(native_directions))
    report('replacement-metrics', attempts=graph.attempts, commits=graph.commits,
           affected_visits=graph.visited)
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


@stage
def ideal_coordinate_formulas(eligible, atlas):
    return [(number, recipe) for number, options in eligible.items()
                      for recipe in (options.explicit if isinstance(options, RecipeCandidates) else options)
                      if number > NATIVE_MAX and recipe.operation == 'B' and all(
                          isinstance(numeric_formula_projective(recipe, [tuple(xy) for xy in abc]), Ideal)
                          for abc in atlas['triangles'].values())]


@stage
def uncovered_diagnostics(candidates, records, parts, atlas, directions, blocked, skipped, limits, domains=None):
    """Candidate-level blockers; primary buckets are summaries, not impossibility proofs."""
    depth, length = validate_graph(records)
    nonlinear = conjugate_levels(records)
    entries = []
    domains = domains or {}
    complex_roots = complex_dependency_roots(candidates, records, domains) if domains else {}
    priority = ('coordinate_admission_or_variants', 'geometry_or_transaction', 'depth_budget',
                'conjugate_budget', 'length_budget', 'input_type', 'ideal_formula',
                'nonhomogeneous_formula', 'unclosed_dependency', 'missing_source_dependency',
                'reviewed_skip_dependency', 'blocked_native')
    for number in sorted(set(candidates)-set(records)):
        if number <= NATIVE_MAX:
            continue
        reasons = Counter()
        references = set()
        formulas = []
        for recipe in candidates[number]:
            refs = recipe.references
            references.update(ref for ref in refs if ref > NATIVE_MAX and ref not in records)
            if any(ref in skipped for ref in refs):
                why = 'reviewed_skip_dependency'
            elif any(ref in blocked for ref in refs):
                why = 'blocked_native'
            elif any(ref > NATIVE_MAX and ref not in records and ref not in candidates for ref in refs):
                why = 'missing_source_dependency'
            elif any(ref > NATIVE_MAX and ref not in records for ref in refs):
                why = 'unclosed_dependency'
            else:
                try:
                    validate_recipe_inputs(recipe, records, set(directions))
                    typed = True
                except ValueError:
                    typed = False
                if not typed:
                    why = 'input_type'
                elif 1+max((depth.get(ref,0) for ref in refs), default=0) > limits[0]:
                    why = 'depth_budget'
                elif int(recipe.operation in {'G','T'})+max((nonlinear.get(ref,0) for ref in refs), default=0) > limits[2]:
                    why = 'conjugate_budget'
                elif limits[1] is not None and estimated_recipe_length(recipe,[length.get(ref,27) for ref in refs]) > limits[1]:
                    why = 'length_budget'
                elif recipe.operation == 'B':
                    why = ('nonhomogeneous_formula' if not homogeneous_degree(recipe.formula)[0] else
                           'ideal_formula' if not formula_candidate_supported(recipe,atlas) else
                           'coordinate_admission_or_variants')
                else:
                    why = 'geometry_or_transaction'
            reasons[why] += 1
            if recipe.operation == 'B':
                formulas.append(dict(formula=recipe.formula, blocker=why))
        primary = next((why for why in priority if why in reasons), 'no_parsed_candidate')
        entry = dict(id=number, part=parts[number], primary=primary,
                     candidate_blockers=dict(reasons), unresolved_references=sorted(references), formulas=formulas)
        if domains.get(number) == 'nonreal':
            entry.update(primary='reviewed_nonreal_domain', candidate_primary=primary)
        if number in complex_roots:
            entry['possible_complex_dependencies'] = sorted(complex_roots[number])
        entries.append(entry)
    return dict(count=len(entries), summary=dict(Counter(row['primary'] for row in entries)),
                skipped=skipped, domains=domains, entries=entries)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('fetch', 'native', 'build', 'check', 'verify', 'audit', 'dry-run'))
    parser.add_argument('--parts', type=int, nargs='*', default=[3, 4, 5, 37])
    parser.add_argument('--auto-operations', default='MRCAPLIVJGTFBO',
                        help='Operations allowed from text extraction; existing seeds are always kept')
    parser.add_argument('--max-coordinate-anchors-per-component', type=int, default=None)
    parser.add_argument('--max-depth', type=int, default=6)
    parser.add_argument('--max-length', type=int, default=None,
                        help='Optional estimated construction-length limit; unlimited by default')
    parser.add_argument('--max-conjugates', type=int, default=1)
    parser.add_argument('--no-cache', action='store_true', help='Bypass persistent extraction cache')
    parser.add_argument('--uncovered-report', type=Path, help='Optional diagnostic JSON for unresolved IDs only')
    parser.add_argument('--report', type=Path, help='Append structured progress events to this JSONL file')
    args = parser.parse_args()
    support.CACHE_ENABLED = not args.no_cache
    support.REPORT = args.report
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
    report('run', action=args.action, parts=args.parts, max_depth=args.max_depth,
           max_length=args.max_length, max_conjugates=args.max_conjugates,
           operations=args.auto_operations, coordinate_limit=args.max_coordinate_anchors_per_component,
           cache=support.CACHE_ENABLED, python=sys.version.split()[0])
    if args.action in {'audit', 'build', 'check', 'dry-run'}:
        failures = []
        for part in args.parts:
            path = CACHE / f'ETCPart{part}.html'
            issues = support.heading_issues(prepare_source(part, path.read_text(encoding='utf-8', errors='replace')))
            report('preflight', part=part, issues=len(issues))
            failures.extend(f'Part {part}: {issue}' for issue in issues)
        if failures:
            raise ValueError('Source preflight failed:\n' + '\n'.join(failures))
        if args.action == 'audit':
            return
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
    skipped: dict[int, str] = {}
    domains: dict[int, str] = {}
    all_seeds = read_recipes(DATA / 'seeds.txt', skipped, domains)
    if domains:
        report('reviewed-domains', counts=dict(Counter(domains.values())))
    deferred_targets = set(skipped)
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
    ideal_markers = {number: recipe for number, recipe in all_seeds.items()
                     if recipe.operation == 'I' and not recipe.references}
    if set(ideal_markers) & deferred_targets:
        raise ValueError('A reviewed ideal marker is marked deferred')
    seeds = {number: recipe for number, recipe in all_seeds.items() if number not in ideal_markers}
    selection_exclusions = deferred_targets | set(ideal_markers)
    all_candidates: dict[int, list[Recipe]] = {}
    coordinate_lines: dict[int, list[tuple[int, int]]] = {}
    entry_count = 0
    source_parts = {}
    for part in args.parts:
        entries, candidates = read_page(part, blocked_native | deferred_targets, coordinate_lines)
        entry_count += len(entries)
        source_parts.update({number: part for number in entries})
        for number, options in candidates.items():
            if number in all_candidates:
                raise ValueError(f'X({number}) appears in multiple ETC parts')
            all_candidates[number] = options
        print(f'Part {part}: {len(entries)} entries, {sum(bool(v) for v in candidates.values())} with explicit parsed constructions')
    atlas = read_native_atlas(CACHE / 'native-atlas.json')
    eligible = {number: filter_candidates(options, lambda recipe: recipe.operation in args.auto_operations
                         and not (recipe.operation == 'I' and not recipe.references))
                for number, options in all_candidates.items()}
    relation_only = {number: filter_candidates(options, lambda recipe: recipe.operation != 'B'
                              and 'shinagawa coefficients' not in recipe.evidence.lower())
                     for number, options in eligible.items()}
    baseline = select_recipes(relation_only, seeds, args.max_depth, args.max_length, args.max_conjugates,
                              blocked_native, selection_exclusions, atlas, native_directions, require_seeds=False)
    reference_coordinates = numeric_coordinates(baseline, atlas, native_directions)
    accepted_shinagawa = rejected_shinagawa = 0
    for number, options in eligible.items():
        for recipe in (options.explicit if isinstance(options, RecipeCandidates) else options):
            if recipe.operation != 'F' or 'shinagawa coefficients' not in recipe.evidence.lower():
                continue
            if shinagawa_candidate_supported(recipe, reference_coordinates, atlas, options,
                                              coordinate_lines.get(number, [])):
                relation_only[number].append(recipe)
                accepted_shinagawa += 1
            else:
                rejected_shinagawa += 1
    print(f'Shinagawa combos: {accepted_shinagawa} screened candidates; {rejected_shinagawa} rejected')
    priority = read_coordinate_priority(DATA / 'coordinate-priority.txt') if args.max_coordinate_anchors_per_component != 0 else set()
    anchors = coordinate_anchors(eligible, baseline, atlas, args.max_coordinate_anchors_per_component, priority,
                                 coordinate_lines, native_directions, selection_exclusions)
    ideal_formulas = ideal_coordinate_formulas(eligible, atlas)
    print(f'Coordinate anchors: {len(anchors)} barycentric; '
          f'{len(ideal_formulas)} parsed formulas deferred as ideal')
    selected = select_recipes({number: options + ([anchors[number]] if number in anchors else [])
                               for number, options in relation_only.items()},
                              seeds, args.max_depth, args.max_length, args.max_conjugates,
                              blocked_native, selection_exclusions, atlas, native_directions)
    # Directionless ideal markers are coverage metadata, never graph inputs.
    # Append only after selection and numeric screening have completed.
    if 'I' in args.auto_operations:
        for number, options in all_candidates.items():
            if number > NATIVE_MAX and number not in selected and number not in deferred_targets:
                marker = next((r for r in options if r.operation == 'I' and not r.references), None)
                if marker:
                    selected[number] = marker
    # Reviewed directionless markers are always kept, like all other seeds,
    # but cannot be used as construction inputs during graph selection.
    selected.update(ideal_markers)
    validate_graph(selected)
    validate_types(selected, set(native_directions))
    if args.uncovered_report:
        diagnostic = uncovered_diagnostics(all_candidates, selected, source_parts, atlas,
            native_directions, blocked_native, skipped, (args.max_depth,args.max_length,args.max_conjugates), domains)
        args.uncovered_report.parent.mkdir(parents=True, exist_ok=True)
        args.uncovered_report.write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2),encoding='utf-8')
        report('uncovered', count=diagnostic['count'], summary=diagnostic['summary'])
    output = chunks(selected)
    generated = len(selected) - len(all_seeds)
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
    elif args.action == 'dry-run':
        existing = {n: r for path in chunk_dir.glob('*.txt') for n, r in read_recipes(path).items()}
        depth, length = validate_graph(selected)
        report('dry-run', records=len(selected), missing_existing=sorted(set(existing)-set(selected)),
               changed_existing=sum(n in selected and r.row()!=selected[n].row() for n,r in existing.items()),
               max_depth=max(depth.values(), default=0), max_length=max(length.values(), default=0),
               coordinate_anchors=sum(r.operation=='B' for r in selected.values()))
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
