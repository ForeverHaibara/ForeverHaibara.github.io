# Sum of Squares

The `sum_of_squares` function is the core utility for performing sum of squares decomposition on a given expression, potentially with constraints.  It takes a symbolic expression (a SymPy `Expr`) and attempts to express it in sum of squares. This is a common technique to prove that the polynomial is nonnegative. The function can also handle problems with inequality and equality constraints.

## Function Signature

```python
def sum_of_squares(
    expr: "Expr",
    ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] = {},
    *,
    roots: Optional[List[Union[Tuple["Expr", ...], Dict["Symbol", "Expr"]]]] = None,
    verbose: bool = False,
    time_limit: float = 3600.0,
    methods: Optional[List[str]] = None,
    configs: Dict[str, Dict] = {},
    mode: str = 'fast',
    assumptions: bool = False,
    method_order: Optional[List[str]] = None
) -> Optional["Solution"]:
```

## Examples

The function relies on SymPy for symbolic computation. First, import necessary items:

```python
>>> from sympy.abc import x, y, a, b, c
>>> from sympy import Expr, Function
```

Call the function by passing in a SymPy expression:

```python
>>> result = sum_of_squares(a**2+b**2+c**2-a*b-b*c-c*a)
```

The result will be `None` if the function fails. However, when the function fails it does not mean the polynomial is non positive semidefinite or non sum-of-squares. It only means the function could not find a solution. If result is not `None`, it will be a solution class. To access the expression, use .solution:

```python
>>> print(isinstance(result.solution, Expr), result.solution) # doctest: +SKIP
True (Σ(a - b)**2)/2
```

The solution expression might involve `CyclicSum` and `CyclicProduct` classes, which are not native to SymPy, but defined in this package. The permutation groups are not displayed by default and might be sometimes misleading. To avoid ambiguity and to expand them, use `.doit()` on SymPy expressions:

```python
>>> result.solution.doit() # doctest: +SKIP
(-a + c)**2/2 + (a - b)**2/2 + (b - c)**2/2
```

### Constraints

If we want to add constraints for the domain of the variables, we can pass in a list of inequality or equality constraints. This should be the second and the third argument respectively. Here is an example for the constraints a,b,c >= 0:

```python
>>> sum_of_squares(a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b), [a,b,c]).solution # doctest: +SKIP
((Σ(a - b)**2*(a + b - c)**2)/2 + Σa*b*(a - b)**2)/(Σa)
```

If we want to track the constraints, we can also pass in a dictionary to imply the "name" of the constraints:

```python
>>> sum_of_squares(((a+2)*(b+2)*(c+2)*(a**2/(2+a)+b**2/(2+b)+c**2/(2+c)-1)).cancel(), [a,b,c], {a*b*c-1:x}).solution # doctest: +SKIP
x*(Σ(2*a + 13))/6 + Σa*(b - c)**2 + (Σa*b*(c - 1)**2)/6 + 5*(Σ(a - 1)**2)/6 + 7*(Σ(a - b)**2)/12

>>> sum_of_squares(x+y+z-(x*y+y*z+z*x), {x:x, y:y, z:z, 4-(x*y+y*z+z*x+x*y*z):a}).solution # doctest: +SKIP
(a*(Σ(x**2 + 2*x*y)) + Σx*y*(x - y)**2 + (Σx*y*z*(x - y)**2)/2)/(Σ(x*y*z + 4*x*y + 4*x))

>>> G = Function("G")
>>> sum_of_squares(x*(y-z)**2+y*(z-x)**2+z*(x-y)**2, {x:G(x),y:G(y),z:G(z)}).solution # doctest: +SKIP
Σ(x - y)**2*G(z)
```

### Assumptions (newly added in 0.2.0.dev)

Currently, all SymPy symbol assumptions are ignored by default and symbols are treated as real variables. To claim nonnegativity of symbols, just add them to `ineq_constraints`. Another option is to set `assumptions=True` to use the assumptions of SymPy symbols.

```python
>>> from sympy import Symbol
>>> _x = Symbol("x", positive=True)
>>> sum_of_squares(_x**2 + 3*_x + 1) is None
True
>>> sum_of_squares(_x**2 + 3*_x + 1, [_x]) is not None
True
>>> sum_of_squares(_x**2 + 3*_x + 1, assumptions=True) is not None
True
```

With `assumptions=True`, all variables are treated as complex variables unless they are assumed to be real.

```python
>>> sum_of_squares(abs(x**2-x+1)**2*4 - 1, [], [abs(x+1)**2 - 4],
... assumptions=True).solution # doctest: +SKIP
(4*re(x) - 3)**2*(839*re(x) + 284)**2/1912920 + 7*(4*re(x) - 3)**2*im(x)**2/15
+ 312*(4*re(x) - 3)**2/839 + (Abs(x + 1)**2 - 4)*(-2*re(x)**2 + re(x) + 22*im(x)**2/15 + 1)
+ (16*re(x)**2 - 11*re(x) + 76*im(x)**2 - 72)**2/2280
```

## Parameters

<dl>
  <dt><code>expr: "Expr"</code></dt>
  <dd>
    The expression to perform sum of squares on.
  </dd>

  <dt><code>ineq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] (default: <code>{}</code>)</code></dt>
  <dd>
    Inequality constraints to the problem. This assumes g_1(x) >= 0, g_2(x) >= 0, ...
  </dd>

  <dt><code>eq_constraints: Union[List["Expr"], Dict["Expr", "Expr"]] (default: <code>{}</code>)</code></dt>
  <dd>
    Equality constraints to the problem. This assumes h_1(x) = 0, h_2(x) = 0, ...
  </dd>

  <dt><code>roots: Optional[List[Union[Tuple["Expr", ...], Dict["Symbol", "Expr"]]]] (default: <code>None</code>)</code></dt>
  <dd>
    Equality cases of the expression. This saves the time for searching equality cases if provided.
  </dd>

  <dt><code>verbose: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to print information during the solving process. Defaults to False.
  </dd>

  <dt><code>time_limit: float (default: <code>3600.0</code>)</code></dt>
  <dd>
    The time limit (in seconds) for the solver. Defaults to 3600. When the time limit is reached, the solver is killed when it returns to the main loop. However, it might not be killed instantly if it is stuck in an internal function.
  </dd>

  <dt><code>methods: Optional[List[str]] (default: <code>None</code>)</code></dt>
  <dd>
    The methods to try.
  </dd>

  <dt><code>configs: Dict[str, Dict] (default: <code>{}</code>)</code></dt>
  <dd>
    The configurations for each method. It should be a dictionary containing the ProofNode classes as keys and the kwargs as values.
  </dd>

  <dt><code>mode: str (default: <code>'fast'</code>)</code></dt>
  <dd>
    Experimental. The mode of the solver. Defaults to 'fast'. Supports 'fast' and 'pretty'. If 'pretty', it traverses all methods and selects the most pretty solution.
  </dd>

  <dt><code>assumptions: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to use the assumptions of SymPy symbols. Defaults to False.
  </dd>

  <dt><code>method_order: Optional[List[str]] (default: <code>None</code>)</code></dt>
  <dd>
    DEPRECATED. Use methods instead.
  </dd>

</dl>

## Returns

**`Optional["Solution"]`**

Optional[Solution] The solution. If no solution is found, None is returned.