# SDPProblem

The `SDPProblem` class represents a dual semidefinite programming problem. It
provides constructors for common SDP representations, access to problem
variables and matrix blocks, numerical solving, and structural transformations.

## Class Definition

```python
class SDPProblem(TransformableDual):
```

## Attributes

<dl>
  <dt><code>is_dual (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>is_primal (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>_x0_and_space: Dict[Any, Tuple[Matrix, Matrix]]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>size: Dict[Any, int]</code></dt>
  <dd>
    size : Dict[Any, int] The size of the SDP problem.
  </dd>

  <dt><code>free_symbols: List[Symbol]</code></dt>
  <dd>
    free_symbols : List[Symbol] The free symbols of the SDP problem.
  </dd>

  <dt><code>gens: List[Symbol]</code></dt>
  <dd>
    gens : List[Symbol] The variables of the SDP problem.
  </dd>

  <dt><code>dof: int</code></dt>
  <dd>
    dof : int The degree of freedom of the SDP problem.
  </dd>

  <dt><code>_free_symbols_in_domain</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>_gens</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>y</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>S</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>decompositions</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

## Methods

### <span data-api-method-heading="true"><code>&#95;&#95;init&#95;&#95;</code></span>

```python
def __init__(
    self,
    x0_and_space: Union[Dict[str, Tuple[Matrix, Matrix]], List[Tuple[Matrix, Matrix]]],
    gens: Optional[Union[List[Symbol], Tuple[Symbol, ...]]] = None
):
```

#### Parameters

<dl>
  <dt><code>x0_and_space: Union[Dict[str, Tuple[Matrix, Matrix]], List[Tuple[Matrix, Matrix]]]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>gens: Optional[Union[List[Symbol], Tuple[Symbol, ...]]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>keys</code></span>

```python
def keys(
    self,
    filter_none: bool = False
) -> List[Any]:
```

Get the keys of the SDP problem.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import a, b
>>> sdp = SDPProblem.from_matrix(Matrix([[a+1+b, 1+b], [1+b, 2-a]]))
>>> sdp.keys()
[0]
>>> sdp = SDPProblem.from_matrix({'S1': Matrix([[a,b],[b,a]]), 'S2': Matrix([[b,a],[a,b]]), 'S3': Matrix([])})
>>> sdp.keys()
['S1', 'S2', 'S3']
>>> sdp.keys(filter_none=True)
['S1', 'S2']
```

#### Parameters

<dl>
  <dt><code>filter_none: bool (default: <code>False</code>)</code></dt>
  <dd>
    If True, filter out the keys with size 0, by default False.
  </dd>

</dl>

#### Returns

**`List[Any]`**

keys : List[Any] The keys of the SDP problem.

---

### <span data-api-method-heading="true"><code>from&#95;full&#95;x0&#95;and&#95;space</code></span>

```python
@classmethod
def from_full_x0_and_space(
    cls,
    x0: Matrix,
    space: Matrix,
    splits: Union[Dict[Any, int], List[int]],
    gens: Optional[Tuple[Symbol, ...]] = None,
    constrain_symmetry: bool = False
) -> "SDPProblem":
```

Initialize a SDP problem with the compressed x0 and space matrix.

#### Examples

Consider a SDP problem with 3 positive semidefinite matrices: vec(S1) = [[1,0]] @ [x,y] + [-1] vec(S2) = [[1,1]] @ [x,y] + [-2] vec(S3) = [[0,5],[0,-2],[0,-2],[0,6]] @ [x,y] + [-3,0,0,-4] Together they can be concatenated into a single x0 and space:

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y
>>> x0 = Matrix([-1,-2,-3,0,0,-4])
>>> space = Matrix([[1,0], [1,1], [0,5],[0,-2],[0,-2],[0,6]])
```

To initialize the SDP for S1,S2,S3 >> 0, use `splits = [1,1,2]` to indicate the dimension of each matrix. A dictionary is also accepted to contain the names of each matrix.

```python
>>> sdp = SDPProblem.from_full_x0_and_space(x0, space,
...          splits={'S1': 1, 'S2': 1, 'S3': 2}, gens=(x,y))
>>> sdp.S_from_y()
{'S1': Matrix([[x - 1]]), 'S2': Matrix([[x + y - 2]]), 'S3': Matrix([
[5*y - 3,    -2*y],
[   -2*y, 6*y - 4]])}
```

#### Parameters

<dl>
  <dt><code>x0: Matrix</code></dt>
  <dd>
    The concatenated x0 of all matrices Si.
  </dd>

  <dt><code>space: Matrix</code></dt>
  <dd>
    The concatednated (vstack) spaces of all matrices Si.
  </dd>

  <dt><code>splits: Union[Dict[Any, int], List[int]]</code></dt>
  <dd>
    The dimension of each matrix.
  </dd>

  <dt><code>gens: Optional[Tuple[Symbol, ...]] (default: <code>None</code>)</code></dt>
  <dd>
    The variable names.
  </dd>

  <dt><code>constrain_symmetry: bool (default: <code>False</code>)</code></dt>
  <dd>
    If each column of the split space is not the vector form of a symmetric matrix, the flag should be set to True to impose symmetry.
  </dd>

</dl>

#### Returns

**`"SDPProblem"`**

SDPProblem : The created SDPProblem instance.

---

### <span data-api-method-heading="true"><code>from&#95;equations</code></span>

```python
@classmethod
def from_equations(
    cls,
    eq: Matrix,
    rhs: Matrix,
    splits: Optional[Union[Dict[str, int], List[int]]] = None,
    force_zeros: Dict[int, List[int]] = {},
    add_force_zeros: bool = False,
    equal_entries: List[Tuple[int, int]] = [],
    add_equal_entries: bool = True,
    time_limit: Optional[Union[Callable, float]] = None
) -> Tuple["SDPProblem", Tuple[Matrix, Matrix]]:
```

Assume the SDP problem can be rewritten in the form of eq * [vec(S1); vec(S2); ...] + eq * M = rhs where Si >> 0 and Si.shape[0] = splits[i], and M is the linear part. The function formulates the SDP problem from the given equations. This is also the primal form of the SDP problem.

#### Examples

Consider the example from https://clarabel.org/stable/examples/example_sdp/ where the SDP problem is given by min trace(X) s.t. Avec(X) = b, X >> 0 where: A = Matrix([[1,2,4,2,3,5,4,5,6]]) b = Matrix([1]) To initialize the problem, just use the `from_equations` method.

```python
>>> from sympy import Matrix
>>> A = Matrix([[1,2,4,2,3,5,4,5,6]])
>>> b = Matrix([1])
>>> sdp, (x0, space) = SDPProblem.from_equations(A, b)
>>> sdp
<SDPProblem dof=5 size={0: 3}>
>>> sdp.S_from_y() # doctest: +SKIP
{0: Matrix([
[-4*y_{0} - 3*y_{1} - 8*y_{2} - 10*y_{3} - 6*y_{4} + 1, y_{0}, y_{2}],
[                                                y_{0}, y_{1}, y_{3}],
[                                                y_{2}, y_{3}, y_{4}]])}
>>> sol = sdp.solve_obj(sdp.S_from_y()[0].trace())
>>> sdp.S # doctest: +SKIP
{0: Matrix([
[0.0128900409812068, 0.0177186109536194, 0.0251905619896497],
[0.0177186109536194,  0.024355954451504, 0.0346268797866644],
[0.0251905619896497, 0.0346268797866644, 0.0492290596776602]])}
>>> sdp.S[0].trace() # doctest: +SKIP
0.0864750551103711
```

#### Parameters

<dl>
  <dt><code>eq: Matrix</code></dt>
  <dd>
    The matrix eq.
  </dd>

  <dt><code>rhs: Matrix</code></dt>
  <dd>
    The matrix rhs.
  </dd>

  <dt><code>splits: Optional[Union[Dict[str, int], List[int]]] (default: <code>None</code>)</code></dt>
  <dd>
    The splits of the size of each symmetric matrix. If None, it assumes there is only one matrix.
  </dd>

  <dt><code>force_zeros: Dict[int, List[int]] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>add_force_zeros: bool (default: <code>False</code>)</code></dt>
  <dd>
    If True, if a digonal entry of the PSD matrix is zero, then it also sets the corresponding row to zero.
  </dd>

  <dt><code>equal_entries: List[Tuple[int, int]] (default: <code>[]</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>add_equal_entries: bool (default: <code>True</code>)</code></dt>
  <dd>
    If True, constrain the pair (i,j) and (j,i) entries of a symmetric matrix to be equal when solving the linear system. This is important to be True unless the constraint has been provided in the <code>equal_entries</code> argument.
  </dd>

  <dt><code>time_limit: Optional[Union[Callable, float]] (default: <code>None</code>)</code></dt>
  <dd>
    Try to raise the ArithmeticTimeout Exception when timeout is detected. If callable, it should be a function to check timeout and raise the Exception.
  </dd>

</dl>

#### Returns

**`Tuple["SDPProblem", Tuple[Matrix, Matrix]]`**

sdp : SDPProblem The created SDP problem instance. (x0, space): Tuple[Matrix, Matrix] The rest of the linear variables can be represented by x0 + space @ y where y is the generator vector of the SDPProblem.

---

### <span data-api-method-heading="true"><code>from&#95;matrix</code></span>

```python
@classmethod
def from_matrix(
    cls,
    S: Union[Matrix, List[Matrix], Dict[str, Matrix]],
    gens: Optional[Union[List[Symbol], Tuple[Symbol, ...]]] = None
) -> "SDPProblem":
```

Construct a <code>SDPProblem</code> from symbolic symmetric matrices. The problem is to solve a parameter set such that all given symmetric matrices are positive semidefinite. The result can be obtained by <code>SDPProblem.as_params()</code>.

#### Parameters

<dl>
  <dt><code>S: Union[Matrix, List[Matrix], Dict[str, Matrix]]</code></dt>
  <dd>
    The symmetric matrices that SDP requires to be positive semidefinite. Each entry of the matrix should be linear in the free symbols (gens).
  </dd>

  <dt><code>gens: Optional[Union[List[Symbol], Tuple[Symbol, ...]]] (default: <code>None</code>)</code></dt>
  <dd>
    The free symbols of the matrices, by default None. If None, it will be inferred from the matrices and sorted by names.
  </dd>

</dl>

#### Returns

**`"SDPProblem"`**

sdp : SDPProblem The created SDP problem instance.

---

### <span data-api-method-heading="true"><code>S&#95;from&#95;y</code></span>

```python
def S_from_y(
    self,
    y: Optional[Union[MatrixBase, np.ndarray, Dict]] = None
) -> Dict[str, Matrix]:
```

#### Parameters

<dl>
  <dt><code>y: Optional[Union[MatrixBase, np.ndarray, Dict]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Dict[str, Matrix]`**

Returns a `Dict[str, Matrix]` object.

---

### <span data-api-method-heading="true"><code>as&#95;params</code></span>

```python
def as_params(
    self
) -> Dict[Symbol, "Expr"]:
```

Return the dictionary of free symbols and their values after solving the SDP.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import a, b
>>> sdp = SDPProblem.from_matrix(Matrix([[a, 1], [1, b]]))
>>> sdp.solve_obj(4*a + b) # doctest: +SKIP
Matrix([
[0.499986210665879],
[ 2.00005510893102]])
>>> sdp.as_params() # doctest: +SKIP
{a: 0.499986210665879, b: 2.00005510893102}
```

#### Returns

**`Dict[Symbol, "Expr"]`**

params : Dict[Symbol, Expr] The dictionary of variable values.

---

### <span data-api-method-heading="true"><code>rationalize</code></span>

```python
def rationalize(
    self,
    y: np.ndarray,
    verbose: bool = False,
    time_limit: Optional[Union[Callable, float]] = None,
    **kwargs
) -> Optional[Tuple[Matrix, "Decomp"]]:
```

Rationalize a NumPy vector <code>y</code>. If verbose == True, display the numerical eigenvalues before rationalization.

#### Parameters

<dl>
  <dt><code>y: np.ndarray</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>verbose: bool (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>time_limit: Optional[Union[Callable, float]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Optional[Tuple[Matrix, "Decomp"]]`**

Returns a `Optional[Tuple[Matrix, "Decomp"]]` object.

---

### <span data-api-method-heading="true"><code>&#95;solve&#95;numerical&#95;sdp</code></span>

```python
def _solve_numerical_sdp(
    self,
    objective: np.ndarray,
    constraints: List[Tuple[np.ndarray, np.ndarray, str]] = [],
    solver: Optional[str] = None,
    return_result: bool = False,
    kwargs: Dict[str, Any] = {}
) -> Optional[np.ndarray]:
```

#### Parameters

<dl>
  <dt><code>objective: np.ndarray</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>constraints: List[Tuple[np.ndarray, np.ndarray, str]] (default: <code>[]</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>solver: Optional[str] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>return_result: bool (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>kwargs: Dict[str, Any] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Optional[np.ndarray]`**

Returns a `Optional[np.ndarray]` object.

---

### <span data-api-method-heading="true"><code>solve&#95;obj</code></span>

```python
def solve_obj(
    self,
    objective: Union["Expr", Matrix, List],
    constraints: List[Union["Relational", "Expr", Tuple[Matrix, Matrix, str]]] = [],
    solver: Optional[str] = None,
    solve_child: bool = True,
    propagate_to_parent: bool = True,
    verbose: bool = False,
    time_limit: Optional[float] = None,
    kwargs: Dict[Any, Any] = {}
) -> Optional[Matrix]:
```

Solve the SDP problem numerically with the given objective.

#### Examples

Here we illustrate the example from "Semidefinite Optimization and Convex Algebraic Geometry" by Blekherman, Parillo and Thomas, Example 2.7. Consider the SDP [[x+1, 0, y], [0, 2, -x-1], [y, -x-1, 2]] >> 0, whose feasible set is part of the elliptic curve: 3+x-x^3-3*x^2-2*y^2>=0 && x>=-1. We wish to maximize x+2*y (i.e., minimize -x-2*y) in the positive semidefinite cone. The SDP problem can be then initialized using the `from_matrix` method:

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y, a, b, c
>>> sdp = SDPProblem.from_matrix(Matrix([[x+1, 0, y], [0, 2, -x-1], [y, -x-1, 2]]))
```

We can solve the SDP problem by calling `.solve_obj`:

```python
>>> sdp.solve_obj(-x-2*y) # doctest: +SKIP
Matrix([
[0.453950762287364],
[ 1.17093779835239]])
```

After the SDP is solved, the solution can be obtained by `.y` and `.S`:

```python
>>> sdp.y # doctest: +SKIP
Matrix([
[0.453950762287364],
[ 1.17093779835239]])
>>> sdp.S # doctest: +SKIP
{0: Matrix([
[1.45395076228736,               0.0,  1.17093779835239],
[             0.0,               2.0, -1.45395076228736],
[1.17093779835239, -1.45395076228736,               2.0]])}
```

It is also supported to obtain a dictionary of values via `.as_params()`, which can be used in `.subs` method of sympy expressions:

```python
>>> sdp.as_params() # doctest: +SKIP
{x: 0.453950762287364, y: 1.17093779835239}
>>> (x+2*y).subs(sdp.as_params()) # doctest: +SKIP
2.79582635899214
```

Apart from using a sympy expression to express the objective, the objective can also be a vector (list), standing for the inner product of the vector and the variable vector. For example, using [-1,-2] as objective is equivalent to minimizing -x-2*y:

```python
>>> sdp.solve_obj([-1,-2]) # doctest: +SKIP
Matrix([
[0.453950762287364],
[ 1.17093779835239]])
```

##### Solving with constraints

We can also add additional affine constrains to the SDP problem when calling `.solve_obj`. For example, we can add the constraint x+y<0:

```python
>>> sdp.solve_obj(-x-2*y, constraints=[x+y<0]) # doctest: +SKIP
Matrix([
[-0.729181517672415],
[ 0.729181519072328]])
```

Constraints can also be passed a (lhs, rhs, op) tuple, where op is one of '>', '<', '=', lhs is a 2D matrix and rhs is a 1D matrix. For example, the constraint x+y<0 can be written as (Matrix([[1,1]]), Matrix([0]), '<'). The following code is equivalent to the previous example:

```python
>>> sol = sdp.solve_obj(-x-2*y, constraints=[(Matrix([[1,1]]), Matrix([0]), '<')])
```

The function will sanitize the input so it is also acceptable to pass in lists or numpy arrays instead of sympy matrices. Nonlinear objectives or constraints are not supported, e.g.,

```python
>>> sdp.solve_obj(-x-2*y, constraints=[y<=x**2]) # doctest: +SKIP
Traceback (most recent call last):
...
NonlinearError: nonlinear term: x**2
```

##### Handling exceptions

If the solver does not find the optimal solution, e.g., when the problem is infeasible or unbounded, or the solution is inaccurate given the tolerance, the function will raise an error. Below is an example of infeasible SDP that Matrix([[a, 2], [2, 1-a]]) >> 0. It is infeasible since a*(1-a) < 4.

```python
>>> sdp = SDPProblem.from_matrix(Matrix([[a, 2], [2, 1-a]]))
>>> sdp.solve_obj(a) # doctest: +SKIP
Traceback (most recent call last):
...
SDPError: SDP solution failed: optimal=False, infeasible=True, inf_or_unb=True

>>> try:
...     sdp.solve_obj(a)
... except SDPError as e:
...     print((e.infeasible, e.unbounded, e.inf_or_unb))
(True, False, True)
```

Below is an example of unbounded SDP: min -a, s.t. [[a, 1], [1, a]] >> 0.

```python
>>> sdp = SDPProblem.from_matrix(Matrix([[a, 1], [1, a]]))
>>> try:
...     sdp.solve_obj(-a)
... except SDPError as e:
...     print((e.infeasible, e.unbounded, e.inf_or_unb))
(False, True, True)
```

More statuses of SDPErrors can be found in the `SDPError` class.

##### Using kwargs

The `kwargs` argument can be used to pass extra arguments to the backend SDP solver. We have the follwing example to solve an SDP problem with CVXOPT solver and increased precision:

```python
>>> sdp = SDPProblem.from_matrix(Matrix([[a, 1], [1, a]]))
>>> sdp.solve_obj(a, solver='cvxopt',
... kwargs={'verbose':True, 'tol_gap_abs':1e-12, 'tol_gap_rel':1e-12}) # doctest: +SKIP
     pcost       dcost       gap    pres   dres   k/t
 0:  0.0000e+00 -0.0000e+00  2e+00  2e+00  5e-10  1e+00
 1:  8.2427e-01  8.2427e-01  2e-01  2e-01  5e-11  9e-02
 2:  9.9824e-01  9.9824e-01  2e-03  2e-03  5e-13  1e-03
 3:  9.9998e-01  9.9998e-01  2e-05  2e-05  5e-15  1e-05
 4:  1.0000e+00  1.0000e+00  2e-07  2e-07  1e-16  1e-07
 5:  1.0000e+00  1.0000e+00  2e-09  2e-09  7e-16  1e-09
 6:  1.0000e+00  1.0000e+00  2e-11  2e-11  2e-16  1e-11
 7:  1.0000e+00  1.0000e+00  2e-13  2e-13  4e-15  1e-13
Optimal solution found.
Matrix([[0.999999999999824]])
```

#### Parameters

<dl>
  <dt><code>objective: Union["Expr", Matrix, List]</code></dt>
  <dd>
    Objective to minimize. If it is a sympy expression, it must be affine with respect to the variables. If it is a matrix (a column vector) or a list, the objective is the inner product of the vector and the variable vector.
  </dd>

  <dt><code>constraints: List[Union["Relational", "Expr", Tuple[Matrix, Matrix, str]]] (default: <code>[]</code>)</code></dt>
  <dd>
    Additional affine constraints over variables. Each element of the list must be one of the following: A sympy affine relational expression, e.g., <code>x &gt; 0</code> or <code>Eq(x + y, 1)</code>. Note that equality constraints must use <code>sympy.Eq</code> class instead of <code>==</code> operator, because the latter <code>x + y == 1</code> will be evaluated to a boolean value. A sympy affine expression, e.g., <code>x + y - 1</code>, they are treated as equality constraints. A tuple of (lhs, rhs, operator), where lhs is a 2D matrix, rhs is a 1D vector, and operator is a string. It is considered as <code>lhs @ variables (operator) rhs</code>. The operator can be one of '>', '<' or '='.
  </dd>

  <dt><code>solver: Optional[str] (default: <code>None</code>)</code></dt>
  <dd>
    Backend solver to the numerical SDP, e.g., 'mosek', 'clarabel', 'cvxopt'. Corresponding packages must be installed. If None, the solver will be automatically selected. For a full list of supported backends, see <code>sdp.backends.caller.py</code>.
  </dd>

  <dt><code>solve_child: bool (default: <code>True</code>)</code></dt>
  <dd>
    If there is a transformation graph of the SDP, whether to solve the child node and then convert the solution back to the parent node. This reduces the degree of freedom. Defaults to True.
  </dd>

  <dt><code>propagate_to_parent: bool (default: <code>True</code>)</code></dt>
  <dd>
    If there is a transformation graph of the SDP, whether to propagate the solution of the SDP to its parents. Defaults to True.
  </dd>

  <dt><code>verbose: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to allow the backend SDP solver to print the log. Defaults to False. This argument will be suppressed if <code>kwargs</code> contains a <code>verbose</code> key.
  </dd>

  <dt><code>time_limit: Optional[float] (default: <code>None</code>)</code></dt>
  <dd>
    Time limit in seconds for the solver. If None, no time limit is set. Defaults to None. When time limit is reached, the solver will try to terminate the process and raise an Exception. Only a few solvers support time limit, e.g., 'mosek', 'clarabel' and 'qics', and other solvers will not check timeout during the solving process.
  </dd>

  <dt><code>kwargs: Dict[Any, Any] (default: <code>{}</code>)</code></dt>
  <dd>
    Extra kwargs passed to <code>sdp.backends.solve_numerical_dual_sdp</code>. Accepted kwargs keys: <code>verbose</code>, <code>max_iters</code>, <code>tol_gap_abs</code>, <code>tol_gap_rel</code>, <code>tol_fsb_abs</code>, <code>tol_fsb_rel</code>, <code>solver_options</code>, etc.
  </dd>

</dl>

#### Returns

**`Optional[Matrix]`**

Returns a `Optional[Matrix]` object.

---

### <span data-api-method-heading="true"><code>solve</code></span>

```python
def solve(
    self,
    solver: Optional[str] = None,
    solve_child: bool = True,
    propagate_to_parent: bool = True,
    verbose: bool = False,
    time_limit: Optional[float] = None,
    allow_numer: int = 0,
    kwargs: Dict[Any, Any] = {}
) -> Optional[Matrix]:
```

Solve a feasible SDP problem. If the SDPProblem is rational, it tries to find a rational solution. However, the search for rational solutions is heuristic and could fail for weakly feasible SDPs.

#### Examples

Here we illustrate an example from "Moment and Polynomial Optimization" by Jiawang Nie, Section 3.1 to prove 1+x+x^2+x^3+x^4+x^5+x^6 >= 0 via sum of squares. The polynomial can always be represented as [1,x,x^2,x^3]^T @ X @ [1,x,x^2,x^3] where X is defined as:

```python
>>> from sympy import Matrix, Rational
>>> from sympy.abc import a, b, c, x
>>> half = Rational(1,2)
>>> X = Matrix([[1,half,a,b],[half,1-2*a,half-b,c],[a,half-b,1-2*c,half],[b,c,half,1]])
```

We can check that this is correct:

```python
>>> xx = Matrix([1,x,x**2,x**3])
>>> (xx.T @ X @ xx).expand()
Matrix([[x**6 + x**5 + x**4 + x**3 + x**2 + x + 1]])
```

Our target is to find a solution of [a,b,c] so that X >> 0 holds. We can create the SDP problem as follows:

```python
>>> sdp = SDPProblem.from_matrix(X)
>>> sdp.solve() # doctest: +SKIP
Matrix([
[0],
[0],
[0]])
```

The `solve` method tries to find a rational solution if the SDP problem is rational by rationalization. After solving, the result can be accessed via `.y`, `.S` and `.as_params()`:

```python
>>> sdp.y # doctest: +SKIP
Matrix([
[0],
[0],
[0]])
>>> sdp.S # doctest: +SKIP
{0: Matrix([
[  1, 1/2,   0,   0],
[1/2,   1, 1/2,   0],
[  0, 1/2,   1, 1/2],
[  0,   0, 1/2,   1]])}
>>> sdp.as_params() # doctest: +SKIP
{a: 0, b: 0, c: 0}
```

It is also possible to access the decompositions via `.decompositions`, which contains a dictionary of (U, D) tuple such that U.T@diag(D)@U=S.

```python
>>> sdp.decompositions # doctest: +SKIP
{0: (Matrix([
[1, 1/2,   0,   0],
[0,   1, 2/3,   0],
[0,   0,   1, 3/4],
[0,   0,   0,   1]]), Matrix([
[  1],
[3/4],
[2/3],
[5/8]]))}
```

##### Registering solutions

The rationalization might fail, or generate very nasty solutions, and we may want to manually register a solution. The `register_y` method can be used to register a solution. By registration, the feasibility will be verified and the matrices and decompositions will be automatically updated.

```python
>>> sdp.register_y([0,half,0])
True
>>> sdp.S
{0: Matrix([
[  1, 1/2,   0, 1/2],
[1/2,   1,   0,   0],
[  0,   0,   1, 1/2],
[1/2,   0, 1/2,   1]])}
>>> sdp.decompositions
{0: (Matrix([
[1, 1/2, 0,  1/2],
[0,   1, 0, -1/3],
[0,   0, 1,  1/2],
[0,   0, 0,    1]]), Matrix([
[   1],
[ 3/4],
[   1],
[5/12]]))}
```

We can then obtain a sum-of-squares proof via the decomposition:

```python
>>> U, D = sdp.decompositions[0]
>>> sos = sum(coeff*p**2 for coeff, p in zip(D, U@xx)); sos
5*x**6/12 + 3*(-x**3/3 + x)**2/4 + (x**3/2 + x**2)**2 + (x**3/2 + x/2 + 1)**2
>>> sos.expand()
x**6 + x**5 + x**4 + x**3 + x**2 + x + 1
```

##### Allowing numerical solutions

Although the SDPProblem tries to find a rational solution if the problem is rational, a rational solution might not exist even if the SDP is feasible. Consider the example [[a,2],[2,2*a]] >> 0, [[2,a],[a,1]] >> 0, which is a two-block SDP problem. The only solution is a = sqrt(2), which is irrational. Any number a other than sqrt(2) will make one of the matrices not positive semidefinite, so it will fail to find a feasible solution:

```python
>>> S1 = Matrix([[a,2],[2,2*a]])
>>> S2 = Matrix([[2,a],[a,1]])
>>> sdp = SDPProblem.from_matrix({'S1': S1, 'S2': S2})
>>> sdp.solve() # doctest: +SKIP
Traceback (most recent call last):
...
SDPRationalizeError: SDP solution failed:
```

However, we can allow numerical solutions by setting `allow_numer=True`. The `solve` method will then return a numerical solution up to a small tolerance:

```python
>>> sdp.solve(allow_numer=True) # doctest: +SKIP
Matrix([[1.41421356161294]])
>>> sdp.S # doctest: +SKIP
{'S1': Matrix([
[1.41421356161294,              2.0],
[             2.0, 2.82842712322588]]), 'S2': Matrix([
[             2.0, 1.41421356161294],
[1.41421356161294,              1.0]])}
```

#### Parameters

<dl>
  <dt><code>solver: Optional[str] (default: <code>None</code>)</code></dt>
  <dd>
    Backend solver to the numerical SDP, e.g.,'mosek', 'clarabel', 'cvxopt'. Corresponding packages must be installed. If None, the solver will be automatically selected. For a full list of supported backends, see <code>sdp.backends.caller.py</code>.
  </dd>

  <dt><code>solve_child: bool (default: <code>True</code>)</code></dt>
  <dd>
    If there is a transformation graph of the SDP, whether to solve the child node and then convert the solution back to the parent node. This reduces the degree of freedom. Defaults to True.
  </dd>

  <dt><code>propagate_to_parent: bool (default: <code>True</code>)</code></dt>
  <dd>
    If there is a transformation graph of the SDP, whether to propagate the solution of the SDP to its parents. Defaults to True.
  </dd>

  <dt><code>verbose: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to print the progress of the solver. Defaults to False.
  </dd>

  <dt><code>time_limit: Optional[float] (default: <code>None</code>)</code></dt>
  <dd>
    Time limit in seconds for the solver. If None, no time limit is set. Defaults to None. When time limit is reached, the solver will try to terminate the process and raise an Exception. Only a few solvers support time limit, e.g., 'mosek', 'clarabel' and 'qics', and other solvers will not check timeout during the solving process.
  </dd>

  <dt><code>allow_numer: int (default: <code>0</code>)</code></dt>
  <dd>
    Whether to allow inexact, numerical feasible solutions. This is useful when the SDP is weakly feasible and no rational solution is found successfully.
  </dd>

  <dt><code>kwargs: Dict[Any, Any] (default: <code>{}</code>)</code></dt>
  <dd>
    Extra kwargs passed to <code>sdp.backends.solve_numerical_dual_sdp</code>. Accepted kwargs keys: <code>verbose</code>, <code>max_iters</code>, <code>tol_gap_abs</code>, <code>tol_gap_rel</code>, <code>tol_fsb_abs</code>, <code>tol_fsb_rel</code>, <code>solver_options</code>, etc.
  </dd>

</dl>

#### Returns

**`Optional[Matrix]`**

y : Matrix The solution of the SDP problem. If it fails, return None.

---

### <span data-api-method-heading="true"><code>from&#95;entry&#95;contribution</code></span>

```python
@classmethod
def from_entry_contribution(
    cls,
    rhs: Matrix,
    psd_size: Dict[Any, int],
    psd_contribution: Dict[Any, Callable[[int, int], Tuple[int, "Expr"]]],
    linear_size: Optional[Dict[Any, int]] = None,
    linear_contribution: Optional[Dict[Any, Callable[[int], Tuple[int, "Expr"]]]] = None,
    domain = None,
    equal_indices: List[Tuple[int, int]] = []
) -> Tuple["SDPProblem", Dict[Any, Tuple[Matrix, Matrix]]]:
```

#### Parameters

<dl>
  <dt><code>rhs: Matrix</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>psd_size: Dict[Any, int]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>psd_contribution: Dict[Any, Callable[[int, int], Tuple[int, "Expr"]]]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>linear_size: Optional[Dict[Any, int]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>linear_contribution: Optional[Dict[Any, Callable[[int], Tuple[int, "Expr"]]]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>domain (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>equal_indices: List[Tuple[int, int]] (default: <code>[]</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple["SDPProblem", Dict[Any, Tuple[Matrix, Matrix]]]`**

Returns a `Tuple["SDPProblem", Dict[Any, Tuple[Matrix, Matrix]]]` object.

---

### <span data-api-method-heading="true"><code>constrain&#95;symmetry</code></span>

```python
def constrain_symmetry(
    self
) -> "SDPProblem":
```

Constrain every matrix to be symmetric. To ensure correctness, this must be called in advance if any matrix is not symmetric.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y, z
>>> M1 = Matrix([[x, 1, 0], [x + z, 0, y], [0, 4 - y - z, 3 - y]])
>>> sdp = SDPProblem.from_matrix({'M1': M1})
>>> sdp2 = sdp.constrain_symmetry()
>>> sdp2.S_from_y() # doctest: +SKIP
{'M1': Matrix([
 [y_{0} + 1,           1,           0],
 [        1,           0, y_{0}/2 + 2],
 [        0, y_{0}/2 + 2, 1 - y_{0}/2]])}
```

#### Returns

**`"SDPProblem"`**

SDPProblem The transformed SDP problem.

---

### <span data-api-method-heading="true"><code>constrain&#95;congruence</code></span>

```python
def constrain_congruence(
    self,
    basis: Dict[Any, Matrix],
    time_limit = None
):
```

Apply congruence transforms to the matrices in the SDP problem.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import a, b, c
>>> M1 = Matrix([[a,b],[b,c]])
>>> sdp = SDPProblem.from_matrix({'M1': M1})
>>> sdp2 = sdp.constrain_congruence({'M1': Matrix([[1,2],[2,5]])})
>>> sdp2.S_from_y() # doctest: +NORMALIZE_WHITESPACE
{'M1': Matrix([
 [   a + 4*b + 4*c,  2*a + 9*b + 10*c],
 [2*a + 9*b + 10*c, 4*a + 20*b + 25*c]])}
```

#### Parameters

<dl>
  <dt><code>basis: Dict[Any, Matrix]</code></dt>
  <dd>
    Basis that new_mat[key] = basis[key].T * mat * basis[key]. If a key is missing, basis[key] defaults to the identity matrix.
  </dd>

  <dt><code>time_limit (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>get&#95;zero&#95;diagonals</code></span>

```python
def get_zero_diagonals(
    self
) -> Dict[Any, List[int]]:
```

Get diagonals that are zero.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y
>>> M1 = Matrix([[x, y], [y, 0]])
>>> M2 = Matrix([[x + 2, 0], [0, x + y]])
>>> sdp = SDPProblem.from_matrix({'M1': M1, 'M2': M2})
>>> sdp.get_zero_diagonals()
{'M1': [1], 'M2': []}
```

#### Returns

**`Dict[Any, List[int]]`**

Dict[Any, List[int]] A dictionary mapping each key to a list of zero diagonals.

---

### <span data-api-method-heading="true"><code>get&#95;block&#95;structures</code></span>

```python
def get_block_structures(
    self
) -> Dict[Any, List[List[int]]]:
```

Get block structures.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y
>>> M1 = Matrix([[x, y, 0], [y, 0, 0], [0, 0, 2 - y]])
>>> M2 = Matrix([[x, 0], [0, x + y]])
>>> sdp = SDPProblem.from_matrix({'M1': M1, 'M2': M2})
>>> sdp.get_block_structures()
{'M1': [[0, 1], [2]], 'M2': [[0], [1]]}
```

#### Returns

**`Dict[Any, List[List[int]]]`**

Dict[Any, List[List[int]]] A dictionary mapping each key to a list of block structures.

---

### <span data-api-method-heading="true"><code>constrain&#95;zero&#95;diagonals</code></span>

```python
def constrain_zero_diagonals(
    self,
    extractions = None,
    masks = None,
    time_limit = None
) -> "SDPProblem":
```

Constrain zero diagonals. Providing either <code>extractions</code> or <code>masks</code> is sufficient. If both are not provided, then the default behavior is to call <code>get_zero_diagonals</code> to get the zero diagonals.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y
>>> M1 = Matrix([[x, y, 0], [y, 0, 0], [0, 0, 2 - y]])
>>> M2 = Matrix([[x, 0], [0, x + y]])
>>> sdp = SDPProblem.from_matrix({'M1': M1, 'M2': M2})
>>> sdp2 = sdp.constrain_zero_diagonals()
>>> sdp2.S_from_y() # doctest: +SKIP
{'M1': Matrix([
 [y_{0}, 1],
 [    1, 2]]),
 'M2': Matrix([
 [-y_{0},     1],
 [     1, y_{0}]])}
>>> sdp2.size
{'M1': 2, 'M2': 2}
```

Constraining the diagonal elements to zero will also constrain the whole row to be zero.

```python
>>> M1 = Matrix([[x, y, 0], [y, 0, 0], [0, 0, 2 - y]])
>>> M2 = Matrix([[2 - x, 1], [1, x + y + 4]])
>>> sdp = SDPProblem.from_matrix({'M1': M1, 'M2': M2})
>>> sdp3 = sdp.constrain_zero_diagonals(extractions={'M1': [1, 2]})
>>> sdp3.S_from_y() # doctest: +NORMALIZE_WHITESPACE
{'M1': Matrix([
 [0, 0],
 [0, 2]]),
 'M2': Matrix([
 [2, 1],
 [1, 4]])}
>>> sdp4 = sdp.constrain_zero_diagonals(masks={'M1': [0, 1]})
>>> sdp4.S_from_y() # doctest: +NORMALIZE_WHITESPACE
{'M1': Matrix([[2]]),
 'M2': Matrix([
 [2, 1],
 [1, 4]])}
```

#### Parameters

<dl>
  <dt><code>extractions (default: <code>None</code>)</code></dt>
  <dd>
    A dictionary mapping each key to a list of extractions of row indices as non-zero diagonals. If a key is missing, it defaults to extract the whole matrix.
  </dd>

  <dt><code>masks (default: <code>None</code>)</code></dt>
  <dd>
    A dictionary mapping each key to a list of masks of row indices as zero diagonals. If a key is missing, it defaults to mask no diagonals.
  </dd>

  <dt><code>time_limit (default: <code>None</code>)</code></dt>
  <dd>
    The time limit in seconds.
  </dd>

</dl>

#### Returns

**`"SDPProblem"`**

SDPProblem The transformed SDP problem.

---

### <span data-api-method-heading="true"><code>constrain&#95;block&#95;structures</code></span>

```python
def constrain_block_structures(
    self,
    blocks = None
) -> "SDPProblem":
```

Constrain block structures.

#### Examples

```python
>>> from sympy import Matrix
>>> from sympy.abc import x, y
>>> M1 = Matrix([[x, y, 0], [y, 0, 0], [0, 0, 2 - y]])
>>> M2 = Matrix([[1 - x, 0], [0, x + y + 1]])
>>> sdp = SDPProblem.from_matrix({'M1': M1, 'M2': M2})
>>> sdp2 = sdp.constrain_block_structures()
>>> sdp2.S_from_y() # doctest: +NORMALIZE_WHITESPACE
{('M1',
 0): Matrix([
 [x, y],
 [y, 0]]),
 ('M1', 1): Matrix([[2 - y]]),
 ('M2', 0): Matrix([[1 - x]]),
 ('M2', 1): Matrix([[x + y + 1]])}
```

#### Parameters

<dl>
  <dt><code>blocks (default: <code>None</code>)</code></dt>
  <dd>
    A dictionary mapping each key to a list of block structures. If a key is missing, it defaults to have only one block. If not provided, it is automatically computed by <code>get_block_structures</code>.
  </dd>

</dl>

#### Returns

**`"SDPProblem"`**

SDPProblem The transformed SDP problem.