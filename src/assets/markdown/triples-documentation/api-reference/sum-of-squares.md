# Sum of Squares

The `sum_of_squares` function is the core utility for performing sum of squares decomposition on a given expression, potentially with constraints.  It takes a symbolic expression (a SymPy `Expr`) and attempts to express it in sum of squares. This is a common technique to prove that the polynomial is nonnegative. The function can also handle problems with inequality and equality constraints.

## Function Signature

```python
def sum_of_squares(
    expr: Expr,
    ineq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    eq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    *,
    roots: Optional[List[Union[Tuple[Expr, ...], Dict[Symbol, Expr]]]] = None,
    verbose: bool = False,
    time_limit: float = 3600.,
    configs: dict = {},
) -> Optional[Solution]:
```

## Examples

### Basic Usage

The function relies on SymPy for symbolic computation. First, import necessary items:

```python
>>> from sympy.abc import x, y, a, b, c
>>> from triples.core import sum_of_squares 
```

Call the function by passing in a SymPy expression:

```python
>>> result = sum_of_squares(a**2+b**2+c**2-a*b-b*c-c*a)
```

The result will be `None` if the function fails to find a decomposition with its current methods. However, when the function fails
it does not mean the polynomial is non positive semidefinite or not a sum-of-squares. It only
means the function could not find a solution.
If result is not `None`, it will be a `Solution` class instance. To access the expression, use `.solution`:

```python
>>> from sympy import Expr
>>> print(isinstance(result.solution, Expr), result.solution) # doctest: +SKIP
True (Σ(a - b)**2)/2
```

The solution expression might involve `CyclicSum` and `CyclicProduct` classes, which are not native
to SymPy, but defined in this package. The permutation groups are not displayed by default and
might be sometimes misleading. To avoid ambiguity and to expand them, use `.doit()` on SymPy expressions:

```python
>>> result.solution.doit() # doctest: +SKIP
(-a + c)**2/2 + (a - b)**2/2 + (b - c)**2/2
```

### With Constraints

If we want to add constraints for the domain of the variables, we can pass in a list of inequality
or equality constraints. This should be the second and the third argument respectively. Constraints are
expressions that are assumed to be non-negative (for inequalities) or zero (for equalities).

Here is an example for the constraints $a,b,c \ge 0$:

```python
>>> sum_of_squares(a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b), [a,b,c]).solution # doctest: +SKIP
((Σ(a - b)**2*(a + b - c)**2)/2 + Σa*b*(a - b)**2)/(Σa)
```

If we want to track the constraints, we can also pass in a dictionary to imply the "name" of the
constraints:

```python
>>> sum_of_squares(((a+2)*(b+2)*(c+2)*(a**2/(2+a)+b**2/(2+b)+c**2/(2+c)-1)).cancel(), [a,b,c], {a*b*c-1:x}).solution # doctest: +SKIP
x*(Σ(2*a + 13))/6 + Σa*(b - c)**2 + (Σa*b*(c - 1)**2)/6 + 5*(Σ(a - 1)**2)/6 + 7*(Σ(a - b)**2)/12

>>> sum_of_squares(x+y+z-(x*y+y*z+z*x), {x:x, y:y, z:z, 4-(x*y+y*z+z*x+x*y*z):a}).solution # doctest: +SKIP
(a*(Σ(x**2 + 2*x*y)) + Σx*y*(x - y)**2 + (Σx*y*z*(x - y)**2)/2)/(Σ(x*y*z + 4*x*y + 4*x))

>>> from sympy import Function
>>> G = Function("G") # G(v) represents a non-negative quantity if v is a constraint
>>> sum_of_squares(x*(y-z)**2+y*(z-x)**2+z*(x-y)**2, {x:G(x),y:G(y),z:G(z)}).solution # doctest: +SKIP
Σ(x - y)**2*G(z)
```

### Assumptions

In the current, all SymPy symbol assumptions are ignored and symbols are treated as
real variables. To claim nonnegativity of symbols, just add them to `ineq_constraints`.
Integer or noncommutative symbol assumptions are not supported in the current either.

```python
>>> from sympy import Symbol
>>> _x = Symbol("x", positive=True)
>>> sum_of_squares(_x**2 + 3*_x + 1) is None
True
>>> sum_of_squares(_x**2 + 3*_x + 1, [_x]) is not None
True
```

## Parameters

<dl>
  <dt><code>expr: Expr</code></dt>
  <dd>The expression to perform sum of squares on.</dd>

<dt><code>ineq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code></dt>
  <dd>
    Inequality constraints to the problem. This assumes g_1(x) >= 0, g_2(x) >= 0, ...
  </dd>

<dt><code>eq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code></dt>
  <dd>
    Equality constraints to the problem. This assumes h_1(x) = 0, h_2(x) = 0, ...
  </dd>

<dt><code>roots: Optional[List[Union[Tuple[Expr, ...], Dict[Symbol, Expr]]]]</code></dt>
  <dd>
    Equality cases of the expression. This saves the time for searching equality
    cases if provided.
  </dd>

<dt><code>verbose: bool</code> (default: <code>False</code>)</dt>
  <dd>
    Whether to print information during the solving process. Defaults to False.
  </dd>

<dt><code>time_limit: float</code> (default: <code>3600.</code>)</dt>
  <dd>
    The time limit (in seconds) for the solver. Defaults to 3600. When the time limit is
    reached, the solver is killed when it returns to the main loop. <br>
    However, it might not be killed instantly if it is stuck in an internal function.
  </dd>
</dl>

## Returns

**`Optional[Solution]`**

Returns a `Solution` object if a sum of squares decomposition is found. If no solution is found, `None` is returned.
