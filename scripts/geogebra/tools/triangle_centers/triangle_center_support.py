"""Offline import diagnostics and disposable, content-addressed extraction cache."""
from functools import wraps, lru_cache
from pathlib import Path
import ast
import gzip
import hashlib
import inspect
import json
import re
import threading
import time
import uuid
from html import unescape

RUN_ID = uuid.uuid4().hex
CACHE_ENABLED = True
START = time.perf_counter()
REPORT: Path | None = None
LOCK = threading.Lock()


def report(event: str, **fields) -> None:
    record = dict(event=event, run_id=RUN_ID, elapsed=round(time.perf_counter()-START, 3), **fields)
    with LOCK:
        print(f'[{record["elapsed"]:8.2f}s] {event} ' + ' '.join(f'{k}={v}' for k,v in fields.items()), flush=True)
        if REPORT is not None:
            with REPORT.open('a', encoding='utf-8') as out:
                out.write(json.dumps(record, ensure_ascii=False) + '\n')


def stage(fn):
    @wraps(fn)
    def run(*args, **kwargs):
        begin = time.perf_counter()
        stop = threading.Event()
        name = fn.__name__
        report('start', stage=name)
        def heartbeat():
            while not stop.wait(5):
                report('running', stage=name, seconds=round(time.perf_counter()-begin, 1))
        worker = threading.Thread(target=heartbeat, daemon=True)
        worker.start()
        try:
            answer = fn(*args, **kwargs)
        except BaseException:
            report('failed', stage=name, seconds=round(time.perf_counter()-begin, 3))
            raise
        finally:
            stop.set()
            worker.join()
        report('done', stage=name, seconds=round(time.perf_counter()-begin, 3))
        return answer
    return run


def heading_issues(source: str) -> list[str]:
    """Check every heading boundary, including those the strict splitter misses."""
    seen = set()
    issues = []
    previous = 0
    for match in re.finditer(r'<h3\b([^>]*)>(.*?)</h3>', source, re.I | re.S):
        text = unescape(re.sub(r'<[^>]+>', ' ', match[2])).strip()
        visible = re.match(r'X\s*\(\s*(\d+)\s*\)', text)
        attr = re.search(r'\bid\s*=\s*["\x27]([^"\x27]+)["\x27]', match[1], re.I)
        anchor = attr[1] if attr else ''
        if not visible and not re.match(r'X\d', anchor):
            continue
        number = int(visible[1]) if visible else None
        if number is None or anchor != f'X{number}':
            issues.append(f'heading mismatch: id={anchor!r}, title={text[:100]!r}')
        if anchor in seen:
            issues.append(f'duplicate heading: {anchor}')
        seen.add(anchor)
        if number is not None and number < previous:
            issues.append(f'unordered heading: X({previous}) -> X({number})')
        if number is not None:
            previous = number
    return issues


def extraction_source_fingerprint(source):
    tree = ast.parse(source)
    definitions = {node.name: node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))}
    pending = ['Recipe', 'RecipeCandidates', 'filter_candidates', 'read_page', 'extract_entry']
    reachable = set()
    while pending:
        name = pending.pop()
        if name in reachable or name not in definitions:
            continue
        reachable.add(name)
        for call in ast.walk(definitions[name]):
            if isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id in definitions:
                pending.append(call.func.id)
    nodes = [node for node in tree.body if isinstance(node, (ast.Assign, ast.AnnAssign))
             or getattr(node, 'name', None) in reachable]
    return ast.dump(ast.Module(body=nodes, type_ignores=[]), include_attributes=False)


@lru_cache(maxsize=1)
def parser_fingerprint():
    folder = Path(__file__).parent
    digest = hashlib.sha256(b'extraction-cache-v3')
    digest.update(extraction_source_fingerprint((folder/'triangle_center_import.py').read_text(encoding='utf-8')).encode())
    for name in ('triangle_center_coordinates.py', 'triangle_center_sources.py'):
        digest.update(ast.dump(ast.parse((folder/name).read_text(encoding='utf-8')), include_attributes=False).encode())
    # Source hints affect cached metadata; report-only title grouping does not.
    from triangle_center_diagnostics import entry_metadata
    digest.update(ast.dump(ast.parse(inspect.getsource(entry_metadata)),include_attributes=False).encode())
    digest.update(ast.dump(ast.parse(inspect.getsource(heading_issues)), include_attributes=False).encode())
    return digest.digest()


def cache_key(source: str, excluded: set[int], part: int) -> str:
    import bs4
    digest = hashlib.sha256(source.encode())
    digest.update(json.dumps([part, sorted(excluded), bs4.__version__]).encode())
    digest.update(parser_fingerprint())
    return digest.hexdigest()


def read_cache(path: Path):
    try:
        with gzip.open(path, 'rt', encoding='utf-8') as stream:
            return json.load(stream)
    except (OSError, EOFError, ValueError):
        return None


def write_cache(path: Path, payload) -> None:
    # Unique temporary files also permit independent readers/import processes.
    import tempfile
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False, suffix='.tmp') as out:
        temporary = Path(out.name)
    try:
        with gzip.open(temporary, 'wt', encoding='utf-8') as out:
            json.dump(payload, out, ensure_ascii=False, separators=(',', ':'))
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
