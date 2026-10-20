"""Readable provenance adapter around the unchanged pinned DDAR.

Only reconstructed rules enter the exact provenance basis. An upstream fact
without a reconstructed justification is explicitly represented as a gap.
"""

import contextlib
import io
import itertools
import math
import time
from fractions import Fraction as F

from ddar import DDAR
from parse import AGProblem
from elimination import prime_decomposition
import numericals as ng
from proof_algebra import Basis, ProofGraph, plus, scaled


def symbol(domain, a, b):
    a, b = sorted((str(a), str(b)))
    return {"angle": f"dir({a},{b})", "length-add": f"len({a},{b})", "length-product": f"log(|{a} {b}|)"}[domain]


def logarithm(value):
    value = F(value)
    row = {f"log({p})": F(power) for p, power in prime_decomposition(value.numerator)}
    return plus(row, {f"log({p})": F(power) for p, power in prime_decomposition(value.denominator)}, F(-1))


class Knowledge:
    def __init__(self, points, hypothetical=False):
        self.graph = ProofGraph()
        self.bases = {domain: Basis(self.graph, domain) for domain in ("angle", "length-add", "length-product")}
        self.points = {str(point): point for point in points}
        self.hypothetical = hypothetical
        self.assumptions = []
        self.given = {}
        self.branch_parents = []
        self.incidence = {"coll": [], "cyclic": []}
        self.facts = []
        self.seen_equations = set()

    @staticmethod
    def row(domain, pairs):
        result = {}
        for a, b, coefficient in pairs:
            plus(result, {symbol(domain, a, b): F(coefficient)})
        return result

    def angle(self, a, v, b):
        return self.row("angle", [(v, b, 1), (v, a, -1)])

    def assert_row(self, domain, row, rule, parents, **data):
        key = domain, tuple(sorted(row.items()))
        if not row or key in self.seen_equations or self.graph.limited:
            return None
        self.seen_equations.add(key)
        node = self.graph.equation("geometry", rule, domain, row, parents, **data)
        self.bases[domain].add(row, node)
        return node

    def separated(self, a, b):
        if str(a) == str(b):
            return False
        return self.hypothetical or ng.distance(self.points[str(a)].value, self.points[str(b)].value) > 1e-8

    def guard(self, rule, names, **data):
        names = list(map(str, names))
        if rule == "witness-noncollinear" and ng.orientation(*(self.points[name].value for name in names[:3])) == 0:
            return self.graph.add("gap", "failed-coordinate-guard", points=names)
        if rule == "witness-triangle-orientations":
            first = ng.orientation(*(self.points[name].value for name in names[:3]))
            second = ng.orientation(*(self.points[name].value for name in names[3:]))
            if first == 0 or second == 0 or (1 if first == second else -1) != data["orientation"]:
                return self.graph.add("gap", "failed-coordinate-guard", points=names)
        return self.graph.add("guard", rule, points=names, **data)

    def predicate_row(self, predicate):
        names = list(map(str, predicate.points))
        kind = predicate.name
        if kind in ("angeq", "para", "perp"):
            coefficients = predicate.constants[:-1] if kind == "angeq" else [1, -1]
            row = self.row("angle", [(names[i], names[i + 1], coefficients[i // 2]) for i in range(0, len(names), 2)])
            constant = F(predicate.constants[-1]) / 180 if kind == "angeq" else -F(1, 2) if kind == "perp" else F(0)
            plus(row, {"pi": constant})
            return "angle", row
        if kind in ("cong", "distmeq"):
            coefficients = predicate.constants[:-1] if kind == "distmeq" else [1, -1]
            row = self.row("length-product", [(names[i], names[i + 1], coefficients[i // 2]) for i in range(0, len(names), 2)])
            if kind == "distmeq":
                plus(row, logarithm(predicate.constants[-1]))
            return "length-product", row
        if kind == "distseq":
            return "length-add", self.row("length-add", [(names[i], names[i + 1], predicate.constants[i // 2]) for i in range(0, len(names), 2)])
        return None

    def assume(self, predicate, sources):
        node = self.graph.add("assumption", "accepted-condition", self.branch_parents, predicate=str(predicate), sourceIds=sources)
        self.assumptions.append(node)
        self.given[str(predicate)] = node
        value = self.predicate_row(predicate)
        if value:
            self.assert_row(*value, "predicate-equation", [node])
            if predicate.name == "cong":
                a, b, c, d = predicate.points
                self.assert_row("length-add", self.row("length-add", [(a, b, 1), (c, d, -1)]), "equal-lengths", [node])
        elif self.hypothetical and predicate.name == "coll":
            self.collinear(predicate.points, node)
        elif self.hypothetical and predicate.name == "cyclic":
            self.cyclic(predicate.points, (), node)
        return node

    def incidence_source(self, kind, points):
        names = set(map(str, points))
        for existing, node in self.incidence[kind]:
            if names <= existing:
                return node
        return None

    def collinear(self, points, source=None):
        names = list(dict.fromkeys(map(str, points)))
        if len(names) < 3:
            return None
        old = self.incidence_source("coll", names)
        if old:
            return old
        a, b = next(((a, b) for a, b in itertools.combinations(names, 2) if self.separated(a, b)), (None, None))
        if a is None:
            return None
        if source is None:
            parents = []
            for c in names:
                if c in (a, b) or not self.separated(a, c):
                    continue
                parent = self.bases["angle"].prove(self.angle(b, a, c))
                if parent is None:
                    parents = None
                    break
                parents.append(parent)
            source = self.graph.add("geometry" if parents is not None else "gap", "collinear-from-directions" if parents is not None else "unreconstructed-collinearity",
                parents or (), predicate="coll " + " ".join(names))
        # Existing lines can be joined only when two separated points are shared.
        for existing, parent in list(self.incidence["coll"]):
            common = set(names) & existing
            if not existing <= set(names) and any(self.separated(x, y) for x, y in itertools.combinations(common, 2)):
                names = sorted(set(names) | existing)
                source = self.graph.add("geometry", "join-collinear-sets", [source, parent], predicate="coll " + " ".join(names))
        self.incidence["coll"].append((set(names), source))
        base = symbol("angle", a, b)
        for x, y in itertools.combinations(names, 2):
            if self.separated(x, y):
                row = plus({symbol("angle", x, y): F(1)}, {base: F(1)}, F(-1))
                self.assert_row("angle", row, "collinear-directions", [source])
        if not self.hypothetical:
            pa, pb = self.points[a].value, self.points[b].value
            ordered = sorted(names, key=lambda name: float((self.points[name].value - pa) @ (pb - pa)))
            guard = self.guard("witness-line-order", ordered)
            for x, y, z in itertools.islice(itertools.combinations(ordered, 3), 128):
                if self.separated(x, y) and self.separated(y, z):
                    row = self.row("length-add", [(x, y, 1), (y, z, 1), (x, z, -1)])
                    self.assert_row("length-add", row, "segment-addition", [source, guard])
        self.facts.append(source)
        return source

    def cyclic(self, points, centers=(), source=None):
        names = list(dict.fromkeys(map(str, points)))
        if len(names) < 3:
            return None
        existing = self.incidence_source("cyclic", names)
        if existing:
            return existing
        if source is None:
            parents = []
            if len(names) >= 4:
                a, b, c = names[:3]
                for d in names[3:]:
                    row = plus(self.angle(a, c, b), self.angle(a, d, b), F(-1))
                    parent = self.bases["angle"].prove(row)
                    if parent is None:
                        parents = None
                        break
                    parents.append(parent)
            else:
                parents = None
            if parents is not None and parents:
                guard = self.guard("witness-noncollinear", names[:3])
                source = self.graph.add("geometry", "converse-inscribed-angle", [*parents, guard], predicate="cyclic " + " ".join(names))
            else:
                source = self.graph.add("gap", "unreconstructed-circle", predicate="cyclic " + " ".join(names))
        self.incidence["cyclic"].append((set(names), source))
        for a, b, c, d in itertools.islice(itertools.combinations(names, 4), 128):
            for x, y, v, w in ((a, b, c, d), (a, c, b, d), (a, d, b, c)):
                row = plus(self.angle(x, v, y), self.angle(x, w, y), F(-1))
                self.assert_row("angle", row, "inscribed-angle", [source])
        # Center provenance is not reconstructed yet; never silently assume it.
        if centers:
            center_fact = self.graph.add("gap", "unreconstructed-circle-center", [source], points=list(map(str, centers)))
            for center in centers:
                for point in names[1:]:
                    self.assert_row("length-product", self.row("length-product", [(center, names[0], 1), (center, point, -1)]), "circle-radii", [center_fact])
        self.facts.append(source)
        return source

    def similar(self, first, second):
        first, second = list(map(str, first)), list(map(str, second))
        orientation1 = ng.orientation(*(self.points[name].value for name in first))
        orientation2 = ng.orientation(*(self.points[name].value for name in second))
        sign = 1 if orientation1 == orientation2 else -1
        edges = lambda names: [(names[0], names[1]), (names[1], names[2]), (names[0], names[2])]
        left, right = edges(first), edges(second)
        ratios = [self.row("length-product", [(*left[i], 1), (*right[i], -1), (*left[2], -1), (*right[2], 1)]) for i in (0, 1)]
        angles = [plus(self.angle(first[(i + 1) % 3], first[i], first[(i + 2) % 3]), self.angle(second[(i + 1) % 3], second[i], second[(i + 2) % 3]), F(-sign)) for i in range(3)]
        rule, parents = None, []
        obligations = (("sss-similarity", [("length-product", row) for row in ratios]),
            ("aa-similarity", [("angle", row) for row in angles[:2]]),
            ("sas-similarity", [("length-product", ratios[0]), ("angle", angles[0])]))
        for candidate, rows in obligations:
            if all(self.bases[domain].membership(row) is not None for domain, row in rows):
                rule = candidate
                parents = [self.bases[domain].prove(row) for domain, row in rows]
                break
        guard = self.guard("witness-triangle-orientations", [*first, *second], orientation=sign)
        node = self.graph.add("geometry" if rule else "gap", rule or "unreconstructed-similarity", [*parents, guard], triangles=[first, second])
        for row in ratios:
            self.assert_row("length-product", row, "similarity-side-ratios", [node])
        for row in angles:
            self.assert_row("angle", row, "similarity-angles", [node])
        self.facts.append(node)

    def sync_lengths(self):
        if self.graph.limited or self.graph.contradictions:
            return
        pairs = list(itertools.islice((pair for pair in itertools.combinations(self.points, 2) if self.separated(*pair)), 80))
        additive = {}
        for a, b in pairs:
            raw = {symbol("length-add", a, b): F(1)}
            reduced, _ = self.bases["length-add"].reduce(raw)
            if not reduced:
                continue
            coefficient = reduced[min(reduced)]
            normalized = tuple(sorted(scaled(reduced, F(1) / coefficient).items()))
            if normalized in additive:
                c, d, other = additive[normalized]
                ratio = coefficient / other
                if ratio <= 0:
                    continue
                row = self.row("length-product", [(a, b, 1), (c, d, -1)])
                plus(row, logarithm(ratio), F(-1))
                if self.bases["length-product"].membership(row) is None:
                    premise = self.bases["length-add"].prove(self.row("length-add", [(a, b, 1), (c, d, -ratio)]))
                    self.assert_row("length-product", row, "positive-length-ratio", [premise], ratio=str(ratio))
            else:
                additive[normalized] = a, b, coefficient
        multiplicative = {}
        for a, b in pairs:
            reduced, _ = self.bases["length-product"].reduce({symbol("length-product", a, b): F(1)})
            variables = {key: value for key, value in reduced.items() if Basis.geometric(key)}
            constants = {key: value for key, value in reduced.items() if not Basis.geometric(key)}
            key = tuple(sorted(variables.items()))
            if key not in multiplicative:
                multiplicative[key] = a, b, constants
                continue
            c, d, other = multiplicative[key]
            difference = plus(dict(constants), other, F(-1))
            if any(value.denominator != 1 or abs(value) > 32 for value in difference.values()):
                continue
            ratio = F(1)
            for variable, power in difference.items():
                ratio *= F(int(variable[4:-1])) ** int(power)
            if ratio.numerator.bit_length() + ratio.denominator.bit_length() > 96:
                continue
            row = self.row("length-add", [(a, b, 1), (c, d, -ratio)])
            if self.bases["length-add"].membership(row) is None:
                log_row = plus(self.row("length-product", [(a, b, 1), (c, d, -1)]), logarithm(ratio), F(-1))
                premise = self.bases["length-product"].prove(log_row)
                self.assert_row("length-add", row, "positive-length-ratio", [premise], ratio=str(ratio))

    def prove_predicate(self, predicate):
        if str(predicate) in self.given:
            return self.given[str(predicate)]
        existing = self.incidence_source(predicate.name, predicate.points) if predicate.name in self.incidence else None
        if existing:
            return self.graph.add("geometry", "incidence-subset", [existing], predicate=str(predicate))
        row = self.predicate_row(predicate)
        if row:
            return self.bases[row[0]].prove(row[1], str(predicate))
        if predicate.name == "coll":
            names = list(map(str, predicate.points))
            if len(names) < 3:
                return None
            parents = [self.bases["angle"].prove(self.angle(names[1], names[0], point)) for point in names[2:]]
            if all(parents):
                return self.graph.add("geometry", "collinear-from-directions", parents, predicate=str(predicate))
        return None


class TracedDDAR(DDAR):
    def __init__(self, points, knowledge):
        self.knowledge = knowledge
        self.current_assumption = None
        super().__init__(points)

    def force_collinear(self, points):
        source = self.current_assumption
        result = super().force_collinear(points)
        self.knowledge.collinear(points, source)
        return result

    def force_concyclic(self, points, centers):
        result = super().force_concyclic(points, centers)
        self.knowledge.cyclic(points, centers, self.current_assumption)
        return result

    def force_similar(self, first, second):
        if (first, second) not in self.known_similar:
            self.knowledge.sync_lengths()
            self.knowledge.similar(first, second)
        return super().force_similar(first, second)

    def transfer_dist_add_mul(self):
        self.knowledge.sync_lengths()
        return super().transfer_dist_add_mul()


def generate_proof(data, validate_assumption):
    started = time.perf_counter()
    problem = AGProblem.parse(data["premise"])
    if not 1 <= len(problem.points) <= 40 or len(problem.preds) + len(data.get("goals", [])) > 250:
        raise ValueError("Readable proof budget exceeded")
    if any(not all(math.isfinite(float(value)) for value in point.value) for point in problem.points):
        raise ValueError("Non-finite proof coordinates")
    hypothetical = data.get("assumptionMode") == "hypothetical"
    knowledge = Knowledge(problem.points, hypothetical)
    symbols = {entry["id"]: entry["symbol"] for entry in data.get("names", [])}
    for branch in data.get("branches", []):
        if branch["role"] == "assumption":
            knowledge.branch_parents.append(knowledge.graph.add("guard", "ordinary-angle-branch",
                points=[symbols.get(name, name) for name in branch["angle"]], sign=branch["sign"], lift=branch["lift"]))
    engine = None if hypothetical else TracedDDAR(problem.points, knowledge)
    sources = {entry["predicate"]: entry["candidateIds"] for entry in data.get("assumptionSources", [])}
    validation = []
    for predicate in problem.preds:
        try:
            validate_assumption(predicate)
        except (ValueError, AssertionError, ArithmeticError) as error:
            validation.append({"predicate": str(predicate), "message": str(error) or "Coordinate witness rejected"})
            if not hypothetical:
                raise ValueError("Coordinate witness rejected. Enable hypothesis exploration to use these assumptions: " + str(predicate)) from error
        root = knowledge.assume(predicate, sources.get(str(predicate), []))
        if engine:
            engine.current_assumption = root
            try:
                engine.force_pred(predicate)
            finally:
                engine.current_assumption = None
        knowledge.sync_lengths()
    if engine:
        with contextlib.redirect_stdout(io.StringIO()):
            engine.deduction_closure(progress_dot=False)
    knowledge.sync_lengths()
    from parse import AGPredicate
    names = {point.name: point for point in problem.points}
    conclusions = []
    for text in data.get("goals", [])[:64]:
        goal = AGPredicate.parse(text).replace_points(names)
        node = None if knowledge.graph.contradictions else knowledge.prove_predicate(goal)
        known = bool(engine.check_pred(goal)) if engine else bool(node)
        if known and node is None and not knowledge.graph.contradictions:
            node = knowledge.graph.add("gap", "unreconstructed-ddar-conclusion", predicate=text)
        conclusions.append({"predicate": text, "nodeId": node, "backendKnown": known,
            "status": "assumed" if text in knowledge.given and not knowledge.graph.contradictions else "recorded" if node and knowledge.graph.by_id[node]["kind"] != "gap" else "unexplained" if known else "not-derived"})
    if not conclusions:
        for node in list(dict.fromkeys(knowledge.facts))[-12:]:
            if node and node not in knowledge.assumptions:
                conclusions.append({"nodeId": node, "backendKnown": True, "status": "recorded"})
    report = knowledge.graph.export(conclusions, knowledge.assumptions, "hypothetical" if hypothetical else "ddar")
    report["witnessFailures"] = validation
    checks = [item["backendKnown"] for item in conclusions]
    return {"status": "inconsistent" if knowledge.graph.contradictions else "derived" if checks and all(checks) else "not-derived",
        "checks": checks, "elapsedMs": round((time.perf_counter() - started) * 1000, 2), "points": len(problem.points),
        "assumptions": len(problem.preds), "certificate": None, "proof": report}
