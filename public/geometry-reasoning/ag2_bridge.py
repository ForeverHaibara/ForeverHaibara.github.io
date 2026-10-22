"""Site bridge: explicit assumptions and queries, no command interpretation."""

import contextlib
import io
import itertools
import json
import math
import time

import numpy as np
from ddar import DDAR
from parse import AGPredicate, AGProblem
import numericals as ng


def validate_assumption(pred):
    """Reject incompatible numerical witnesses instead of loosening AG2 tolerances."""
    points = [point.value for point in pred.points]
    name = pred.name
    distances = lambda: [ng.distance(points[i], points[i + 1])
                         for i in range(0, len(points), 2)]
    if name == "overlap":
        valid = ng.distance(*points) < ng.ATOM
    elif name == "coll":
        a, b = max(itertools.combinations(points, 2),
                   key=lambda pair: ng.distance(*pair))
        valid = ng.distance(a, b) >= ng.ATOM and all(
            ng.NumLine.through(a, b).distance(p) < ng.ATOM for p in points)
    elif name == "cyclic":
        triple = max(itertools.combinations(points, 3), key=lambda ps: abs(
            np.linalg.det(np.stack((ps[1] - ps[0], ps[2] - ps[0])))))
        circle = ng.NumCircle.through(*triple)
        valid = all(circle.distance(p) < ng.ATOM for p in points)
    elif name in ("para", "perp", "angeq"):
        directions = [ng.NumLine.through(points[i], points[i + 1]).direction()
                      for i in range(0, len(points), 2)]
        if name == "angeq":
            value = sum(a * b for a, b in zip(directions, pred.constants[:-1]))
            value += float(pred.constants[-1]) / 180
        else:
            value = directions[0] - directions[1] - (0.5 if name == "perp" else 0)
        valid = abs((value + 0.5) % 1 - 0.5) ** 2 < ng.ATOM
    elif name == "cong":
        a, b = distances()
        valid = a > 0 and b > 0 and abs(a / b - 1) ** 2 < ng.ATOM
    elif name == "distmeq":
        value = sum(float(c) * math.log(d)
                    for c, d in zip(pred.constants[:-1], distances()))
        valid = abs(math.exp(value) * float(pred.constants[-1]) - 1) ** 2 < ng.ATOM
    elif name == "distseq":
        valid = abs(sum(float(c) * d for c, d in zip(pred.constants, distances()))) ** 2 < ng.ATOM
    else:
        raise ValueError("Unsupported site predicate: " + name)
    if not valid:
        raise ValueError("Selected observation does not meet AG2 witness tolerances: " + str(pred))


def solve_json(payload):
    data = json.loads(payload)
    if data.get("version") != 1:
        raise ValueError("Unsupported reasoning protocol version")
    if data.get("operation") == "proof" or data.get("vectorContext") is not None:
        if data.get("operation") != "proof" and data.get("goalId") is None:
            raise ValueError("Select a goal first")
        from proof_ddar import generate_proof
        result = generate_proof(data, validate_assumption)
        if data.get("operation") != "proof":
            result.pop("proof", None)
            if data.get("alreadyAssumed") and result["status"] != "inconsistent":
                result["status"] = "already-assumed"
        return json.dumps(result)
    problem = AGProblem.parse(data["premise"])
    if not 1 <= len(problem.points) <= 40:
        raise ValueError("Point budget exceeded")
    if any(not np.all(np.isfinite(point.value)) for point in problem.points):
        raise ValueError("Non-finite coordinate witness")
    queries = data.get("goals", [])
    if len(problem.preds) + len(queries) > 250:
        raise ValueError("Predicate budget exceeded")
    if data.get("goalId") is None:
        raise ValueError("Select a goal first")
    names = {point.name: point for point in problem.points}
    goals = [AGPredicate.parse(query).replace_points(names) for query in queries]
    start = time.perf_counter()
    for pred in problem.preds:
        validate_assumption(pred)
    engine = DDAR(problem.points)
    for pred in problem.preds:
        engine.force_pred(pred)
    # A goal may be a conjunction. Every component must be known.
    with contextlib.redirect_stdout(io.StringIO()):
        engine.deduction_closure(progress_dot=False)
    checks = [bool(engine.check_pred(goal)) for goal in goals]
    return json.dumps({
        "status": "already-assumed" if data.get("alreadyAssumed") else
                  "derived" if all(checks) else "not-derived",
        "checks": checks,
        "elapsedMs": round((time.perf_counter() - start) * 1000, 2),
        "points": len(problem.points),
        "assumptions": len(problem.preds),
        "certificate": None,
    })
