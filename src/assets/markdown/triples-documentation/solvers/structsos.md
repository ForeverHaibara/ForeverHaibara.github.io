# StructuralSOS

The `StructuralSOS` function is a rule-based expert system to solve polynomial
inequalities in specific structures. Most algorithms run in O(1) or linear time.

## Function Signature

```python
def StructuralSOS(
    expr: "Expr",
    ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    *,
    verbose: Union[bool, int] = False,
    raise_exception: bool = False
) -> Optional["Solution"]:
```

## Parameters

<dl>
  <dt><code>expr: "Expr"</code></dt>
  <dd>
    The expression to perform SOS on.
  </dd>

  <dt><code>ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] (default: <code>{}</code>)</code></dt>
  <dd>
    Inequality constraints to the problem. This assumes g_1(x) >= 0, g_2(x) >= 0, ...
  </dd>

  <dt><code>eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] (default: <code>{}</code>)</code></dt>
  <dd>
    Equality constraints to the problem. This assumes h_1(x) = 0, h_2(x) = 0, ...
  </dd>

  <dt><code>verbose: Union[bool, int] (default: <code>False</code>)</code></dt>
  <dd>
    Whether to print verbose information.
  </dd>

  <dt><code>raise_exception: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to raise exception when an error occurs. Set to True for debug purpose. Experimental.
  </dd>

</dl>

## Returns

**`Optional["Solution"]`**

solution: Solution