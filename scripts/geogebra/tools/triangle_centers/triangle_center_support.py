"""Offline import diagnostics and disposable, content-addressed extraction cache."""
from functools import wraps
from pathlib import Path
import gzip
import hashlib
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


def cache_key(source: str, excluded: set[int], part: int) -> str:
    import bs4
    digest = hashlib.sha256(source.encode())
    digest.update(json.dumps([part, sorted(excluded), bs4.__version__]).encode())
    for name in ('triangle_center_import.py', 'triangle_center_coordinates.py', 'triangle_center_support.py', 'triangle_center_graph.py'):
        digest.update(Path(__file__).with_name(name).read_bytes())
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
