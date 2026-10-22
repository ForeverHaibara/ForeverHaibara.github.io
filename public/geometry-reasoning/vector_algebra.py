"""Signed planar bilinear equations and bounded exchanges with geometric DDAR.

Position atoms refer to the independent coordinate origin; no auxiliary point is
created. All elimination is rational and linear in dot/cross atoms.
"""

import itertools
import math
from fractions import Fraction as F

from elimination import prime_decomposition
from parse import AGPredicate
from proof_algebra import Basis, plus, scaled


def atom(operation, a, b):
    if a is None or b is None or operation == "cross" and a == b:
        return None, 0
    a, b = str(a), str(b)
    sign = -1 if operation == "cross" and a > b else 1
    a, b = sorted((a, b))
    return f"{operation}({a},{b})", sign


def product_row(operation, terms):
    if operation not in ("dot", "cross") or not 0 < len(terms) <= 32:
        raise ValueError("Invalid vector product operation or term budget")
    row = {}
    for term in terms:
        coefficient = F(term["coefficient"])
        if coefficient.denominator != 1 or abs(coefficient) > 32:
            raise ValueError("Vector product coefficient budget exceeded")
        a, b = term["left"]
        c, d = term["right"]
        for x, y, multiplier in ((b, d, 1), (b, c, -1), (a, d, -1), (a, c, 1)):
            variable, sign = atom(operation, x, y)
            if sign:
                plus(row, {variable: coefficient * multiplier * sign})
    return row


def term(left, right, coefficient=1):
    return {"left": list(left), "right": list(right), "coefficient": coefficient}


def logarithm(value):
    value = F(value)
    row = {f"log({p})": F(power) for p, power in prime_decomposition(value.numerator)}
    return plus(row, {f"log({p})": F(power) for p, power in prime_decomposition(value.denominator)}, F(-1))


class VectorKnowledge:
    def __init__(self, knowledge, context):
        self.k = knowledge
        if context.get("version") != 1:
            raise ValueError("Unsupported vector context version")
        self.context = context
        self.origin = context.get("origin", {"x": 0, "y": 0})
        if not all(math.isfinite(float(self.origin[axis])) for axis in ("x", "y")):
            raise ValueError("Nonfinite vector origin")
        self.bases = {operation: Basis(knowledge.graph, operation) for operation in ("dot", "cross")}
        knowledge.bases.update(self.bases)
        self.targets = list(context.get("goals", []))
        self.transfers = [entry["equation"] for entry in self.targets]
        self.imported = set()
        self.similarities = None
        self.completed_similarities = set()
        self.queries = 0
        self.limited = False
        self.exhausted = False
        self.rounds = 0
        self.active = False
        self.pending = {}
        self.checked = False

    def row(self, operation, left, right):
        return product_row(operation, [term(left, right)])

    def member(self, operation, row):
        self.queries += 1
        if self.queries > 100000:
            self.limited = True
            self.exhausted = True
            return None
        return self.bases[operation].membership(row)

    def add(self, operation, row, rule, parents, **content):
        if not self.active:
            key = operation, tuple(sorted(row.items()))
            if row and key not in self.pending:
                self.pending[key] = (operation, row, rule, parents, content)
            return None
        if not row or self.exhausted or self.member(operation, row) is not None:
            return None
        if any(value.numerator.bit_length() + value.denominator.bit_length() > 256 for value in row.values()):
            self.limited = True
            return None
        return self.k.assert_row(operation, row, rule, parents, **content)

    def value(self, equation):
        def at(name):
            if name is None:
                return float(self.origin["x"]), float(self.origin["y"])
            if name not in self.k.points:
                raise ValueError("Unknown vector point")
            return tuple(map(float, self.k.points[name].value))
        result, magnitude = 0.0, 0.0
        product_row(equation["operation"], equation["terms"])
        for item in equation["terms"]:
            a, b, c, d = map(at, [*item["left"], *item["right"]])
            ux, uy, vx, vy = b[0] - a[0], b[1] - a[1], d[0] - c[0], d[1] - c[1]
            coefficient = float(item["coefficient"])
            result += coefficient * (ux * vx + uy * vy if equation["operation"] == "dot" else ux * vy - uy * vx)
            magnitude += abs(coefficient) * math.hypot(ux, uy) * math.hypot(vx, vy)
        if not math.isfinite(result) or not math.isfinite(magnitude):
            raise ValueError("Nonfinite vector product")
        return result, magnitude

    def load(self, validation, record=False):
        if len(self.context.get("assumptions", [])) + len(self.targets) + len(self.context.get("midpoints", [])) > 250:
            raise ValueError("Vector predicate budget exceeded")
        for entry in self.targets:
            self.value(entry["equation"])  # Validate references without assuming a target's truth.
        for entry in self.context.get("assumptions", []):
            equation = entry["equation"]
            value, magnitude = self.value(equation)
            if not self.checked and abs(value) > 1.6e-10 * max(1, magnitude):
                validation.append({"predicate": entry["key"], "message": "Vector coordinate witness rejected"})
                if not self.k.hypothetical:
                    raise ValueError("Vector coordinate witness rejected. Enable hypothesis exploration to use these assumptions.")
            if not record:
                continue
            root = self.k.graph.add("assumption", "accepted-condition", predicate=entry["key"], sourceIds=entry.get("candidateIds", []))
            self.k.assumptions.append(root)
            self.k.given[entry["key"]] = root
            self.add(equation["operation"], product_row(equation["operation"], equation["terms"]), "vector-product-expansion", [root])
        for entry in self.context.get("midpoints", []):
            m = entry["point"]
            a, b = entry["segment"]
            if any(point not in self.k.points for point in (a, b, m)):
                raise ValueError("Unknown midpoint point")
            error = math.hypot(*(2 * self.k.points[m].value - self.k.points[a].value - self.k.points[b].value))
            if not self.checked and error > 1.6e-10:
                validation.append({"predicate": f"midpoint {m} {a} {b}", "message": "Midpoint coordinate witness rejected"})
                if not self.k.hypothetical:
                    raise ValueError("Midpoint coordinate witness rejected")
            if not record:
                continue
            root = self.k.graph.add("assumption", "accepted-condition", predicate=f"midpoint {m} {a} {b}", sourceIds=entry.get("candidateIds", []))
            self.k.assumptions.append(root)
            self.affine([(m, 2), (a, -1), (b, -1)], root)
        self.checked = True

    def activate(self, validation):
        if self.active:
            return
        self.active = True
        self.load(validation, record=True)
        for operation, row, rule, parents, content in self.pending.values():
            self.add(operation, row, rule, parents, **content)
        self.pending.clear()

    def affine(self, coefficients, source):
        for operation in ("dot", "cross"):
            for point in self.k.points:
                row = product_row(operation, [term((None, name), (None, point), coefficient) for name, coefficient in coefficients])
                self.add(operation, row, "affine-vector-contraction", [source])

    def import_predicate(self, predicate, source):
        names = list(map(str, predicate.points))
        kind = predicate.name
        if kind in ("para", "perp"):
            operation = "cross" if kind == "para" else "dot"
            self.add(operation, self.row(operation, names[:2], names[2:]), "geometric-vector-product", [source])
        elif kind == "cong":
            a, b, c, d = names
            row = plus(self.row("dot", (a, b), (a, b)), self.row("dot", (c, d), (c, d)), F(-1))
            self.add("dot", row, "squared-equal-lengths", [source])
        elif kind == "overlap":
            self.affine([(names[0], 1), (names[1], -1)], source)

    def collinear(self, names, source):
        names = list(map(str, names))
        if len(names) >= 3:
            pair = next((pair for pair in itertools.combinations(names, 2) if self.k.separated(*pair)), None)
            if pair is None:
                return
            a, b = pair
            for c in names:
                self.add("cross", self.row("cross", (a, b), (a, c)), "collinear-vector-product", [source])

    def similarity(self, first, second):
        first, second = list(map(str, first)), list(map(str, second))
        from numericals import orientation
        if orientation(*(self.k.points[name].value for name in first)) == orientation(*(self.k.points[name].value for name in second)):
            return
        a, b, c = first
        d, e, f = second
        for operation in ("dot", "cross"):
            equation = {"operation": operation, "terms": [term((a, b), (d, f)), term((a, c), (d, e), -1)]}
            if equation not in self.transfers:
                self.transfers.append(equation)

    def transfer(self, equation):
        """Equal length products plus equal/supplementary angles transfer signed products.

        Angles are known modulo pi; the ray lift is recorded as a witness guard,
        following the existing conditional DDAR treatment of orientations.
        """
        operation, terms = equation["operation"], equation["terms"]
        if len(terms) != 2 or abs(terms[0]["coefficient"]) != abs(terms[1]["coefficient"]) or not terms[0]["coefficient"]:
            return
        row = product_row(operation, terms)
        if not row or self.member(operation, row) is not None:
            return
        segments = [tuple(item[key]) for item in terms for key in ("left", "right")]
        if any(None in pair or not self.k.separated(*pair) for pair in segments):
            return
        length = self.k.row("length-product", [(*pair, 1 if i < 2 else -1) for i, pair in enumerate(segments)])
        if self.k.bases["length-product"].membership(length) is None:
            return
        for epsilon in (1, -1):
            angle = self.k.row("angle", [(*pair, coefficient) for pair, coefficient in zip(segments, [-1, 1, epsilon, -epsilon])])
            if self.k.bases["angle"].membership(angle) is None:
                continue
            directions = []
            for a, b in segments:
                vector = self.k.points[b].value - self.k.points[a].value
                directions.append(math.atan2(float(vector[1]), float(vector[0])))
            lift = round((directions[1] - directions[0] - epsilon * (directions[3] - directions[2])) / math.pi)
            sign = (-1 if lift % 2 else 1) * (epsilon if operation == "cross" else 1)
            if terms[1]["coefficient"] != -sign * terms[0]["coefficient"]:
                continue
            parents = [self.k.bases["length-product"].prove(length), self.k.bases["angle"].prove(angle)]
            guard = self.k.guard("witness-product-angle-lift", [name for pair in segments for name in pair], sign=epsilon, lift=lift)
            self.add(operation, row, "length-angle-product-transfer", [*parents, guard])
            return

    def geometry_fact(self, name, pairs, operation, row, engine):
        if self.member(operation, row) is None:
            return
        text = name + " " + " ".join(point for pair in pairs for point in pair)
        if text in self.imported:
            return
        self.imported.add(text)
        parent = self.bases[operation].prove(row)
        if parent is None:
            return
        if name == "cong":
            for domain in ("length-add", "length-product"):
                self.k.assert_row(domain, self.k.row(domain, [(*pairs[0], 1), (*pairs[1], -1)]), "equal-squared-lengths", [parent], predicate=text)
        else:
            angle = self.k.row("angle", [(*pairs[0], 1), (*pairs[1], -1)])
            if name == "perp":
                plus(angle, {"pi": -F(1, 2)})
            guard = self.k.guard("witness-nonzero-vectors", [point for pair in pairs for point in pair])
            self.k.assert_row("angle", angle, "zero-product-direction", [parent, guard], predicate=text)
        if engine:
            predicate = AGPredicate.parse(text).replace_points(self.k.points)
            if not engine.check_pred(predicate):
                engine.force_pred(predicate)

    def sync(self, engine):
        if self.k.hypothetical or self.k.graph.limited or self.k.graph.contradictions or self.exhausted:
            return
        self.rounds += 1
        pairs = list(itertools.combinations(self.k.points, 2))
        pairs = [pair for pair in pairs if self.k.separated(*pair)]
        if len(pairs) > 80:
            self.limited = True
            # Bounded search is partial; do not discard already known equations.
        pairs = pairs[:80]
        for left, right in itertools.combinations(pairs, 2):
            if self.exhausted or self.k.graph.limited:
                return
            for operation, name, offset in (("cross", "para", F(0)), ("dot", "perp", F(-1, 2))):
                row = self.row(operation, left, right)
                key = (operation, left, right)
                if key not in self.imported:
                    angle = self.k.row("angle", [(*left, 1), (*right, -1)])
                    if offset:
                        plus(angle, {"pi": offset})
                    if self.k.bases["angle"].membership(angle) is not None:
                        self.imported.add(key)
                        self.add(operation, row, "direction-vector-product", [self.k.bases["angle"].prove(angle)])
                self.geometry_fact(name, (left, right), operation, row, engine)
            norm = plus(self.row("dot", left, left), self.row("dot", right, right), F(-1))
            length = self.k.row("length-product", [(*left, 1), (*right, -1)])
            if self.member("dot", norm) is None:
                remainder, _ = self.k.bases["length-product"].reduce(length)
                if all(not Basis.geometric(key) and value.denominator == 1 and abs(value) <= 16 for key, value in remainder.items()):
                    ratio = F(1)
                    for key, power in remainder.items():
                        ratio *= F(int(key[4:-1])) ** int(power)
                    if ratio.numerator.bit_length() + ratio.denominator.bit_length() <= 96:
                        source = self.k.bases["length-product"].prove(plus(dict(length), remainder, F(-1)))
                        metric = plus(self.row("dot", left, left), self.row("dot", right, right), -ratio * ratio)
                        self.add("dot", metric, "length-ratio-squared", [source], ratio=str(ratio))
            self.geometry_fact("cong", (left, right), "dot", norm, engine)
        for equation in self.transfers:
            self.transfer(equation)
        self.search_similar(engine)

    def search_similar(self, engine):
        if self.similarities is None:
            if math.comb(len(self.k.points), 3) > 3000:
                self.limited = True
            groups = {}
            self.similarities = []
            for triple in itertools.islice(itertools.combinations(self.k.points, 3), 3000):
                def distance(a, b):
                    return math.hypot(*(self.k.points[a].value - self.k.points[b].value))
                vertices = sorted(triple, key=lambda a: (distance(*[b for b in triple if b != a]), a))
                a, b, c = vertices
                lengths = [distance(b, c), distance(a, c), distance(a, b)]
                cross = self.value({"operation": "cross", "terms": [term((a, b), (a, c))]})[0]
                if lengths[0] <= 1e-8 or abs(cross) <= 2e-7 * lengths[-1] ** 2:
                    continue
                key = tuple(round(value / lengths[-1], 7) for value in lengths[:2])
                for other in groups.get(key, []):
                    for permutation in itertools.permutations(vertices):
                        if len(self.similarities) >= 768:
                            self.limited = True
                            break
                        self.similarities.append((other, permutation))
                groups.setdefault(key, []).append(tuple(vertices))
        for first, second in self.similarities:
            if self.exhausted or self.k.graph.limited:
                return
            key = first, second
            if key in self.completed_similarities:
                continue
            a, b, c = first
            d, e, f = second
            equations = {operation: product_row(operation, [term((a, b), (d, f)), term((a, c), (d, e), -1)]) for operation in ("dot", "cross")}
            if any(self.member(operation, row) is None for operation, row in equations.items()):
                continue
            self.completed_similarities.add(key)
            parents = [self.bases[operation].prove(row) for operation, row in equations.items()]
            guard = self.k.guard("witness-noncollinear", first)
            guard2 = self.k.guard("witness-noncollinear", second)
            source = self.k.graph.add("geometry", "similarity-from-bilinear-products", [*parents, guard, guard2], triangles=[list(first), list(second)], orientation=-1)
            edges = lambda vertices: [(vertices[0], vertices[1]), (vertices[1], vertices[2]), (vertices[0], vertices[2])]
            left, right = edges(first), edges(second)
            for i in (0, 1):
                row = self.k.row("length-product", [(*left[i], 1), (*right[i], -1), (*left[2], -1), (*right[2], 1)])
                self.k.assert_row("length-product", row, "similarity-side-ratios", [source])
            for i in range(3):
                row = plus(self.k.angle(first[(i + 1) % 3], first[i], first[(i + 2) % 3]), self.k.angle(second[(i + 1) % 3], second[i], second[(i + 2) % 3]))
                self.k.assert_row("angle", row, "similarity-angles", [source])
            self.k.facts.append(source)
            if engine:
                engine.force_similar(tuple(self.k.points[name] for name in first), tuple(self.k.points[name] for name in second))
