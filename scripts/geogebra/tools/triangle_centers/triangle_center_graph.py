"""Transactional metrics for a selected DAG; candidate families remain separate."""
from collections import ChainMap, defaultdict
from hashlib import blake2b


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
        self.fingerprint = 0
        for recipe in records.values():
            self.fingerprint ^= self._token(recipe)
        for number, recipe in records.items():
            for ref in set(recipe.references):
                self.reverse[ref].add(number)
        self.metrics = self._compute(set(records), records)
        self.bad = {n for n, metric in self.metrics.items() if not self._within(metric)}

    @staticmethod
    def _token(recipe):
        text = repr((recipe.row(), recipe.part, recipe.evidence)).encode()
        return int.from_bytes(blake2b(text, digest_size=32).digest(), 'big')

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
        previous = self.records.get(number)
        for ref in set(previous.references if previous else ()):
            self.reverse[ref].discard(number)
        for ref in set(recipe.references):
            self.reverse[ref].add(number)
        if previous is not None:
            self.fingerprint ^= self._token(previous)
        self.fingerprint ^= self._token(recipe)
        self.records[number] = recipe
        self.metrics.update(updates)
        self.bad.difference_update(affected)
        self.commits += 1
        return True

    def remove(self, targets):
        for number in targets:
            self.fingerprint ^= self._token(self.records[number])
            for ref in set(self.records[number].references):
                self.reverse[ref].discard(number)
            del self.records[number]
            del self.metrics[number]
            self.bad.discard(number)
        for number in targets:
            self.reverse.pop(number, None)


class NumericTransactions:
    """Commit geometry with structure; preserve existing failures but introduce none."""
    def __init__(self, graph, evaluate, validate, evidence):
        self.graph = graph
        self.evaluate = evaluate
        self.validate = validate
        self.evidence = defaultdict(set)
        for target, references in evidence.items():
            for ref in references:
                self.evidence[ref].add(target)
        self.coordinates = evaluate(graph.records, None, None)
        self.evaluated = self.rejected = 0

    def valid(self, number, records=None, coordinates=None):
        return self.validate(number, self.graph.records if records is None else records,
                             self.coordinates if coordinates is None else coordinates)

    def apply(self, recipe):
        proposed = None

        def screen(overlay, affected):
            nonlocal proposed
            proposed = self.evaluate(overlay, self.coordinates, affected)
            self.evaluated += len(affected)
            checked = affected | {target for ref in affected for target in self.evidence.get(ref, ())
                                  if target in overlay}
            for target in checked:
                if not self.valid(target, overlay, proposed):
                    # Initial closure can contain a failed incidence witness.
                    # Repair may leave another pre-existing failure queued, but
                    # must resolve its own target and cannot break a valid reader.
                    if target == recipe.number or (target in self.graph.records and self.valid(target)):
                        return False
            return True

        if not self.graph.replace(recipe, screen):
            self.rejected += 1
            return False
        self.coordinates = proposed
        return True

    def remove(self, targets):
        self.graph.remove(targets)
        for points in self.coordinates.values():
            for target in targets:
                points.pop(target, None)

    def refresh(self):
        self.coordinates = self.evaluate(self.graph.records, None, None)
