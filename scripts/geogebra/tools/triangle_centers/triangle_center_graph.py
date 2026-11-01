"""Transactional metrics for a selected DAG; candidate families remain separate."""
from collections import ChainMap, defaultdict


class SelectedGraph:
    def __init__(self, records, native_max, estimate, limits, validate=None):
        self.records = records
        self.native_max = native_max
        self.estimate = estimate
        self.limits = limits
        self.validate = validate
        self.reverse = defaultdict(set)
        self.metrics = {}
        self.attempts = self.commits = self.visited = 0
        for number, recipe in records.items():
            for ref in set(recipe.references):
                self.reverse[ref].add(number)
        self.metrics = self._compute(set(records), records)
        self.bad = {n for n, metric in self.metrics.items() if not self._within(metric)}

    def _within(self, metric):
        depth, length, conjugates = metric
        d, size, c = self.limits
        return depth <= d and (size is None or length <= size) and conjugates <= c

    def _compute(self, affected, records):
        result, visiting = {}, set()

        def visit(number):
            if number <= self.native_max:
                return 0, 27, 0
            if number in visiting:
                raise ValueError(f'Cyclic triangle center recipe through X({number})')
            if number not in records:
                raise ValueError(f'Missing triangle center dependency X({number})')
            if number not in affected:
                return self.metrics[number]
            if number in result:
                return result[number]
            visiting.add(number)
            recipe = records[number]
            children = [visit(ref) for ref in recipe.references]
            visiting.remove(number)
            result[number] = (1 + max((v[0] for v in children), default=0),
                              self.estimate(recipe, [v[1] for v in children]),
                              int(recipe.operation in {'G', 'T'}) + max((v[2] for v in children), default=0))
            return result[number]

        for number in sorted(affected):
            visit(number)
        return result

    def descendants(self, roots):
        affected = set(roots)
        queue = list(roots)
        while queue:
            for number in self.reverse.get(queue.pop(), ()):
                if number not in affected:
                    affected.add(number)
                    queue.append(number)
        return affected

    def replace(self, recipe, screen=None):
        """Nothing is mutated until structure, types, budgets and screen pass."""
        self.attempts += 1
        number = recipe.number
        affected = self.descendants({number})
        self.visited += len(affected)
        overlay = ChainMap({number: recipe}, self.records)
        try:
            updates = self._compute(affected, overlay)
            if self.bad - affected or any(not self._within(v) for v in updates.values()):
                return False
            if self.validate:
                for target in affected:
                    self.validate(overlay[target], overlay)
            if screen is not None and not screen(overlay, affected):
                return False
        except ValueError:
            return False
        previous = self.records[number]
        for ref in set(previous.references):
            self.reverse[ref].discard(number)
        for ref in set(recipe.references):
            self.reverse[ref].add(number)
        self.records[number] = recipe
        self.metrics.update(updates)
        self.bad.difference_update(affected)
        self.commits += 1
        return True

    def remove(self, targets):
        for number in targets:
            for ref in set(self.records[number].references):
                self.reverse[ref].discard(number)
            del self.records[number]
            del self.metrics[number]
            self.bad.discard(number)
        for number in targets:
            self.reverse.pop(number, None)
