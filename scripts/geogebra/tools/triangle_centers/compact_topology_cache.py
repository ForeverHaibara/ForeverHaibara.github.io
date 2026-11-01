"""Compact legacy planning snapshots; verify lossless decoding before replacement."""
import argparse
from pathlib import Path

from triangle_center_support import read_cache, write_cache

ROOT = Path(__file__).resolve().parents[4]


def ranges(values):
    values = list(values)
    if values != sorted(set(values)):
        raise ValueError('Range encoding requires sorted unique IDs')
    result = []
    for value in values:
        if result and value == result[-1][1] + 1:
            result[-1][1] = value
        else:
            result.append([value, value])
    return result


def expand(spans):
    return [number for start, end in spans for number in range(start, end + 1)]


def pack(record):
    result = dict(record)
    for name in ('entries', 'structurally_direct'):
        result[name] = ranges(result[name])
    adjacency = result.pop('adjacency')
    nodes = sorted(map(int, adjacency))
    result['nodes'] = ranges(nodes)
    result['arcs'] = []
    for node in nodes:
        refs = adjacency[str(node)]
        result['arcs'].append([ref - previous for ref, previous in zip(refs, [0] + refs[:-1])])
    return dict(schema=2, data=result)


def unpack(payload):
    if payload['schema'] != 2:
        raise ValueError('Unsupported topology cache schema')
    result = dict(payload['data'])
    for name in ('entries', 'structurally_direct'):
        result[name] = expand(result[name])
    nodes = expand(result.pop('nodes'))
    arcs = result.pop('arcs')
    if len(nodes) != len(arcs):
        raise ValueError('Topology node/arc counts differ')
    result['adjacency'] = {}
    for node, deltas in zip(nodes, arcs):
        refs = []
        total = 0
        for delta in deltas:
            total += delta
            refs.append(total)
        result['adjacency'][str(node)] = refs
    return result


def main():
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, default=ROOT / '.cache/triangle-centers/planning-topology')
    args = parser.parse_args()
    before = after = count = 0
    for source in sorted(args.folder.glob('*.json')):
        record = json.loads(source.read_text(encoding='utf-8'))
        destination = source.with_suffix('.json.gz')
        write_cache(destination, pack(record))
        if unpack(read_cache(destination)) != record:
            raise ValueError(f'Topology roundtrip differs: {source}')
        before += source.stat().st_size
        after += destination.stat().st_size
        source.unlink()
        count += 1
    print(f'Compacted {count} verified snapshots: {before:,} -> {after:,} bytes')


if __name__ == '__main__':
    main()
