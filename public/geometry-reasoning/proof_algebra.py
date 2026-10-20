"""Exact provenance rows, independent of DDAR's numerical elimination choices."""

from fractions import Fraction as F
from math import gcd


def plus(target, other, coefficient=F(1)):
    for variable, value in other.items():
        result = target.get(variable, F(0)) + coefficient * value
        if result:
            target[variable] = result
        else:
            target.pop(variable, None)
    return target


def scaled(row, coefficient):
    return {key: value * coefficient for key, value in row.items() if value * coefficient}


def serialize(row):
    return [{"variable": key, "coefficient": str(value)} for key, value in sorted(row.items()) if value]


class ProofGraph:
    def __init__(self, limit=1600):
        self.nodes = []
        self.by_id = {}
        self.limit = limit
        self.limited = False
        self.contradictions = []

    def add(self, kind, rule, premises=(), **content):
        if len(self.nodes) >= self.limit and kind != "assumption":
            self.limited = True
            return None
        node_id = "s" + str(len(self.nodes) + 1)
        node = {"id": node_id, "kind": kind, "rule": rule,
                "premises": [{"id": item, "coefficient": "1"} if isinstance(item, str) else item for item in premises if item], **content}
        self.nodes.append(node)
        self.by_id[node_id] = node
        return node_id

    def equation(self, kind, rule, domain, row, premises=(), **content):
        return self.add(kind, rule, premises, equation={"domain": domain, "terms": serialize(row)}, **content)

    def export(self, conclusions, assumptions, mode):
        needed = {item["nodeId"] for item in conclusions if item.get("nodeId")}
        needed.update(assumptions)
        needed.update(self.contradictions)
        pending = list(needed)
        while pending:
            for parent in self.by_id[pending.pop()]["premises"]:
                if parent["id"] not in needed:
                    needed.add(parent["id"])
                    pending.append(parent["id"])
        nodes = [node for node in self.nodes if node["id"] in needed]
        for conclusion in conclusions:
            todo = [conclusion["nodeId"]] if conclusion.get("nodeId") else []
            visited = set()
            while todo:
                node_id = todo.pop()
                if node_id in visited:
                    continue
                visited.add(node_id)
                node = self.by_id[node_id]
                if node["kind"] == "gap":
                    conclusion["status"] = "unexplained"
                todo.extend(parent["id"] for parent in node["premises"])
        replay = replay_algebra(nodes)
        gaps = [node["id"] for node in nodes if node["kind"] == "gap"]
        return {"version": 1, "mode": mode, "nodes": nodes, "conclusions": conclusions,
                "assumptionIds": assumptions, "contradictionIds": self.contradictions,
                "gapIds": gaps, "guardIds": [node["id"] for node in nodes if node["kind"] == "guard"],
                "algebraReplay": replay, "limited": self.limited,
                "explanation": "partial" if gaps or self.limited else "recorded",
                "certificate": None}


class Basis:
    """Integer row lattice for angles; rational elimination for lengths.

    A failed membership check is incomplete, never a disproof. In particular, we
    do not divide a modular assumption by its coefficient just to get a proof.
    """
    def __init__(self, graph, domain):
        self.graph = graph
        self.domain = domain
        self.rows = {}

    @staticmethod
    def geometric(variable):
        return variable != "pi" and (not variable.startswith("log(") or variable.startswith("log(|"))

    def reduce(self, original):
        row = {key: value for key, value in original.items() if value}
        used = {}
        for pivot, (basis, lineage) in sorted(self.rows.items()):
            coefficient = row.get(pivot, F(0))
            if self.domain == "angle":
                coefficient = coefficient // basis[pivot]
            if coefficient:
                plus(row, basis, -coefficient)
                plus(used, lineage, coefficient)
        return row, used

    def add(self, original, node_id):
        if not node_id:
            return
        if self.domain == "angle":
            return self.add_angle(original, node_id)
        row, used = self.reduce(original)
        lineage = plus({node_id: F(1)}, used, F(-1))
        variables = [variable for variable in row if self.geometric(variable)]
        if not variables:
            impossible = bool(row) and (self.domain != "angle" or row.get("pi", F(0)).denominator != 1)
            permitted = self.domain != "angle" or all(value.denominator == 1 for value in lineage.values())
            if impossible and permitted:
                node = self.graph.equation("contradiction", "incompatible-equations", self.domain, row,
                    [{"id": key, "coefficient": str(value)} for key, value in lineage.items()])
                if node:
                    self.graph.contradictions.append(node)
            return
        pivot = min(variables)
        coefficient = F(1) / row[pivot]
        self.rows[pivot] = scaled(row, coefficient), scaled(lineage, coefficient)

    def add_angle(self, original, node_id):
        # Hermite-style integer row operations retain dependent rows that a
        # rational echelon basis would discard. E.g. 2a=0 and 3a=0 imply a=0;
        # 2a=0 alone still does not. Never divide a modular equation.
        if any(value.denominator != 1 for key, value in original.items() if self.geometric(key)):
            raise ValueError("Directed-angle coefficients must be integers")
        row, lineage = {key: value for key, value in original.items() if value}, {node_id: F(1)}
        while any(self.geometric(key) for key in row):
            pivot = min(key for key in row if self.geometric(key))
            if pivot not in self.rows:
                break
            basis, source = self.rows[pivot]
            b = int(row[pivot])
            a = int(basis[pivot])
            if b % a == 0:
                plus(row, basis, -F(b, a))
                plus(lineage, source, -F(b, a))
                continue
            # Bezout coefficients, including negative b.
            r0, r1, s0, s1, t0, t1 = a, b, 1, 0, 0, 1
            while r1:
                q = r0 // r1
                r0, r1, s0, s1, t0, t1 = r1, r0 - q * r1, s1, s0 - q * s1, t1, t0 - q * t1
            g = gcd(a, b)
            s, t = s0 * (1 if r0 > 0 else -1), t0 * (1 if r0 > 0 else -1)
            self.rows[pivot] = (plus(scaled(basis, F(s)), row, F(t)), plus(scaled(source, F(s)), lineage, F(t)))
            row = plus(scaled(row, F(a, g)), basis, -F(b, g))
            lineage = plus(scaled(lineage, F(a, g)), source, -F(b, g))
        variables = [key for key in row if self.geometric(key)]
        if variables:
            pivot = min(variables)
            sign = F(1) if row[pivot] > 0 else F(-1)
            self.rows[pivot] = scaled(row, sign), scaled(lineage, sign)
        elif row.get("pi", F(0)).denominator != 1:
            contradiction = self.graph.equation("contradiction", "incompatible-equations", "angle", row,
                [{"id": key, "coefficient": str(value)} for key, value in lineage.items()])
            if contradiction:
                self.graph.contradictions.append(contradiction)

    def membership(self, row):
        remainder, used = self.reduce(row)
        if self.domain == "angle":
            if any(key != "pi" for key in remainder) or remainder.get("pi", F(0)).denominator != 1:
                return None
            if any(value.denominator != 1 for value in used.values()):
                return None
        elif remainder:
            return None
        return used

    def prove(self, row, predicate=None):
        used = self.membership(row)
        if used is None:
            return None
        if len(used) == 1 and next(iter(used.values())) == 1:
            existing = next(iter(used))
            node = self.graph.by_id[existing]
            equation = node.get("equation")
            if equation and equation["terms"] == serialize(row) and not predicate:
                return existing
        return self.graph.equation("algebra", "integer-angle-combination" if self.domain == "angle" else "rational-linear-combination",
            self.domain, row, [{"id": key, "coefficient": str(value)} for key, value in used.items()],
            **({"predicate": predicate} if predicate else {}))


def replay_algebra(nodes):
    """Recheck coefficients and DAG references, without reading point coordinates.

    Geometric theorem instances and witness guards are explicit trust inputs to
    this first checker. This is not a full independent geometry certificate.
    """
    seen = {}
    checked = 0
    errors = []
    for node in nodes:
        parents = node.get("premises", [])
        if node["id"] in seen or any(parent["id"] not in seen for parent in parents):
            errors.append(node["id"] + ": invalid DAG reference")
        if node["kind"] in ("algebra", "contradiction"):
            equation = node["equation"]
            actual = {term["variable"]: F(term["coefficient"]) for term in equation["terms"]}
            expected = {}
            for parent in parents:
                source = seen.get(parent["id"], {}).get("equation")
                coefficient = F(parent["coefficient"])
                if not source or source["domain"] != equation["domain"]:
                    errors.append(node["id"] + ": incompatible algebra source")
                    continue
                if equation["domain"] == "angle" and coefficient.denominator != 1:
                    errors.append(node["id"] + ": noninteger modular combination")
                plus(expected, {term["variable"]: F(term["coefficient"]) for term in source["terms"]}, coefficient)
            difference = plus(actual, expected, F(-1))
            valid = not difference or equation["domain"] == "angle" and set(difference) == {"pi"} and difference["pi"].denominator == 1
            if not valid:
                errors.append(node["id"] + ": coefficient replay failed")
            checked += 1
        seen[node["id"]] = node
    return {"checked": checked, "valid": not errors, "errors": errors}
