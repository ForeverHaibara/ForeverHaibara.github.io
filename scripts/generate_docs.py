#!/usr/bin/env python
"""
generate_docs.py - Auto-generate API markdown docs from triples source code.

Reads a TOML config file that describes which functions / classes to document,
extracts their docstrings and signatures from the source, and writes markdown
files into the workspace.

Usage:
    python scripts/generate_docs.py                       # generate all
    python scripts/generate_docs.py --target sum_of_squares  # generate one entry
"""

import ast
import os
import re
import sys
import textwrap
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

# ---------------------------------------------------------------------------
# TOML parsing (Python >= 3.11 has tomllib; for older versions fall back to
# a minimal hand-rolled parser that covers the subset we use).
# ---------------------------------------------------------------------------

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:
    try:
        import tomli as tomllib  # pip install tomli
    except ModuleNotFoundError:
        tomllib = None


def _parse_toml(path: str) -> dict:
    """Parse TOML config file."""
    if tomllib is not None:
        with open(path, "rb") as f:
            return tomllib.load(f)

    # Fallback: hand-rolled parser for the subset we need.
    data: dict = {"source": {}, "docs": []}
    current_doc: Optional[dict] = None
    multiline_key: Optional[str] = None
    multiline_lines: List[str] = []
    multiline_indent: int = 0

    def _strip_comment(line: str) -> str:
        in_str = False
        quote_char = ""
        for i, ch in enumerate(line):
            if in_str:
                if ch == quote_char and (i + 1 >= len(line) or line[i + 1] != quote_char):
                    in_str = False
                continue
            if ch in ('"', "'"):
                in_str = True
                quote_char = ch
            elif ch == "#":
                return line[:i].rstrip()
        return line

    def _parse_value(s: str) -> Any:
        s = s.strip()
        if s.startswith('"""') and s.endswith('"""') and len(s) >= 6:
            return s[3:-3]
        if s.startswith('"') and s.endswith('"'):
            return s[1:-1].replace("\\n", "\n").replace("\\\\", "\\")
        if s.startswith("'") and s.endswith("'"):
            return s[1:-1]
        if s.lower() == "true":
            return True
        if s.lower() == "false":
            return False
        return s

    def _flush_multiline() -> None:
        nonlocal multiline_key, multiline_lines
        if multiline_key is not None:
            value = textwrap.dedent("\n".join(multiline_lines)).strip()
            if current_doc is not None:
                current_doc[multiline_key] = value
            else:
                data["source"][multiline_key] = value
            multiline_key = None
            multiline_lines = []

    def _add_doc() -> None:
        nonlocal current_doc
        if current_doc is not None:
            data["docs"].append(current_doc)

    with open(path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    for raw_line in raw_lines:
        line = raw_line.rstrip("\n")

        # Inside a triple-quoted multiline value
        if multiline_key is not None:
            stripped = line.lstrip()
            if '"""' in stripped:
                idx = stripped.index('"""')
                before = stripped[:idx]
                if before.strip():
                    multiline_lines.append(before)
                _flush_multiline()
                continue
            else:
                if not multiline_lines:
                    if stripped:
                        multiline_indent = len(line) - len(stripped)
                multiline_lines.append(line[multiline_indent:] if stripped else "")
                continue

        stripped = _strip_comment(line).strip()
        if not stripped:
            continue

        if stripped.startswith("[[docs]]"):
            _flush_multiline()
            _add_doc()
            current_doc = {}
            continue

        if stripped.startswith("["):
            _flush_multiline()
            continue

        if "=" in stripped:
            _flush_multiline()
            key, _, val = stripped.partition("=")
            key = key.strip()
            val = val.strip()

            if val.startswith('"""') and not val.endswith('"""'):
                multiline_key = key
                multiline_lines = []
                after = val[3:]
                if after.strip():
                    multiline_lines.append(after)
                continue

            parsed = _parse_value(val)
            if current_doc is not None:
                current_doc[key] = parsed
            else:
                data["source"][key] = parsed

    _flush_multiline()
    _add_doc()
    return data


# ---------------------------------------------------------------------------
# Source code parsing helpers
# ---------------------------------------------------------------------------

@dataclass
class ParamInfo:
    """Information about a single function parameter."""
    name: str
    annotation: str = ""
    default: Optional[str] = None


@dataclass
class DocEntry:
    """Extracted information from a single function / class."""
    name: str
    type: str  # "function" or "class"
    docstring: str = ""
    signature: str = ""
    params: List[ParamInfo] = field(default_factory=list)
    returns: str = ""
    # Sections parsed from docstring
    examples_text: str = ""
    notes_text: str = ""  # everything before Parameters/Examples
    param_docs: Dict[str, str] = field(default_factory=dict)
    return_doc: str = ""


def _find_source_file(source_dir: str, module: str, name: str,
                      explicit_file: Optional[str] = None) -> Optional[str]:
    """Locate the .py file for a given dotted module path."""
    if explicit_file:
        p = os.path.join(source_dir, explicit_file)
        return p if os.path.isfile(p) else None

    parts = module.split(".")
    py_path = os.path.join(source_dir, *parts) + ".py"
    if os.path.isfile(py_path):
        return py_path

    pkg_path = os.path.join(source_dir, *parts, "__init__.py")
    if os.path.isfile(pkg_path):
        return pkg_path

    return None


def _parse_source(filepath: str, name: str, entry_type: str) -> Optional[DocEntry]:
    """Parse a Python source file and extract the requested function / class."""
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()

    tree = ast.parse(source)

    if entry_type == "function":
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == name:
                return _extract_function(node, source)
    elif entry_type == "class":
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == name:
                return _extract_class(node, source)

    return None


def _get_decorator_source(source: str, node: ast.AST) -> str:
    """Extract decorator lines before a function / class definition."""
    lines = source.split("\n")
    start = node.lineno - 1
    deco_start = start
    for i in range(start - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped.startswith("@"):
            deco_start = i
        elif stripped == "" and i > 0:
            prev_stripped = lines[i - 1].strip()
            if prev_stripped.startswith("@") or (prev_stripped == "" and i > 1):
                deco_start = i
                continue
            break
        else:
            break
    if deco_start < start:
        return "\n".join(lines[deco_start:start]) + "\n"
    return ""


def _annotate_str(annotation: ast.expr) -> str:
    """Convert annotation AST to source string with normalized double quotes."""
    return ast.unparse(annotation).replace("'", '"')


def _extract_function(node: ast.FunctionDef, source: str) -> DocEntry:
    """Extract function signature, docstring, and parameter info."""
    entry = DocEntry(name=node.name, type="function")

    # Build the signature
    deco_src = _get_decorator_source(source, node)
    sig = _build_function_signature(node)
    entry.signature = deco_src + sig

    # Extract docstring
    if (node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)):
        entry.docstring = node.body[0].value.value

    # Extract parameters
    for arg in node.args.args:
        param = ParamInfo(name=arg.arg)
        if arg.annotation:
            param.annotation = _annotate_str(arg.annotation)
        entry.params.append(param)

    for arg in node.args.kwonlyargs:
        param = ParamInfo(name=arg.arg)
        if arg.annotation:
            param.annotation = _annotate_str(arg.annotation)
        entry.params.append(param)

    # Collect defaults
    defaults: Dict[str, str] = {}
    pos_count = len(node.args.args)
    pos_def_count = len(node.args.defaults)
    for i in range(pos_def_count):
        arg_name = node.args.args[pos_count - pos_def_count + i].arg
        defaults[arg_name] = ast.unparse(node.args.defaults[i])

    for i, arg in enumerate(node.args.kwonlyargs):
        if i < len(node.args.kw_defaults) and node.args.kw_defaults[i] is not None:
            defaults[arg.arg] = ast.unparse(node.args.kw_defaults[i])

    for p in entry.params:
        if p.name in defaults:
            p.default = defaults[p.name]

    # Return annotation
    if node.returns:
        entry.returns = _annotate_str(node.returns)

    # Parse docstring sections
    _parse_docstring_sections(entry)

    return entry


def _build_function_signature(node: ast.FunctionDef) -> str:
    """Build a multi-line formatted Python function signature string from AST."""
    args = node.args

    # Build per-param strings with annotations
    posonly: List[str] = []
    for arg in args.posonlyargs:
        s = arg.arg
        if arg.annotation:
            s += f": {_annotate_str(arg.annotation)}"
        posonly.append(s)

    regular: List[str] = []
    for arg in args.args:
        s = arg.arg
        if arg.annotation:
            s += f": {_annotate_str(arg.annotation)}"
        regular.append(s)

    # Add positional defaults (right-aligned)
    num_defaults = len(args.defaults)
    for i in range(num_defaults):
        idx = len(regular) - num_defaults + i
        regular[idx] += f" = {ast.unparse(args.defaults[i])}"

    kwonly: List[str] = []
    for i, arg in enumerate(args.kwonlyargs):
        s = arg.arg
        if arg.annotation:
            s += f": {_annotate_str(arg.annotation)}"
        if i < len(args.kw_defaults) and args.kw_defaults[i] is not None:
            s += f" = {ast.unparse(args.kw_defaults[i])}"
        kwonly.append(s)

    # Collect all parameter strings
    param_strs: List[str] = []
    if posonly:
        param_strs.extend(posonly)
        param_strs.append("/")

    # Star separator
    has_kwonly = bool(args.kwonlyargs)
    param_strs.extend(regular)
    if has_kwonly and not args.vararg:
        param_strs.append("*")

    if args.vararg:
        s = f"*{args.vararg.arg}"
        if args.vararg.annotation:
            s += f": {_annotate_str(args.vararg.annotation)}"
        param_strs.append(s)

    param_strs.extend(kwonly)

    if args.kwarg:
        s = f"**{args.kwarg.arg}"
        if args.kwarg.annotation:
            s += f": {_annotate_str(args.kwarg.annotation)}"
        param_strs.append(s)

    # Format as multi-line signature
    ret = f" -> {_annotate_str(node.returns)}" if node.returns else ""
    sig = f"def {node.name}(\n"
    indent = "    "
    for i, p in enumerate(param_strs):
        comma = "," if i < len(param_strs) - 1 else ""
        sig += f"{indent}{p}{comma}\n"
    sig += f"){ret}:"
    return sig


def _extract_class(node: ast.ClassDef, source: str) -> DocEntry:
    """Extract class definition (placeholder for class doc generation)."""
    entry = DocEntry(name=node.name, type="class")

    deco_src = _get_decorator_source(source, node)
    entry.signature = deco_src + f"class {node.name}:"

    if (node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)):
        entry.docstring = node.body[0].value.value

    _parse_docstring_sections(entry)
    return entry


# ---------------------------------------------------------------------------
# Docstring section parsing (NumPy-style)
# ---------------------------------------------------------------------------

def _parse_docstring_sections(entry: DocEntry) -> None:
    """Parse docstring into sections: Examples, Parameters, Returns, etc."""
    doc = entry.docstring
    if not doc:
        return

    doc = textwrap.dedent(doc).strip()

    # NumPy-style section headers (optionally underlined with dashes)
    section_pattern = re.compile(
        r"^(Examples|Parameters|Returns|See Also|Notes|References|Warnings|Raises)\s*\n"
        r"(?:-{3,}\n)?",
        re.MULTILINE,
    )

    sections: Dict[str, str] = {}
    matches = list(section_pattern.finditer(doc))

    if not matches:
        entry.notes_text = doc
        return

    # Preamble = text before the first section header
    preamble = doc[:matches[0].start()].strip()
    entry.notes_text = preamble

    for i, m in enumerate(matches):
        section_name = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(doc)
        sections[section_name] = doc[start:end].strip()

    entry.examples_text = sections.get("Examples", "")

    param_text = sections.get("Parameters", "")
    if param_text:
        entry.param_docs = _parse_param_docs(param_text)

    return_text = sections.get("Returns", "")
    if return_text:
        entry.return_doc = return_text


def _parse_param_docs(param_text: str) -> Dict[str, str]:
    """Parse NumPy-style parameter docs into a {name: description} dict."""
    result: Dict[str, str] = {}
    # Match:  name: type\n    description (4+ space indent)
    pattern = re.compile(
        r"^(\w+)\s*(?::\s*([^\n]+))?\n((?:\s{4,}.+(?:\n|$))+)",
        re.MULTILINE,
    )
    for m in pattern.finditer(param_text):
        name = m.group(1).strip()
        desc = textwrap.dedent(m.group(3)).strip()
        result[name] = desc
    return result


# ---------------------------------------------------------------------------
# Markdown generation
# ---------------------------------------------------------------------------

def _escape_html(text: str) -> str:
    """Escape HTML special characters for safe embedding."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _backticks_to_code(text: str) -> str:
    """Convert paired backtick spans in text to <code>...</code> tags."""
    result: List[str] = []
    i = 0
    while i < len(text):
        if text[i] == "`":
            # find the matching closing backtick
            j = text.index("`", i + 1) if "`" in text[i + 1:] else len(text)
            if j < len(text):
                inner = _escape_html(text[i + 1 : j])
                result.append(f"<code>{inner}</code>")
                i = j + 1
            else:
                result.append(_escape_html("`"))
                i += 1
        else:
            result.append(text[i])
            i += 1
    return "".join(result)


def _format_parameters_dl(entry: DocEntry) -> str:
    """Format Parameters section using <dl>/<dt>/<dd>, matching existing docs."""
    if not entry.params:
        return ""

    lines = ["## Parameters", "", "<dl>"]

    for param in entry.params:
        # Build <dt> content (HTML-safe, with <code> for name:type)
        type_str = _escape_html(param.annotation) if param.annotation else ""
        dt_text = f"{param.name}: {type_str}" if type_str else param.name

        # Add default value with its own <code> tag
        if param.default is not None:
            default_html = f"<code>{_escape_html(param.default)}</code>"
            dt_text += f" (default: {default_html})"

        lines.append(f"  <dt><code>{dt_text}</code></dt>")

        # Description from docstring
        desc = entry.param_docs.get(param.name, "")

        if desc:
            # Convert backticks in description to <code> tags
            desc_html = _backticks_to_code(desc)
            # Collapse multi-line descriptions into a single paragraph
            desc_html = " ".join(desc_html.split())
            # Preserve <br> tags and block-level structure if needed
            if "<br>" in desc_html:
                lines.append(f"  <dd>\n    {desc_html}\n  </dd>")
            else:
                lines.append(f"  <dd>")
                lines.append(f"    {desc_html}")
                lines.append(f"  </dd>")
        else:
            lines.append(f"  <dd>")
            lines.append(f"    <!-- TODO: add description -->")
            lines.append(f"  </dd>")

        lines.append("")  # blank line between entries

    lines.append("</dl>")
    return "\n".join(lines)


def _format_returns_section(entry: DocEntry) -> str:
    """Format Returns section."""
    if not entry.returns:
        return ""

    return_type = _escape_html(entry.returns.strip())
    lines = ["## Returns", "", f"**`{return_type}`**", ""]

    # Use docstring return description if available
    if entry.return_doc:
        ret_desc = " ".join(entry.return_doc.split())
        ret_desc = _backticks_to_code(ret_desc)
        lines.append(ret_desc)
    else:
        lines.append(f"Returns a `{return_type}` object.")

    return "\n".join(lines)


def _format_examples_section(examples_text: str) -> str:
    """Format Examples section from docstring into markdown with code blocks."""
    if not examples_text:
        return ""

    lines = ["## Examples", ""]

    # Split by subsection headers (### ...)
    parts = re.split(r"(^###.+$)", examples_text, flags=re.MULTILINE)

    for part in parts:
        stripped = part.strip()
        if not stripped:
            continue

        if stripped.startswith("### "):
            lines.append(stripped)
            lines.append("")
        else:
            blocks = _split_prose_and_code(part)
            for block in blocks:
                lines.append(block)
                lines.append("")

    # Remove trailing blank lines
    while lines and lines[-1].strip() == "":
        lines.pop()
    return "\n".join(lines)


def _split_prose_and_code(text: str) -> List[str]:
    """Split text into prose paragraphs and ```python``` code blocks.

    Paragraphs are separated by blank lines.  A paragraph that contains any
    ``>>>`` or ``...`` line is treated as code; otherwise it is prose.
    Consecutive code paragraphs are merged into a single code block (blank
    lines between them are preserved inside the block).  Consecutive prose
    paragraphs are merged into one prose paragraph.
    """
    lines = text.strip().split("\n")

    # 1. Split into paragraphs separated by blank lines.
    paragraphs: List[List[str]] = []
    current: List[str] = []
    for line in lines:
        if line.strip() == "":
            if current:
                paragraphs.append(current)
                current = []
        else:
            current.append(line)
    if current:
        paragraphs.append(current)

    # 2. Classify each paragraph.
    is_code = [
        any(
            ln.strip().startswith(">>> ") or ln.strip().startswith("... ")
            for ln in para
        )
        for para in paragraphs
    ]

    # 3. Merge consecutive paragraphs of the same type.
    result: List[str] = []
    i = 0
    while i < len(paragraphs):
        merged: List[str] = []
        code = is_code[i]
        while i < len(paragraphs) and is_code[i] == code:
            if merged:
                merged.append("")  # preserve blank line between merged paragraphs
            merged.extend(paragraphs[i])
            i += 1

        if code:
            code_text = textwrap.dedent("\n".join(merged)).strip()
            result.append(f"```python\n{code_text}\n```")
        else:
            prose_text = " ".join(ln.strip() for ln in merged if ln.strip())
            if prose_text:
                result.append(prose_text)

    # 4. Collapse runs of blank lines into a single blank line and drop trailing blanks.
    output: List[str] = []
    prev_blank = False
    for item in result:
        blank = item.strip() == ""
        if blank and prev_blank:
            continue
        output.append(item)
        prev_blank = blank
    while output and output[-1].strip() == "":
        output.pop()

    return output


def generate_markdown(entry: DocEntry, title: str, introduction: str) -> str:
    """Generate a complete markdown document for a function / class."""
    md_parts: List[str] = []

    # --- Title ---
    md_parts.append(f"# {title}")
    md_parts.append("")

    # --- Introduction ---
    if introduction:
        md_parts.append(introduction)
    md_parts.append("")

    # --- Function / Class Signature ---
    section_label = "Function Signature" if entry.type == "function" else "Class Definition"
    md_parts.append(f"## {section_label}")
    md_parts.append("")
    md_parts.append("```python")
    md_parts.append(entry.signature.strip())
    md_parts.append("```")
    md_parts.append("")

    # --- Examples ---
    if entry.examples_text:
        examples_md = _format_examples_section(entry.examples_text)
        if examples_md:
            md_parts.append(examples_md)
            md_parts.append("")

    # --- Parameters ---
    params_md = _format_parameters_dl(entry)
    if params_md:
        md_parts.append(params_md)
        md_parts.append("")

    # --- Returns ---
    if entry.returns and entry.type == "function":
        returns_md = _format_returns_section(entry)
        if returns_md:
            md_parts.append(returns_md)
            md_parts.append("")

    # Clean up trailing blank lines and internal excessive blanks
    while md_parts and md_parts[-1] == "":
        md_parts.pop()

    md_text = "\n".join(md_parts)
    # Collapse 3+ consecutive blank lines into 2
    md_text = re.sub(r"\n{3,}", "\n\n", md_text)
    return md_text


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.dirname(script_dir)
    config_path = os.path.join(workspace_root, "doc_config.toml")

    # CLI argument parsing
    target_filter = None
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--config" and i + 1 < len(args):
            config_path = args[i + 1]
            i += 2
            continue
        elif not args[i].startswith("--"):
            target_filter = args[i]
        i += 1

    if not os.path.isfile(config_path):
        print(f"Error: config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    config = _parse_toml(config_path)
    source_dir = config.get("source", {}).get("directory", "")
    if not source_dir or not os.path.isdir(source_dir):
        print(f"Error: source directory not found: {source_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Source directory: {source_dir}")
    print(f"Workspace root:   {workspace_root}")
    print(f"Config file:      {config_path}")
    print()

    docs_config = config.get("docs", [])

    for doc_cfg in docs_config:
        name = doc_cfg.get("name", "")
        entry_type = doc_cfg.get("type", "function")
        module = doc_cfg.get("module", "")
        title = doc_cfg.get("title", name)
        introduction = doc_cfg.get("introduction", "")
        output_rel = doc_cfg.get("output", "")
        source_file = doc_cfg.get("source_file", None)

        # Filter by --target
        if target_filter and target_filter.lower() not in name.lower():
            continue

        print(f"Processing: {name} ({entry_type}) from {module}")

        filepath = _find_source_file(source_dir, module, name, source_file)
        if not filepath:
            print(f"  WARNING: source file not found for {module}.{name}", file=sys.stderr)
            continue

        print(f"  Source: {filepath}")

        entry = _parse_source(filepath, name, entry_type)
        if not entry:
            print(f"  WARNING: {entry_type} '{name}' not found in {filepath}", file=sys.stderr)
            continue

        md = generate_markdown(entry, title, introduction)

        output_path = os.path.join(workspace_root, output_rel)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md)

        print(f"  Output: {output_path}")
        print()

    print("Done.")


if __name__ == "__main__":
    main()
