"""Conservative ETC cyclic-coordinate parser shared by the manual importer.

Only a single cyclic barycentric formula is stored; trilinears are converted
by multiplying the first coordinate by side a before storage.
"""

from __future__ import annotations

import ast
from html import unescape
import math
import re
from bs4 import BeautifulSoup


VARIABLES = {'a', 'b', 'c', 'A', 'B', 'C', 's', 'sa', 'sb', 'sc',
             'S', 'SA', 'SB', 'SC', 'SW', 'r', 'R', 'pi'}
FUNCTIONS = {'sqrt', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'asinh'}
ROTATE = {'a': 'b', 'b': 'c', 'c': 'a', 'A': 'B', 'B': 'C', 'C': 'A',
          'sa': 'sb', 'sb': 'sc', 'sc': 'sa', 'SA': 'SB', 'SB': 'SC', 'SC': 'SA'}
TOKEN = re.compile(r'\d+(?:\.\d+)?|\.\d+|[A-Za-z_]+|[()+*/^,-]')
CYCLIC = re.compile(r'([fght])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*:\s*\1\s*\(\s*\3\s*,\s*\4\s*,\s*\2\s*\)\s*:\s*\1\s*\(\s*\4\s*,\s*\2\s*,\s*\3\s*\)', re.I)
WHERE = re.compile(r'where\s+([fght])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*=', re.I)
LABEL = re.compile(r'^(Barycentrics|Trilinears)\b\s*(.*)$', re.I)
ATTRIBUTION = re.compile(r"\s+\([A-ZÀ-ÖØ-Þ][\w\uFFFD.'’\-]*(?:\s+[A-ZÀ-ÖØ-Þ][\w\uFFFD.'’\-]*)*\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ\uFFFD'’\-]{1,}(?:,\s*[^()]*)?\)\s*$")
MAX_FORMULA_LENGTH = 500
MAX_FORMULA_EXPONENT = 32
MAX_FORMULA_NODES = 1000


def coordinate_text(fragment: str) -> list[str]:
    # Source formatting alone does not create an HTML line break. Keep a blank
    # source line as a boundary, and leave explicit <br>/block boundaries below.
    fragment = re.sub(r'[ \t]*\r?\n(?:[ \t]*\r?\n)*[ \t]*',
                      lambda m: '\n' if m.group().count('\n') > 1 else ' ', fragment)
    fragment = re.sub(r'<sup[^>]*>(.*?)</sup>', lambda m: '^(' + unescape(re.sub('<[^>]+>', '', m.group(1))) + ')',
                      fragment, flags=re.I | re.S)
    fragment = re.sub(r'<sub[^>]*>(.*?)</sub>', lambda m: '_' + unescape(re.sub('<[^>]+>', '', m.group(1))),
                      fragment, flags=re.I | re.S)
    fragment = re.sub(r'<br\s*/?>|</?(?:p|h3|div)\b[^>]*>|<hr\b[^>]*>', '\n', fragment, flags=re.I)
    plain = unescape(BeautifulSoup(fragment, 'html.parser').get_text()).replace('\u00ad', '')
    return [re.sub(r'\s+', ' ', line).strip() for line in plain.splitlines() if line.strip()]


def normalize_formula(raw: str) -> str | None:
    raw = (unescape(raw).replace('−', '-').replace('×', '*').replace('·', '*')
           .replace('π', 'pi').replace('[', '(').replace(']', ')'))
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\^\((\d+)\)\(([^()]*)\)',
                 lambda m: f'({m.group(1)}({m.group(3)}))^{m.group(2)}', raw)
    raw = re.sub(r'\b(?:Sin|Cos|Tan|Cot|Sec|Csc|Sqrt|Pi)\b', lambda m: m.group().lower(), raw)

    # ETC X(3371) prints pi8; do not silently interpret it as 8*pi.
    if re.search(r'\bpi\d', raw):
        return None
    for _ in range(3):
        raw = re.sub(r'(?<![A-Za-z])([abcS])(\d{1,2})(?=[abc]|\b)', r'\1^\2', raw)
    raw = re.sub(r'\b([Ss])_([ABCabc])\b', lambda m: m.group(1) + m.group(2).upper()
                 if m.group(1) == 'S' else m.group(1) + m.group(2).lower(), raw)
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\s+(\d*)\s*([ABC])\s*/\s*(\d+)\b',
                 lambda m: f'{m.group(1)}({m.group(2) + "*" if m.group(2) else ""}{m.group(3)}/{m.group(4)})', raw)
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\s+(\d*)\s*([ABC])\b',
                 lambda m: f'{m.group(1)}({m.group(2) + "*" if m.group(2) else ""}{m.group(3)})', raw)
    raw = re.sub(r'\b([abcABC])\s+(?=(?:sin|cos|tan|cot|sec|csc)\b)', r'\1*', raw)
    raw = re.sub(r'\s+', '', raw)
    if not raw or len(raw) > MAX_FORMULA_LENGTH:
        return None
    tokens: list[str] = []
    position = 0
    while position < len(raw):
        match = TOKEN.match(raw, position)
        if not match:
            return None
        token = match.group()
        if token.isalpha() and token not in VARIABLES | FUNCTIONS:
            if re.fullmatch('[abcSrR]{2,3}', token):
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
    if len(formula) > MAX_FORMULA_LENGTH:
        return None
    try:
        validate_formula(formula)
    except (SyntaxError, ValueError):
        return None
    return formula


def constant_exponent(node: ast.AST) -> float | None:
    if isinstance(node, ast.Constant):
        return float(node.value) if isinstance(node.value, (int, float)) and abs(node.value) <= 1_000_000 else None
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = constant_exponent(node.operand)
        return None if value is None else (-value if isinstance(node.op, ast.USub) else value)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        left, right = constant_exponent(node.left), constant_exponent(node.right)
        return left / right if left is not None and right is not None and right != 0 else None
    return None


def validate_formula(formula: str) -> ast.Expression:
    tree = ast.parse(formula.replace('^', '**'), mode='eval')
    nodes = list(ast.walk(tree))
    parents = {child: parent for parent in nodes for child in ast.iter_child_nodes(parent)}
    if len(nodes) > MAX_FORMULA_NODES:
        raise ValueError('Coordinate expression is too large')
    for node in nodes:
        if isinstance(node, (ast.Expression, ast.Load, ast.Add, ast.Sub, ast.Mult, ast.Div,
                             ast.Pow, ast.UAdd, ast.USub, ast.Constant)):
            if isinstance(node, ast.Constant) and (not isinstance(node.value, (int, float))
                                                    or abs(node.value) > 1_000_000):
                raise ValueError('Invalid coordinate constant')
            continue
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            if isinstance(node.op, ast.Pow):
                exponent = constant_exponent(node.right)
                if exponent is None:
                    raise ValueError('Variable exponent')
                if not math.isfinite(exponent) or abs(exponent) > MAX_FORMULA_EXPONENT:
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


def canonical_formula(formula: str):
    """Compare commutative sums and products without algebraic rewriting."""
    def canonical(node):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mult)):
            kind = type(node.op)
            def flatten(child):
                if isinstance(child, ast.BinOp) and isinstance(child.op, kind):
                    return flatten(child.left) + flatten(child.right)
                return [canonical(child)]
            return (kind.__name__, tuple(sorted(flatten(node))))
        if isinstance(node, ast.BinOp):
            return (type(node.op).__name__, canonical(node.left), canonical(node.right))
        if isinstance(node, ast.UnaryOp):
            return (type(node.op).__name__, canonical(node.operand))
        if isinstance(node, ast.Call):
            return ('Call', node.func.id, canonical(node.args[0]))
        if isinstance(node, ast.Name):
            return ('Name', node.id)
        if isinstance(node, ast.Constant):
            return ('Constant', str(node.value))
        raise ValueError('Unsupported coordinate syntax')
    return canonical(validate_formula(formula).body)


def coordinate_candidates(fragment: str) -> list[tuple[str, str, str]]:
    lines: list[str] = []
    for line in coordinate_text(fragment):
        # Consecutive coordinate declarations may be separated only by source
        # whitespace, which HTML collapses; each label still starts a new one.
        lines.extend(re.split(r'\s+(?=(?:Barycentrics|Trilinears)\b)', line, flags=re.I)
                     if LABEL.match(line) else [line])
    found: list[tuple[str, str, str]] = []
    for index, line in enumerate(lines):
        label = LABEL.match(line)
        if not label:
            continue
        trilinear = label.group(1).lower() == 'trilinears'
        text = label.group(2)
        for next_line in lines[index+1:index+11]:
            if LABEL.match(next_line) or re.match(r'^X\s*\(\d+\)', next_line, re.I):
                break
            if not text:
                text = next_line
            elif (not CYCLIC.search(text) and re.search(r'[fght]\s*\(\s*[aA]\s*,\s*[bB]\s*,\s*[cC]\s*\)', text)
                    and re.match(r'^\s*(?::|[fght]\s*\()', next_line, re.I)):
                text += ' ' + next_line
            elif CYCLIC.search(text) and not WHERE.search(text) and next_line.lower().startswith('where '):
                text += ' ' + next_line
            elif 'where' in text.lower() and '=' not in text[text.lower().find('where'):]:
                text += ' ' + next_line
            elif WHERE.search(text) and (text.rstrip().endswith(('+', '-', '*', '/', '^', '('))
                                         or text.count('(') > text.count(')')):
                text += ' ' + next_line
            elif WHERE.search(text) and re.match(r'^(?:sin|cos|tan|cot|sec|csc)\s*\(', next_line, re.I) and normalize_formula(next_line):
                text += ' ' + next_line
            elif not ':' in text and text.endswith('('):
                text += ' ' + next_line
            elif not CYCLIC.search(text) and not re.search(r':\s*:', text) and text.count('(') > text.count(')'):
                text += ' ' + next_line
            elif not CYCLIC.search(text) and not re.search(r':\s*:', text) and text.rstrip().endswith(('+', '-', '*', '/', '^', '(')):
                text += ' ' + next_line
            else:
                break
        text = ATTRIBUTION.sub('', text)
        where = WHERE.search(text)
        if where and CYCLIC.search(text[:where.start()]):
            head = CYCLIC.search(text[:where.start()])
            if head and head.group(1).lower() == where.group(1).lower() and head.groups()[1:] == where.groups()[1:]:
                raw = text[where.end():].strip()
                formula = normalize_formula(raw)
                if formula:
                    barycentric = normalize_formula(f'a*({formula})') if trilinear else formula
                    if barycentric:
                        found.append(('B', barycentric, line))
            continue
        direct = re.match(r'^(.*?)\s*:\s*:', text)
        if direct:
            formula = normalize_formula(direct.group(1))
            if formula:
                barycentric = normalize_formula(f'a*({formula})') if trilinear else formula
                if barycentric:
                    found.append(('B', barycentric, line))
            continue
        parts = text.split(':')
        if len(parts) == 3:
            formulas = [normalize_formula(part.strip()) for part in parts]
            if all(formulas) and all(canonical_formula(rotate_formula(formulas[0], i)) == canonical_formula(formulas[i]) for i in (1, 2)):
                barycentric = normalize_formula(f'a*({formulas[0]})') if trilinear else formulas[0]
                if barycentric:
                    found.append(('B', barycentric, line))
        elif len(parts) == 1:
            formula = normalize_formula(text)
            if formula:
                swapped = re.sub(r'[A-Za-z_]+', lambda m: {'b': 'c', 'c': 'b', 'B': 'C', 'C': 'B', 'sb': 'sc', 'sc': 'sb', 'SB': 'SC', 'SC': 'SB'}.get(m.group(), m.group()), formula)
                if canonical_formula(formula) == canonical_formula(swapped):
                    barycentric = normalize_formula(f'a*({formula})') if trilinear else formula
                    if barycentric:
                        found.append(('B', barycentric, line))
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
            'r': area/s, 'R': a*b*c/(4*area), 'SW': (a*a+b*b+c*c)/2, 'pi': math.pi}


def evaluate_formula(formula: str, values: dict[str, float]) -> float | None:
    tree = validate_formula(formula)
    funcs = {'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
             'sinh': math.sinh, 'asinh': math.asinh,
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
