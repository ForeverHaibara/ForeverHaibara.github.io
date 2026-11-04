"""Reviewed complex-domain annotations and conservative dependency diagnostics.

Reachability is a risk annotation, never a proof of nonreality: conjugate inputs
can cancel, and alternative recipes need not share a domain. No graph is pruned.
"""
from collections import defaultdict, deque


DOMAIN_KINDS = {'nonreal', 'conditional_complex'}


def complex_dependency_roots(candidates, records, domains):
    """Propagate small root sets over chosen recipes and unresolved alternatives.

    Incidence families contribute endpoints directly, without expanding all pairs.
    Each (root, target) is visited once, including within dependency cycles.
    """
    reverse = defaultdict(set)
    for number in candidates.keys() | records.keys():
        options = [records[number]] if number in records else candidates[number]
        explicit = getattr(options, 'explicit', options)
        refs = {ref for recipe in explicit for ref in recipe.references}
        if hasattr(options, 'lines'):
            refs.update(ref for pair in options.lines for ref in pair)
        for ref in refs:
            reverse[ref].add(number)
    reached = defaultdict(set)
    queue = deque()
    for root in domains:
        reached[root].add(root)
        queue.append((root, root))
    while queue:
        number, root = queue.popleft()
        for child in reverse.get(number, ()):
            if root not in reached[child]:
                reached[child].add(root)
                queue.append((child, root))
    return reached
