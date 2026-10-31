"""Conservative ETC cyclic-coordinate parser shared by the manual importer.

Only a single cyclic barycentric/trilinear formula is stored. Unsupported
notation is rejected rather than interpreted as an implicit new variable.
"""

from __future__ import annotations

import ast
from html import unescape
import math
import re
from bs4 import BeautifulSoup


VARIABLES = {'a', 'b', 'c', 'A', 'B', 'C', 's', 'sa', 'sb', 'sc',
             'S', 'SA', 'SB', 'SC', 'r', 'R'}
FUNCTIONS = {'sqrt', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc'}
ROTATE = {'a': 'b', 'b': 'c', 'c': 'a', 'A': 'B', 'B': 'C', 'C': 'A',
          'sa': 'sb', 'sb': 'sc', 'sc': 'sa', 'SA': 'SB', 'SB': 'SC', 'SC': 'SA'}
TOKEN = re.compile(r'\d+(?:\.\d+)?|\.\d+|[A-Za-z_]+|[()+*/^,-]')
CYCLIC = re.compile(r'([ft])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*:\s*\1\s*\(\s*\3\s*,\s*\4\s*,\s*\2\s*\)\s*:\s*\1\s*\(\s*\4\s*,\s*\2\s*,\s*\3\s*\)', re.I)
WHERE = re.compile(r'where\s+([ft])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*=', re.I)
LABEL = re.compile(r'^(Barycentrics|Trilinears)\b\s*(.*)$', re.I)


def coordinate_text(fragment: str) -> list[str]:
    fragment = re.sub(r'<sup[^>]*>(.*?)</sup>', lambda m: '^(' + unescape(re.sub('<[^>]+>', '', m.group(1))) + ')',
                      fragment, flags=re.I | re.S)
    fragment = re.sub(r'<sub[^>]*>(.*?)</sub>', lambda m: '_' + unescape(re.sub('<[^>]+>', '', m.group(1))),
                      fragment, flags=re.I | re.S)
    fragment = re.sub(r'<br\s*/?>|</(?:p|h3|div)>|<hr\b[^>]*>', '\n', fragment, flags=re.I)
    plain = unescape(BeautifulSoup(fragment, 'html.parser').get_text())
    return [re.sub(r'\s+', ' ', line).strip() for line in plain.splitlines() if line.strip()]


def normalize_formula(raw: str) -> str | None:
    raw = unescape(raw).replace('−', '-').replace('×', '*').replace('·', '*')
    for _ in range(3):
        raw = re.sub(r'(?<![A-Za-z])([abcS])(\d{1,2})(?=[abc]|\b)', r'\1^\2', raw)
    raw = re.sub(r'\b([Ss])_([ABCabc])\b', lambda m: m.group(1) + m.group(2).upper()
                 if m.group(1) == 'S' else m.group(1) + m.group(2).lower(), raw)
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\s+(\d*)\s*([ABC])\b',
                 lambda m: f'{m.group(1)}({m.group(2) + "*" if m.group(2) else ""}{m.group(3)})', raw)
    raw = re.sub(r'\s+', '', raw)
    if not raw or len(raw) > 160:
        return None
    tokens: list[str] = []
    position = 0
    while position < len(raw):
        match = TOKEN.match(raw, position)
        if not match:
            return None
        token = match.group()
        if token.isalpha() and token not in VARIABLES | FUNCTIONS:
            if re.fullmatch('[abc]{2,3}', token):
                tokens.extend(token)
            else:
                return None
        else:
            tokens.append(token)
        position = match.end()
    output: list[str] = []
    for index, token in enumerate(tokens):
        if index:
            previous = tokens[index-1]
            prev_operand = previous == ')' or previous in VARIABLES or previous[0].isdigit()
            next_operand = token == '(' or token in VARIABLES | FUNCTIONS or token[0].isdigit()
            if prev_operand and next_operand and not (previous in FUNCTIONS and token == '('):
                output.append('*')
        output.append(token)
    formula = ''.join(output)
    try:
        validate_formula(formula)
    except (SyntaxError, ValueError):
        return None
    return formula


def validate_formula(formula: str) -> ast.Expression:
    tree = ast.parse(formula.replace('^', '**'), mode='eval')
    nodes = list(ast.walk(tree))
    parents = {child: parent for parent in nodes for child in ast.iter_child_nodes(parent)}
    if len(nodes) > 100:
        raise ValueError('Coordinate expression is too large')
    for node in nodes:
        if isinstance(node, (ast.Expression, ast.Load, ast.Add, ast.Sub, ast.Mult, ast.Div,
                             ast.Pow, ast.UAdd, ast.USub, ast.Constant)):
            if isinstance(node, ast.Constant) and (not isinstance(node.value, (int, float))
                                                    or abs(node.value) > 1_000_000):
                raise ValueError('Invalid coordinate constant')
            continue
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            if isinstance(node.op, ast.Pow) and not isinstance(node.right, ast.Constant):
                # Rational exponents are represented by (1/2); inspect below.
                if not (isinstance(node.right, ast.BinOp) and isinstance(node.right.op, ast.Div)
                        and all(isinstance(x, ast.Constant) for x in (node.right.left, node.right.right))):
                    raise ValueError('Variable exponent')
            if isinstance(node.op, ast.Pow) and isinstance(node.right, ast.Constant) and abs(node.right.value) > 16:
                raise ValueError('Exponent is too large')
            continue
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            continue
        if isinstance(node, ast.Name) and (node.id in VARIABLES or
                                           node.id in FUNCTIONS and isinstance(parents.get(node), ast.Call)
                                           and parents[node].func is node):
            continue
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS and len(node.args) == 1 and not node.keywords:
            continue
        raise ValueError('Unsupported coordinate syntax')
    return tree


def coordinate_candidates(fragment: str) -> list[tuple[str, str, str]]:
    lines = coordinate_text(fragment)
    found: list[tuple[str, str, str]] = []
    for index, line in enumerate(lines):
        label = LABEL.match(line)
        if not label:
            continue
        kind = 'B' if label.group(1).lower() == 'barycentrics' else 'H'
        text = label.group(2)
        for next_line in lines[index+1:index+4]:
            if LABEL.match(next_line) or re.match(r'^X\s*\(\d+\)', next_line, re.I):
                break
            if 'where' in text.lower() and '=' not in text[text.lower().find('where'):]:
                text += ' ' + next_line
            elif WHERE.search(text) and normalize_formula(next_line):
                text += ' ' + next_line
            elif not ':' in text and (text.endswith('(') or re.search(r'\b[ft]\([aA],[bB],[cC]\)\s*$', text)):
                text += ' ' + next_line
            else:
                break
        where = WHERE.search(text)
        if where and CYCLIC.search(text[:where.start()]):
            head = CYCLIC.search(text[:where.start()])
            if head and tuple(head.groups()[1:]) == tuple(where.groups()[1:]):
                raw = text[where.end():].split(' (Peter ', 1)[0].strip()
                formula = normalize_formula(raw)
                if formula:
                    found.append((kind, formula, line))
            continue
        direct = re.match(r'^(.*?)\s*:\s*:', text)
        if direct:
            formula = normalize_formula(direct.group(1))
            if formula:
                found.append((kind, formula, line))
    return list(dict.fromkeys(found))


def rotate_formula(formula: str, times: int) -> str:
    return re.sub(r'[A-Za-z_]+', lambda m: _rotate_name(m.group(), times), formula)


def _rotate_name(name: str, times: int) -> str:
    for _ in range(times):
        name = ROTATE.get(name, name)
    return name


def side_environment(a: float, b: float, c: float) -> dict[str, float]:
    s = (a+b+c)/2
    area = math.sqrt(max(0, s*(s-a)*(s-b)*(s-c)))
    S = 2*area
    return {'a': a, 'b': b, 'c': c, 'A': math.acos(max(-1, min(1, (b*b+c*c-a*a)/(2*b*c)))),
            'B': math.acos(max(-1, min(1, (c*c+a*a-b*b)/(2*c*a)))),
            'C': math.acos(max(-1, min(1, (a*a+b*b-c*c)/(2*a*b)))),
            's': s, 'sa': s-a, 'sb': s-b, 'sc': s-c, 'S': S,
            'SA': (b*b+c*c-a*a)/2, 'SB': (c*c+a*a-b*b)/2, 'SC': (a*a+b*b-c*c)/2,
            'r': area/s, 'R': a*b*c/(4*area)}


def evaluate_formula(formula: str, values: dict[str, float]) -> float | None:
    tree = validate_formula(formula)
    funcs = {'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
             'cot': lambda x: 1/math.tan(x), 'sec': lambda x: 1/math.cos(x),
             'csc': lambda x: 1/math.sin(x)}

    def evaluate(node: ast.AST) -> float:
        if isinstance(node, ast.Expression): return evaluate(node.body)
        if isinstance(node, ast.Constant): return float(node.value)
        if isinstance(node, ast.Name): return values[node.id]
        if isinstance(node, ast.UnaryOp): return evaluate(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        if isinstance(node, ast.Call): return funcs[node.func.id](evaluate(node.args[0]))
        if isinstance(node, ast.BinOp):
            left, right = evaluate(node.left), evaluate(node.right)
            if isinstance(node.op, ast.Add): return left+right
            if isinstance(node.op, ast.Sub): return left-right
            if isinstance(node.op, ast.Mult): return left*right
            if isinstance(node.op, ast.Div): return left/right
            if isinstance(node.op, ast.Pow): return left**right
        raise ValueError('Unsupported coordinate AST')

    try:
        result = evaluate(tree)
        return float(result) if isinstance(result, (int, float)) and math.isfinite(result) else None
    except (ArithmeticError, ValueError, OverflowError, TypeError):
        return None
