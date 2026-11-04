"""Conservative ETC cyclic-coordinate parser shared by the manual importer.

Only a single cyclic barycentric formula is stored; trilinears are converted
by multiplying the first coordinate by side a before storage.
"""

from __future__ import annotations

import ast
from functools import lru_cache
from html import unescape
import math
import re
import sys
from bs4 import BeautifulSoup


VARIABLES = {'a', 'b', 'c', 'A', 'B', 'C', 's', 'sa', 'sb', 'sc',
             'S', 'SA', 'SB', 'SC', 'SW', 'E', 'F', 'r', 'R', 'pi'}
FUNCTIONS = {'sqrt', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'asinh', 'atan', 'ln', 'abs'}
ROTATE = {'a': 'b', 'b': 'c', 'c': 'a', 'A': 'B', 'B': 'C', 'C': 'A',
          'x': 'y', 'y': 'z', 'z': 'x',
          'u': 'v', 'v': 'w', 'w': 'u',
          'sa': 'sb', 'sb': 'sc', 'sc': 'sa', 'SA': 'SB', 'SB': 'SC', 'SC': 'SA'}
TOKEN = re.compile(r'\d+(?:\.\d+)?|\.\d+|[A-Za-z_]+|[()+*/^,-]')
CYCLIC = re.compile(r'([fght])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*:\s*\1\s*\(\s*\3\s*,\s*\4\s*,\s*\2\s*\)\s*:\s*\1\s*\(\s*\4\s*,\s*\2\s*,\s*\3\s*\)', re.I)
WHERE = re.compile(r'where\s+([fght])\s*\(\s*([aA])\s*,\s*([bB])\s*,\s*([cC])\s*\)\s*=', re.I)
LABEL = re.compile(r'^(Barycentrics|Trilinears)\b\s*(.*)$', re.I)
ATTRIBUTION = re.compile(r"\s+\([A-ZÀ-ÖØ-Þ][\w\uFFFD.'’\-]*(?:\s+[A-ZÀ-ÖØ-Þ][\w\uFFFD.'’\-]*)*\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ\uFFFD'’\-]{1,}(?:,\s*[^()]*)?\)\s*$")
# Long ETC polynomials create deep, but otherwise ordinary, arithmetic ASTs.
sys.setrecursionlimit(max(sys.getrecursionlimit(), 10000))


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


@lru_cache(maxsize=8192)
def normalize_formula(raw: str) -> str | None:
    raw = (unescape(raw).replace('−', '-').replace('×', '*').replace('·', '*')
           .replace('π', 'pi').replace('ω', '(atan(S/SW))').replace('[', '(').replace(']', ')').replace('{', '(').replace('}', ')'))
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\^\((\d+)\)\s*(\d*)\s*([ABC])(?:\s*/\s*(\d+))?',
                 lambda m: '(%s(%s%s%s))^%s' % (m.group(1), (m.group(3) + '*') if m.group(3) else '', m.group(4), ('/' + m.group(5)) if m.group(5) else '', m.group(2)), raw)
    raw = re.sub(r'\b(sin|cos|tan|cot|sec|csc)\^\((\d+)\)\(([^()]*)\)',
                 lambda m: f'({m.group(1)}({m.group(3)}))^{m.group(2)}', raw)
    raw = re.sub(r'\b(?:' + '|'.join(sorted(FUNCTIONS | {'log', 'pi'})) + r')\b',
                 lambda m: 'ln' if m.group().lower() == 'log' else m.group().lower(), raw, flags=re.I)
    # Flat bar pairs delimit an arithmetic expression. The resulting whole AST
    # still has to validate; unmatched/nested bars and malformed groups fail.
    raw = re.sub(r'\|([^|]+)\|', r'(abs(\1))', raw)
    raw = re.sub(r'\b(max|min)\s*\(\s*([abc])\s*,\s*([abc])\s*\)',
                 lambda m: f'(({m[2]}+{m[3]}{"+" if m[1].lower()=="max" else "-"}abs({m[2]}-{m[3]}))/2)', raw, flags=re.I)

    # ETC X(3371) prints pi8; do not silently interpret it as 8*pi.
    if re.search(r'\bpi\d', raw):
        return None
    for _ in range(3):
        raw = re.sub(r'(?<![A-Za-z])([abcS])(\d+)(?=[abc]|\b)', r'\1^\2', raw)
    raw = re.sub(r'([Ss])_([ABCabc])(?![a-z_])', lambda m: m.group(1) + m.group(2).upper()
                 if m.group(1) == 'S' else m.group(1) + m.group(2).lower(), raw)
    # Euler's ABC length |OH|; expand before token validation, never expose a new runtime symbol.
    raw = re.sub(r'\bOH\b', '(sqrt(abs(9*R^2-2*SW)))', raw)
    raw = normalize_bare_functions(raw)
    symbols = '|'.join(sorted(VARIABLES, key=lambda name: (-len(name), name)))
    raw = re.sub(r'\b(' + symbols + r')\s+(?=(?:' + '|'.join(sorted(FUNCTIONS)) + r')\s*\()', r'\1*', raw)
    raw = re.sub(r'\s+', '', raw)
    if not raw:
        return None
    tokens: list[str] = []
    position = 0
    while position < len(raw):
        match = TOKEN.match(raw, position)
        if not match:
            return None
        token = match.group()
        if token.isalpha() and token not in VARIABLES | FUNCTIONS:
            # Conway products are often written without multiplication signs,
            # e.g. aS_A, bcS_BS_C, or EF. Match only known symbols.
            if re.fullmatch(r'(?:SA|SB|SC|SW|sa|sb|sc|[abcSsrREF])+', token):
                tokens.extend(re.findall(r'SA|SB|SC|SW|sa|sb|sc|[abcSsrREF]', token))
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
        formula = normalize_log_ratios(formula)
        validate_formula(formula)
    except (SyntaxError, ValueError, RecursionError, OverflowError):
        return None
    return formula


def normalize_log_ratios(formula: str) -> str:
    """Cancel scale in ln(b)-ln(c) only when it is an entire AST subtraction.

    Sides are positive, so this identity is exact. Substring replacement would
    incorrectly rewrite 2*ln(b)-ln(c) or -ln(b)-ln(c).
    """
    if 'ln(' not in formula:
        return formula
    changed = False
    def side_log(node):
        return (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                and node.func.id == 'ln' and len(node.args) == 1 and not node.keywords
                and isinstance(node.args[0], ast.Name) and node.args[0].id in {'a','b','c'})
    class Ratios(ast.NodeTransformer):
        def visit_BinOp(self, node):
            nonlocal changed
            self.generic_visit(node)
            if isinstance(node.op, ast.Sub) and side_log(node.left) and side_log(node.right):
                changed = True
                return ast.Call(func=ast.Name(id='ln',ctx=ast.Load()),
                                args=[ast.BinOp(left=node.left.args[0],op=ast.Div(),right=node.right.args[0])],
                                keywords=[])
            return node
    tree = Ratios().visit(ast.parse(formula.replace('^','**'),mode='eval'))
    return ast.unparse(tree).replace(' ','').replace('**','^') if changed else formula


def normalize_bare_functions(raw: str) -> str:
    """Insert calls with explicit atom boundaries; never guess log b/c or log bc."""
    angles = r'(sin|cos|tan|cot|sec|csc)'
    raw = re.sub(r'\b' + angles + r'\s+(\d*)\s*([ABC])\s*/\s*(\d+)\b',
                 lambda m: f'{m.group(1)}({m.group(2) + "*" if m.group(2) else ""}{m.group(3)}/{m.group(4)})', raw)
    raw = re.sub(r'\b' + angles + r'\s+(\d*)\s*([ABC])\b',
                 lambda m: f'{m.group(1)}({m.group(2) + "*" if m.group(2) else ""}{m.group(3)})', raw)
    # A general bare function consumes one known symbol, followed by a delimiter.
    # Powers/products/quotients require parentheses to disambiguate the argument.
    symbols = '|'.join(sorted(VARIABLES, key=lambda s: (-len(s), s)))
    return re.sub(r'\b(' + '|'.join(sorted(FUNCTIONS)) + r')\s+(' + symbols + r')(?=\s*(?:[+\-):,]|$))',
                  lambda m: f'{m.group(1)}({m.group(2)})', raw)


def constant_exponent(node: ast.AST) -> float | None:
    if isinstance(node, ast.Constant):
        try:
            return float(node.value) if isinstance(node.value, (int, float)) else None
        except OverflowError:
            return None
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = constant_exponent(node.operand)
        return None if value is None else (-value if isinstance(node.op, ast.USub) else value)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        left, right = constant_exponent(node.left), constant_exponent(node.right)
        return left / right if left is not None and right is not None and right != 0 else None
    return None


@lru_cache(maxsize=8192)
def validate_formula(formula: str, pair_distance: bool = False, source_coordinates: int = 0) -> ast.Expression:
    tree = ast.parse(formula.replace('^', '**'), mode='eval')
    nodes = list(ast.walk(tree))
    parents = {child: parent for parent in nodes for child in ast.iter_child_nodes(parent)}
    for node in nodes:
        if isinstance(node, (ast.Expression, ast.Load, ast.Add, ast.Sub, ast.Mult, ast.Div,
                             ast.Pow, ast.UAdd, ast.USub, ast.Constant)):
            if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
                raise ValueError('Invalid coordinate constant')
            continue
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            if isinstance(node.op, ast.Pow):
                exponent = constant_exponent(node.right)
                if exponent is None:
                    raise ValueError('Variable exponent')
                if not math.isfinite(exponent):
                    raise ValueError('Invalid exponent')
            continue
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            continue
        if isinstance(node, ast.Name) and (node.id in VARIABLES or node.id == 'd' and pair_distance
                                           or node.id in {'x','y','z'} and source_coordinates or
                                           node.id in {'u','v','w'} and source_coordinates == 2 or
                                           node.id in FUNCTIONS and isinstance(parents.get(node), ast.Call)
                                           and parents[node].func is node):
            continue
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS and len(node.args) == 1 and not node.keywords:
            continue
        raise ValueError('Unsupported coordinate syntax')
    return tree


@lru_cache(maxsize=8192)
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
            # Even powers do not change when a difference is reversed.
            exponent = constant_exponent(node.right) if isinstance(node.op, ast.Pow) else None
            if (exponent is not None and exponent.is_integer() and int(exponent) % 2 == 0
                    and isinstance(node.left, ast.BinOp) and isinstance(node.left.op, ast.Sub)):
                terms = tuple(sorted((canonical(node.left.left), canonical(node.left.right))))
                return ('EvenDifferencePower', terms, canonical(node.right))
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


@lru_cache(maxsize=8192)
def homogeneous_degree(formula: str, pair_distance: bool = False,
                       source_coordinates: int = 0, source_scale: int = 0) -> tuple[bool, float | None]:
    """Return scaling degree; None represents an identically zero literal."""
    dimensions = {**{name: 1 for name in ('a', 'b', 'c', 's', 'sa', 'sb', 'sc', 'r', 'R')},
                  **{name: 2 for name in ('S', 'SA', 'SB', 'SC', 'SW', 'E', 'F')},
                  **{name: 0 for name in ('A', 'B', 'C', 'pi')}}
    if pair_distance:
        dimensions['d'] = 1
    if source_coordinates:
        if source_scale:
            dimensions = dict.fromkeys(dimensions,0)
        dimensions.update(dict.fromkeys(('x','y','z'),1 if source_scale == 1 else 0))
        if source_coordinates == 2:
            dimensions.update(dict.fromkeys(('u','v','w'),1 if source_scale == 2 else 0))

    def degree(node: ast.AST) -> float | None:
        if isinstance(node, ast.Constant):
            return None if node.value == 0 else 0
        if isinstance(node, ast.Name):
            return dimensions[node.id]
        if isinstance(node, ast.UnaryOp):
            return degree(node.operand)
        if isinstance(node, ast.Call):
            value = degree(node.args[0])
            if node.func.id == 'abs':
                return value
            if node.func.id == 'sqrt':
                return None if value is None else value / 2
            if value not in (None, 0):
                raise ValueError('Dimensional function argument')
            return 0
        if isinstance(node, ast.BinOp):
            left = degree(node.left)
            if isinstance(node.op, ast.Pow):
                exponent = constant_exponent(node.right)
                if exponent is None:
                    raise ValueError('Variable exponent')
                return 0 if exponent == 0 else None if left is None else left * exponent
            right = degree(node.right)
            if isinstance(node.op, (ast.Add, ast.Sub)):
                if left is None: return right
                if right is None: return left
                if not math.isclose(left, right, abs_tol=1e-10):
                    raise ValueError('Inconsistent dimensions')
                return left
            if isinstance(node.op, ast.Mult):
                return None if left is None or right is None else left + right
            if isinstance(node.op, ast.Div):
                if right is None: raise ValueError('Division by zero')
                return None if left is None else left - right
        raise ValueError('Unsupported dimensional syntax')
    try:
        tree = (validate_formula(formula,source_coordinates=source_coordinates) if source_coordinates else
                validate_formula(formula,True) if pair_distance else validate_formula(formula))
        return True, degree(tree.body)
    except (ValueError, SyntaxError, KeyError, RecursionError, OverflowError):
        return False, None


def coordinate_candidates(fragment: str, text_lines: list[str] | None = None) -> list[tuple[str, str, str]]:
    lines: list[str] = []
    for line in (coordinate_text(fragment) if text_lines is None else text_lines):
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
        text = re.sub(r'^\s*=\s*', '', label.group(2))
        for next_line in lines[index+1:]:
            if LABEL.match(next_line) or re.match(r'^X\s*\(\d+\)', next_line, re.I):
                break
            if not text:
                text = next_line
            elif (not CYCLIC.search(text) and re.search(r'[fght]\s*\(\s*[aA]\s*,\s*[bB]\s*,\s*[cC]\s*\)', text)
                    and re.match(r'^\s*(?::|[fght]\s*\()', next_line, re.I)):
                text += ' ' + next_line
            elif re.search(r':\s*:', text) and re.match(r'^where\s+[A-Za-z](?:\d+)?(?:\s*\^\s*(?:2|\(2\)))?\s*=', next_line, re.I):
                text += (' ' if text.rstrip().endswith(',') else ', ') + next_line
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
        text = re.sub(r'\s+\([^()]*,\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}\)\s*$', '', text, flags=re.I)
        text = ATTRIBUTION.sub('', text)
        text = expand_cyclic_coordinate_calls(text)
        if re.search(r':\s*:.*\bwhere\b', text, re.I):
            text = re.sub(r'\s*:\s*:\s*$', '', text)
        text = expand_squared_locals(text)
        if text is None:
            continue
        text = expand_scalar_locals(text)
        if text is None:
            continue
        where = WHERE.search(text)
        if where and CYCLIC.search(text[:where.start()]):
            head = CYCLIC.search(text[:where.start()])
            if head and head.group(1).lower() == where.group(1).lower() and head.groups()[1:] == where.groups()[1:]:
                raw = text[where.end():].strip()
                inner = WHERE.search(raw)
                if inner:
                    definition = raw[inner.end():].strip()
                    inner_formula = normalize_formula(definition)
                    if inner_formula and raw[:inner.start()].rstrip().endswith(','):
                        call = re.compile(r'\b' + re.escape(inner.group(1)) + r'\s*\(\s*([abcABC])\s*,\s*([abcABC])\s*,\s*([abcABC])\s*\)', re.I)
                        def expand_call(match):
                            args = match.groups()
                            base = inner.groups()[1:]
                            if args not in (base, (base[1], base[2], base[0]), (base[2], base[0], base[1])):
                                return match.group()
                            return '(' + rotate_formula(inner_formula, (base, (base[1], base[2], base[0]), (base[2], base[0], base[1])).index(args)) + ')'
                        raw = call.sub(expand_call, raw[:inner.start()].rstrip()[:-1])
                formula = normalize_formula(raw)
                if formula:
                    barycentric = normalize_formula(f'a*({formula})') if trilinear else formula
                    if barycentric:
                        found.append(('B', barycentric, line))
            continue
        # Some entries print a full cyclic triple and then another empty : :.
        explicit_parts = text.split(':')
        if len(explicit_parts) == 5 and all(not value.strip() for value in explicit_parts[3:]):
            text = ':'.join(explicit_parts[:3])
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


def expand_squared_locals(text: str) -> str | None:
    """Expand an acyclic explicit root-definition graph, using nonnegative roots.

    Only squared declarations enable this grammar; ordinary local declarations
    keep their existing independent/cyclic rules. No abs of a radicand is added.
    """
    local=re.search(r'(?:,\s*)?\bwhere\s+(?=[A-Za-z](?:\d+)?\s*\^\s*(?:2|\(2\))\s*=)',text,re.I)
    if not local:return text
    prefix=text[:local.start()].rstrip(' ,')
    definition=re.sub(r'^,?\s*where\s+','',text[local.start():],flags=re.I)
    trailing=bool(re.search(r':\s*:\s*$',definition))
    definition=re.sub(r'\s*:\s*:\s*$','',definition).strip().removesuffix('.')
    pairs=re.split(r'\s*,\s*|\s+and\s+(?=[A-Za-z](?:\d+)?\s*(?:\^|=))',definition)
    definitions={}
    for pair in pairs:
        match=re.fullmatch(r'([A-Za-z](?:\d+)?)\s*(\^\s*(?:2|\(2\)))?\s*=\s*(.+)',pair)
        if not match or match[1] in definitions or match[1] in VARIABLES|FUNCTIONS|{'OH'}:
            return None
        definitions[match[1]]=(match[3],bool(match[2]))
    resolved={};active=set()
    def resolve(name):
        if name in resolved:return resolved[name]
        if name in active:raise ValueError('Cyclic local roots')
        active.add(name)
        raw,squared=definitions[name]
        raw=re.sub(r'\b[A-Za-z_][A-Za-z0-9_]*\b',
                   lambda hit:'('+resolve(hit[0])+')' if hit[0] in definitions else hit[0],raw)
        formula=normalize_formula('sqrt('+raw+')' if squared else raw)
        if formula is None:raise ValueError('Invalid local root')
        active.remove(name);resolved[name]=formula
        return formula
    try:
        for name in definitions:resolve(name)
    except (ValueError,RecursionError):return None
    if trailing and ':' not in prefix:prefix+=' : :'
    return re.sub(r'\b[A-Za-z_][A-Za-z0-9_]*\b',
                  lambda hit:'('+resolved[hit[0]]+')' if hit[0] in resolved else hit[0],prefix)


def normalize_scalar_definition(value: str) -> str | None:
    # Only an explicit definition binds this standard ABC length ratio.
    # Do not infer J in another entry just because this convention is common.
    if re.fullmatch(r'\s*\|OH\|\s*/\s*R\s*',value):
        value='sqrt(9-(a^2+b^2+c^2)/R^2)'
    return normalize_formula(value)


def expand_scalar_locals(text: str) -> str | None:
    """Expand explicit independent locals and explicitly declared cyclic triples."""
    ratio=re.search(r'(?:,\s*)?\bwhere\s+([A-Za-z])\s*:\s*([A-Za-z])\s*:\s*([A-Za-z])\s*=\s*([^:]+):([^:]+):([^:]+)\s*$',text,re.I)
    if ratio:
        names=ratio.groups()[:3];values=[normalize_formula(value.strip().removesuffix('.')) for value in ratio.groups()[3:]]
        if len(set(names))!=3 or set(names)&(VARIABLES|FUNCTIONS) or not all(values):
            return None
        if any(canonical_formula(rotate_formula(values[0],j))!=canonical_formula(values[j]) for j in (1,2)):
            return None
        substitutions=dict(zip(names,values));prefix=text[:ratio.start()].rstrip(' ,')
    else:
        local=re.search(r'(?:,\s*)?\bwhere\s+([A-Za-z])\s*=',text,re.I)
        if not local:
            return text
        prefix=text[:local.start()].rstrip(' ,');definition=text[local.start():]
        definition=re.sub(r'^,?\s*where\s+','',definition,flags=re.I)
        trailing=bool(re.search(r':\s*:\s*$',definition))
        definition=re.sub(r'\s*:\s*:\s*$','',definition).strip().removesuffix('.')
        cyclic=re.fullmatch(r'([A-Za-z])\s*=\s*(.+?)\s*,?\s*(?:and\s+)?([A-Za-z])\s+and\s+([A-Za-z])\s+are defined cyclically',definition,re.I)
        if cyclic:
            names=[cyclic[1],cyclic[3],cyclic[4]];first=normalize_formula(cyclic[2])
            if not first or len(set(names))!=3 or set(names)&(VARIABLES|FUNCTIONS):
                return None
            substitutions={name:rotate_formula(first,j) for j,name in enumerate(names)}
        else:
            pairs=re.split(r'\s*,\s*|\s+and\s+(?=[A-Za-z]\s*=)',definition)
            matches=[re.fullmatch(r'([A-Za-z])\s*=\s*(.+)',pair) for pair in pairs]
            if not 1<=len(matches)<=3 or not all(matches):
                return None
            substitutions={match[1]:normalize_scalar_definition(match[2]) for match in matches}
            if (len(substitutions)!=len(matches) or substitutions.keys()&(VARIABLES|FUNCTIONS)
                    or not all(substitutions.values())):
                return None
        if trailing and ':' not in prefix:
            prefix+=' : :'
    return re.sub(r'\b(?:'+'|'.join(map(re.escape,substitutions))+r')\b',
                  lambda hit:'('+substitutions[hit[0]]+')',prefix)


def expand_cyclic_coordinate_calls(text: str) -> str:
    """Expand one explicit local function in a coordinate expression, not prose."""
    where = WHERE.search(text)
    if not where or CYCLIC.search(text[:where.start()]):
        return text
    head = text[:where.start()].rstrip()
    if not re.search(r':\s*:\s*,\s*$', head):
        return text
    formula = normalize_formula(text[where.end():].strip())
    if formula is None:
        return text
    base = where.groups()[1:]
    rotations = [base, (base[1],base[2],base[0]), (base[2],base[0],base[1])]
    calls = re.compile(r'\b' + re.escape(where[1]) + r'\s*\(\s*([abcABC])\s*,\s*([abcABC])\s*,\s*([abcABC])\s*\)')
    matches = list(calls.finditer(head))
    if not matches or any(match.groups() not in rotations for match in matches):
        return text
    return calls.sub(lambda match: '(' + rotate_formula(formula,rotations.index(match.groups())) + ')', head[:-1])


@lru_cache(maxsize=8192)
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
            'r': area/s, 'R': a*b*c/(4*area), 'SW': (a*a+b*b+c*c)/2,
            'E': 4*(a*b*c/(4*area))**2, 'F': (a*a+b*b+c*c)/2-4*(a*b*c/(4*area))**2,
            'pi': math.pi}


def evaluate_formula(formula: str, values: dict[str, float]) -> float | None:
    tree = (validate_formula(formula,source_coordinates=2 if 'u' in values else 1) if 'x' in values else
            validate_formula(formula,True) if 'd' in values else validate_formula(formula))
    funcs = {'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
             'sinh': math.sinh, 'asinh': math.asinh, 'atan': math.atan, 'ln': math.log, 'abs': abs,
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
