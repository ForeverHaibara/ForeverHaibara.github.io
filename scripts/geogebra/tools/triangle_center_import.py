"""Manually fetch ETC pages, extract explicit constructions, and build compact chunks.

Requires Python 3 and beautifulsoup4. No network access occurs during build/check.
The extractor only recognizes a narrow set of explicit relations within each X(n)
entry. It never interprets barycentric expressions or unrelated incidence lists.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from html import unescape
from pathlib import Path
import re
import sys
import time
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup


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
INTERSECTION = re.compile(rf'^intersection of lines? {POINT}\s*{POINT}\s+and\s+{POINT}\s*{POINT}', re.I)
PROJECTION = re.compile(rf'^orthogonal projection of {POINT}\s+on\s+(?:the\s+)?line\s+{POINT}\s*{POINT}', re.I)
CONDITIONAL = re.compile(r'\b(?:if|when|provided|assuming|unless|only for|for acute|for obtuse)\b', re.I)
ARITY = {'M': 2, 'R': 2, 'J': 4, 'C': 1, 'A': 1, 'P': 3}
PRIORITY = {'M': 0, 'R': 1, 'C': 2, 'A': 3, 'P': 4, 'J': 5}


@dataclass(frozen=True)
class Recipe:
    number: int
    operation: str
    references: tuple[int, ...]
    part: int = 0
    evidence: str = ''

    def row(self) -> str:
        return f'{self.number} {self.operation} {" ".join(map(str, self.references))}'


def split_entries(source: str):
    headings = list(HEADING.finditer(source))
    for index, match in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(source)
        yield int(match.group(1)), source[match.start():end]


def entry_lines(fragment: str) -> list[str]:
    # BR and block boundaries are authoritative; raw HTML line wraps are not.
    fragment = re.sub(r'<br\s*/?>|</(?:p|h3|div)>|<hr\b[^>]*>', '\n', fragment, flags=re.I)
    plain = unescape(BeautifulSoup(fragment, 'html.parser').get_text())
    return [re.sub(r'\s+', ' ', line).strip() for line in plain.splitlines() if line.strip()]


def extract_entry(number: int, fragment: str, part: int) -> list[Recipe]:
    found: dict[tuple[str, tuple[int, ...]], str] = {}
    for line in entry_lines(fragment):
        relation = RELATION.match(line)
        if not relation or int(relation.group(1)) != number:
            continue
        body = relation.group(2)
        for pattern, opcode in ((MIDPOINT, 'M'), (REFLECTION, 'R'), (COMPLEMENT, 'C'),
                                (ANTICOMPLEMENT, 'A'), (INTERSECTION, 'J'), (PROJECTION, 'P')):
            match = pattern.match(body)
            if match and not CONDITIONAL.search(body[match.end():]):
                found[(opcode, tuple(map(int, match.groups())))] = line
        # ETC also gives sets of equivalent midpoint/reflection constructions.
        for prefix, opcode in (('midpoint of X(i) and X(j) for these', 'M'),
                               ('reflection of X(i) in X(j) for these', 'R')):
            if body.lower().startswith(prefix.lower()):
                found.update({(opcode, tuple(map(int, pair))): line for pair in PAIR.findall(body)})
    return [Recipe(number, opcode, refs, part, found[(opcode, refs)]) for opcode, refs in sorted(found)
            if all(reference > 0 and reference != number for reference in refs)]


def read_page(part: int) -> tuple[list[int], dict[int, list[Recipe]]]:
    path = CACHE / f'ETCPart{part}.html'
    source = path.read_text(encoding='utf-8', errors='replace')
    entries: list[int] = []
    candidates: dict[int, list[Recipe]] = {}
    for number, fragment in split_entries(source):
        if number in candidates:
            raise ValueError(f'Duplicate X({number}) heading in {path}')
        entries.append(number)
        candidates[number] = extract_entry(number, fragment, part)
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
        refs = tuple(map(int, fields[2:]))
        if (number <= NATIVE_MAX or opcode not in ARITY or len(refs) != ARITY[opcode]
                or any(reference <= 0 or reference == number for reference in refs) or number in records):
            raise ValueError(f'Invalid or duplicate recipe in {path}: {row}')
        records[number] = Recipe(number, opcode, refs)
    return records


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
            length[number] = 24 + sum(item[1] for item in children)
            return depth[number], length[number]
        finally:
            visiting.remove(number)

    for number in records:
        visit(number)
    return depth, length


def select_recipes(candidates: dict[int, list[Recipe]], seeds: dict[int, Recipe],
                   max_depth: int, max_length: int) -> dict[int, Recipe]:
    selected = dict(seeds)
    validate_graph(selected)
    pending = {number for number in candidates if number > NATIVE_MAX and number not in selected}
    while pending:
        possible: list[tuple[tuple[int, int, int, tuple[int, ...]], Recipe]] = []
        depth, length = validate_graph(selected)
        for number in pending:
            for recipe in candidates[number]:
                if any(ref > NATIVE_MAX and ref not in selected for ref in recipe.references):
                    continue
                candidate_depth = 1 + max((depth.get(ref, 0) for ref in recipe.references), default=0)
                candidate_length = 24 + sum(length.get(ref, 27) for ref in recipe.references)
                if candidate_depth <= max_depth and candidate_length <= max_length:
                    key = (candidate_depth, candidate_length, PRIORITY[recipe.operation], recipe.references)
                    possible.append((key, recipe))
        if not possible:
            break
        # Add every currently reachable point; alternatives for each point are
        # ranked by construction depth, expanded length, then operation type.
        best: dict[int, tuple[tuple[int, int, int, tuple[int, ...]], Recipe]] = {}
        for item in possible:
            number = item[1].number
            if number not in best or item[0] < best[number][0]:
                best[number] = item
        selected.update({number: item[1] for number, item in best.items()})
        pending.difference_update(best)
    validate_graph(selected)
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
        if not 2 <= part <= 100:
            raise ValueError(f'Unexpected ETC part: {part}')
        if index:
            time.sleep(2)
        url = f'https://faculty.evansville.edu/ck6/encyclopedia/ETCPart{part}.html'
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
    parser.add_argument('action', choices=('fetch', 'build', 'check', 'verify'))
    parser.add_argument('--parts', type=int, nargs='*', default=[3, 4, 5, 37])
    parser.add_argument('--auto-operations', default='MRCA',
                        help='Operations allowed from text extraction; existing seeds are always kept')
    parser.add_argument('--max-depth', type=int, default=6)
    parser.add_argument('--max-length', type=int, default=6000)
    args = parser.parse_args()
    if args.action == 'fetch':
        fetch(args.parts)
        return
    chunk_dir = DATA / 'chunks'
    if args.action == 'verify':
        records: dict[int, Recipe] = {}
        for path in sorted(chunk_dir.glob('*.txt')):
            for number, recipe in read_recipes(path).items():
                if number in records or number // 1000 != int(path.stem):
                    raise ValueError(f'Duplicate or misplaced X({number}) in {path}')
                records[number] = recipe
        depth, length = validate_graph(records)
        print(f'Valid: {len(records)} recipes, max depth {max(depth.values())}, max estimated length {max(length.values())}')
        return
    if set(args.auto_operations) - set(ARITY):
        raise ValueError(f'Unknown operation in {args.auto_operations}')
    seeds = read_recipes(DATA / 'seeds.txt')
    all_candidates: dict[int, list[Recipe]] = {}
    entry_count = 0
    for part in args.parts:
        entries, candidates = read_page(part)
        entry_count += len(entries)
        for number, options in candidates.items():
            if number in all_candidates:
                raise ValueError(f'X({number}) appears in multiple ETC parts')
            all_candidates[number] = options
        print(f'Part {part}: {len(entries)} entries, {sum(bool(v) for v in candidates.values())} with explicit parsed constructions')
    selected = select_recipes({number: [recipe for recipe in options
                                         if recipe.operation in args.auto_operations]
                               for number, options in all_candidates.items()},
                              seeds, args.max_depth, args.max_length)
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
            f'{",".join(map(str, recipe.references))}\t{recipe.evidence[:300]}\n'
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
