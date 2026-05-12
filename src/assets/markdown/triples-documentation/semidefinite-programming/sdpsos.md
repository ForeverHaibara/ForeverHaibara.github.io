# SDPSOS

The `SDPSOS` function is a shortcut for the `sum_of_squares` function that
uses only semidefinite programming to solve inequalities.

## Function Signature

```python
def SDPSOS(
    expr: "Expr",
    ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    *,
    symmetry: Optional["PermutationGroup"] = None,
    roots: Optional[List["Root"]] = None,
    lift_degree_limit: int = 2,
    wedderburn: bool = True,
    dof_limit: int = 7000,
    solver: Optional[str] = None,
    allow_numer: int = 0,
    solve_kwargs: Dict[str, Any] = {},
    ineq_constraints_with_trivial: bool = True,
    preordering: str = 'linear-progressive',
    unstable_eig_threshold: float = -0.1,
    verbose: bool = False,
    time_limit: float = 3600.,
) -> Optional[Solution]:
```

## Parameters

<dl>
  <dt><code>expr: Expr</code></dt>
  <dd>The expression to perform SOS on.</dd>

  <dt><code>ineq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code></dt>
  <dd>
    Inequality constraints to the problem. This assumes g_1(x) >= 0, g_2(x) >= 0, ...
  </dd>

  <dt><code>eq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code></dt>
  <dd>
    Equality constraints to the problem. This assumes h_1(x) = 0, h_2(x) = 0, ...
  </dd>

  <dt><code>symmetry: Optional[PermutationGroup]</code></dt>
  <dd>CURRENTLY UNUSED.</dd>

  <dt><code>roots: Optional[List[Root]]</code></dt>
  <dd>
    The roots of the polynomial satisfying constraints. When it is None, it will be automatically generated.
  </dd>

  <dt><code>lift_degree_limit: int</code> (default: <code>2</code>)</dt>
  <dd>The maximum lift degree to explore.</dd>

  <dt><code>wedderburn: bool</code> (default: <code>True</code>)</dt>
  <dd>Use wedderburn decomposition.</dd>

  <dt><code>dof_limit: int</code> (default: <code>7000</code>)</dt>
  <dd>
    The maximum degree of freedom of the SDP. When it exceeds <code>dof_limit</code>,
    the node will be pruned. This prevents crash in external SDP solvers.
  </dd>

  <dt><code>solver: Optional[str]</code> (default: <code>None</code>)</dt>
  <dd>
    The numerical SDP solver to use. When set to None, it is automatically selected.
  </dd>

  <dt><code>allow_numer: int</code></dt>
  <dd>
    Whether to allow inexact numerical solution. This is useful when it fails to obtain an
    exact solution by rationalization.
  </dd>

  <dt><code>ineq_constraints_with_trivial: bool</code> (default: <code>True</code>)</dt>
  <dd>
    Whether to add the trivial inequality constraint 1 >= 0. This is used to generate the
    quadratic module.
  </dd>

  <dt><code>preordering: str</code> (default: <code>'linear-progressive'</code>)</dt>
  <dd>
    The preordering method for extending the generators of the quadratic module. It can be
    'none', 'linear', 'linear-progressive'.
  </dd>

  <dt><code>unstable_eig_threshold: float</code> (default: <code>-0.1</code>)</dt>
  <dd>
    If it fails to rationalize but the smallest eigenvalue of the SDP is larger than
    <code>unstable_eig_threshold</code>, then it considers the problem as numerically unstable
    and stops further search.
  </dd>

  <dt><code>verbose: bool</code> (default: <code>False</code>)</dt>
  <dd>Whether to print the progress.</dd>

  <dt><code>time_limit: float</code> (default: <code>3600.</code>)</dt>
  <dd>The time limit (in seconds) for the solver.</dd>
</dl>