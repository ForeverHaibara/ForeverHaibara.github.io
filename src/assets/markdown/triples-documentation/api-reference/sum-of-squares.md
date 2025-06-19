
# Sum of Squares
 

The `sum_of_squares` function is the core utility for performing sum of squares decomposition on a given polynomial, potentially with constraints. 

## Function Signature

```python
def sum_of_squares(
    poly: Union[sp.Poly, sp.Expr],
    ineq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    eq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
) -> Optional[Solution]:
```

## Description

This is the main function for sum of square decomposition. It takes a symbolic polynomial (as a SymPy `Expr` or `Poly`) and attempts to express it as a sum of squares of other polynomials. This is a common technique to prove that the polynomial is non-negative. The function can also handle inequality and equality constraints.

## Examples

### Basic Usage

The function relies on SymPy for symbolic computation. First, import necessary items:

```python
>>> from sympy.abc import x, y, a, b, c
>>> from sympy import Expr, Function
# Assuming 'sum_of_squares' is importable from your library, e.g.:
# >>> from triples import sum_of_squares 
```

Call the function by passing in a SymPy polynomial or polynomial-like expression:

```python
>>> result = sum_of_squares(a**2+b**2+c**2-a*b-b*c-c*a)
```

The result will be `None` if the function fails to find a decomposition with its current methods. However, when the function fails
it does not mean the polynomial is non positive semidefinite or not a sum-of-squares. It only
means the function could not find a solution.
If result is not `None`, it will be a `Solution` class instance. To access the expression, use `.solution`:

```python
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
or equality constraints. This should be the second and the third argument respectively. Constraints are typically expressions that are assumed to be non-negative (for inequalities) or zero (for equalities).

Here is an example for the constraints $a,b,c \ge 0$:

```python
>>> sum_of_squares(a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b), [a,b,c]).solution # doctest: +SKIP
((Σ(a - b)**2*(a + b - c)**2)/2 + Σa*b*(a - b)**2)/(Σa)
```

If we want to track the constraints or use symbolic placeholders for them in the SOS decomposition (Positivstellensatz), we can also pass in a dictionary to imply the "name" (or multiplier) of the constraints:

```python
>>> sum_of_squares(((a+2)*(b+2)*(c+2)*(a**2/(2+a)+b**2/(2+b)+c**2/(2+c)-1)).cancel(), [a,b,c], {a*b*c-1:x}).solution # doctest: +SKIP
x*(Σ(2*a + 13))/6 + Σa*(b - c)**2 + (Σa*b*(c - 1)**2)/6 + 5*(Σ(a - 1)**2)/6 + 7*(Σ(a - b)**2)/12

>>> sum_of_squares(x+y+z-(x*y+y*z+z*x), {x:x, y:y, z:z, 4-(x*y+y*z+z*x+x*y*z):a}).solution # doctest: +SKIP
(a*(Σ(x**2 + 2*x*y)) + Σx*y*(x - y)**2 + (Σx*y*z*(x - y)**2)/2)/(Σ(x*y*z + 4*x*y + 4*x))

>>> G = Function("G") # G(v) represents a non-negative quantity if v is a constraint
>>> sum_of_squares(x*(y-z)**2+y*(z-x)**2+z*(x-y)**2, {x:G(x),y:G(y),z:G(z)}).solution # doctest: +SKIP
Σ(x - y)**2*G(z)
```

## Parameters

<dl>
  <dt><code>poly: Union[sp.Poly, sp.Expr]</code></dt>
  <dd>The polynomial (SymPy expression or Poly object) to perform SOS decomposition on.</dd>
  
  <dt><code>ineq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
  <dd>
    Inequality constraints for the problem. 
    If a list `[g1, g2, ...]` is provided, it's assumed $g_1 \ge 0, g_2 \ge 0, \dots$.
    If a dictionary `{g1: s1, g2: s2, ...}` is provided, $s_1, s_2, \dots$ are symbolic multipliers for $g_1, g_2, \dots$ in the SOS representation (useful for Positivstellensatz-based proofs).
  </dd>
  
  <dt><code>eq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
  <dd>
    Equality constraints for the problem. 
    If a list `[h1, h2, ...]` is provided, it's assumed $h_1 = 0, h_2 = 0, \dots$. These are typically incorporated into an ideal.
    If a dictionary `{h1: lambda1, h2: lambda2, ...}` is provided, $\lambda_1, \lambda_2, \dots$ are Lagrange-like multipliers.
  </dd>
   
</dl>

## Returns

**`Optional[Solution]`**

Returns a `Solution` object if a sum of squares decomposition is found. The `Solution` object typically contains:
- `solution`: The SymPy expression for the SOS form.
<!-- - `latex`: A LaTeX representation of the solutio
- `latex_aligned`: An aligned LaTeX representation.
- `success`: Boolean, `True` if successful.
- `error`: An error message string if applicable (e.g., if a method fails internally but doesn't mean a proof is impossible). -->

If no solution is found by any of the attempted methods, the function returns `None`.
