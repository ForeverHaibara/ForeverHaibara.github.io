# LinearSOS

The `LinearSOS` function is a shortcut for the `sum_of_squares` function that uses only linear programming to solve inequalities.

## Function Signature

```python
def LinearSOS(
    expr: "Expr",
    ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    *,
    symmetry: Optional["PermutationGroup"] = None,
    roots: Optional[List[Root]] = None,
    tangents: Optional[List["Expr"]] = None,
    basis_limit: int = 20000,
    lift_degree_limit: int = 4,
    wedderburn: bool = True,
    quad_diff_order: int = 8,
    preordering: str = 'quadratic',
    augment_tangents: bool = True,
    centralize: bool = True,
    linprog_options: Dict = LINPROG_OPTIONS,
    linprog_time_limit: float = 300.0,
    allow_numer: int = 0,
    verbose: bool = False,
    time_limit: float = 3600.0
) -> Optional[Solution]:
```

## Examples

LinearSOS uses linear programming to solve inequality problems.

```python
>>> from triples import LinearSOS
>>> from sympy.abc import a, b, c
>>> sol = LinearSOS(a**5*(a-b)+b**5*(b-c)+c**5*(c-a), [a,b,c])
>>> sol.solution # doctest: +SKIP
(Σ(a**2*(a**2 - b*c)**2))/6 + (Σ((a - c)**2*(6*a**3*c + 6*a**2*c**2
 + 3*a**2*(a - b)**2 + (a - b)**2*(b - c)**2)))/18 + 2*(Σ(a**2*(a - b)**2*(a**2 + a*b)))/3
```

The parameter `lift_degree_limit` controls the maximum lift degree to explore.

```python
>>> sol = LinearSOS(3 - (a+b+c)**2, [a**2-1, b**2-1, c**2-1], [a+b+c+1/a+1/b+1/c],
... lift_degree_limit=6)
>>> sol.solution # doctest: +SKIP
(a*b*c*(a + b + c + 1/c + 1/b + 1/a)*(Σ(-3*a*b*c**2 + 3*a*b - 2))
 + 3*(Σ((a**2 + 1)*(b**2 - 1)*(c**2 - 1))))/(Σ(a**2*b**2*c**2 + 1))
```

LinearSOS has complexity issues for high-dimensional problems.

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

  <dt><code>symmetry: Optional["PermutationGroup"] (default: <code>None</code>)</code></dt>
  <dd>
    CURRENTLY UNUSED.
  </dd>

  <dt><code>roots: Optional[List[Root]] (default: <code>None</code>)</code></dt>
  <dd>
    Equality cases of the inequality. If None, it will be searched automatically. To disable auto search, pass in an empty list.
  </dd>

  <dt><code>tangents: Optional[List["Expr"]] (default: <code>None</code>)</code></dt>
  <dd>
    CURRENTLY UNUSED.
  </dd>

  <dt><code>basis_limit: int (default: <code>20000</code>)</code></dt>
  <dd>
    The limit of the basis. When the basis exceeds the limit, the solver stops and returns None. Defaults to 20000.
  </dd>

  <dt><code>lift_degree_limit: int (default: <code>4</code>)</code></dt>
  <dd>
    The maximum degree to lift the polynomial. Defaults to 4.
  </dd>

  <dt><code>wedderburn: bool (default: <code>True</code>)</code></dt>
  <dd>
    Whether to use the wedderburn decomposition. Defaults to True.
  </dd>

  <dt><code>quad_diff_order: int (default: <code>8</code>)</code></dt>
  <dd>
    The maximum degree of the form (xi - xj)^(2k)*... in the basis. Defaults to 8.
  </dd>

  <dt><code>preordering: str (default: <code>'quadratic'</code>)</code></dt>
  <dd>
    The preordering method for extending the basis. It can be 'none', 'linear', 'quadratic' or 'full'. Defaults to 'quadratic'.
  </dd>

  <dt><code>augment_tangents: bool (default: <code>True</code>)</code></dt>
  <dd>
    Whether to augment the tangents using heuristic methods. Defaults to True.
  </dd>

  <dt><code>centralize: bool (default: <code>True</code>)</code></dt>
  <dd>
    Whether to centralize the problem so that there is a root at (1,1,...,1) if possible. This improves stability. Defaults to True.
  </dd>

  <dt><code>linprog_options: Dict (default: <code>LINPROG_OPTIONS</code>)</code></dt>
  <dd>
    Options for scipy.optimize.linprog. Defaultedly use <code>{'method': 'highs-ds', 'options': {'presolve': False}}</code>. Note that interiorpoint oftentimes does not provide exact rational solution. Both 'highs-ds' or 'simplex' are recommended, yet the former is slightly faster. Moreover, using <code>presolve == True</code> has a bug solving <code>s((b2-a2+3c2+ab+7bc-5ca)(a2-b2-ab+2bc-ca)2)</code>: Assertion failed: abs_value < pivot_tolerance, file ../../scipy/_lib/highs/src/util/HFactor.cpp, line 1474. Thus, for stability, we use <code>presolve == False</code> by default. However, setting it to True could be slightly faster.
  </dd>

  <dt><code>linprog_time_limit: float (default: <code>300.0</code>)</code></dt>
  <dd>
    The time limit for linear programming in seconds. Defaults to 300.0. Since the simplex method runs in exponential time in the worst case, this prevents the solver from running too long.
  </dd>

  <dt><code>allow_numer: int (default: <code>0</code>)</code></dt>
  <dd>
    Whether to allow numerical solution. When it is 0, the solution must be exact. When > 0, the solution can be numerical, this might be useful for large scale problems or irrational problems. TODO: Allow tolerance?
  </dd>

  <dt><code>verbose: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to print the information of the linear programming problem. Defaults to False.
  </dd>

  <dt><code>time_limit: float (default: <code>3600.0</code>)</code></dt>
  <dd>
    The time limit (in seconds) for the solver. Defaults to 3600. When the time limit is reached, the solver is killed when it returns to the main loop. However, it might not be killed instantly if it is stuck in an internal function.
  </dd>

</dl>

## Returns

**`Optional[Solution]`**

solution: Optional[Solution] The solution of the linear programming SOS. When solution is None, it means that the linear programming SOS fails.