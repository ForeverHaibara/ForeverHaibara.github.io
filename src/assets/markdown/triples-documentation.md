# `sum_of_squares` Function Documentation

Detailed documentation for the main function of the 'triples' library.

The `sum_of_squares` function is the core utility for performing sum of squares decomposition on a given polynomial, potentially with constraints.

This function can also render math like $a^2 + b^2 = c^2$ and block math:

$$  \sum_{i=1}^{n} i = \frac{n(n+1)}{2}  $$

## Function Signature

```python
def sum_of_squares(
    poly: Union[sp.Poly, sp.Expr],
    ineq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    eq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    method_order: Optional[List[str]] = METHOD_ORDER,
    configs: Optional[Dict[str, Dict]] = DEFAULT_CONFIGS
) -> Optional[Solution]:
```

## Description

This is the main function for sum of square decomposition.

## Examples

### Basic Usage

The function relies on SymPy for symbolic computation. First, import necessary items:

```python
>>> from sympy.abc import x, y, a, b, c
>>> from sympy import Expr, Function
```

Call the function by passing in a SymPy polynomial or polynomial-like expression:

```python
>>> result = sum_of_squares(a**2+b**2+c**2-a*b-b*c-c*a)
```

The result will be `None` if the function fails. However, when the function fails
it does not mean the polynomial is non positive semidefinite or non sum-of-squares. It only
means the function could not find a solution.
If result is not `None`, it will be a solution class. To access the expression, use `.solution`:

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
or equality constraints. This should be the second and the third argument respectively. Here is
an example for the constraints $a,b,c \ge 0$:

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

>>> G = Function("G")
>>> sum_of_squares(x*(y-z)**2+y*(z-x)**2+z*(x-y)**2, {x:G(x),y:G(y),z:G(z)}).solution # doctest: +SKIP
Σ(x - y)**2*G(z)
```

## Parameters

<dl>
  <dt><code>poly: Union[sp.Poly, sp.Expr]</code></dt>
  <dd>The polynomial to perform SOS on.</dd>
  <dt><code>ineq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
  <dd>Inequality constraints to the problem. This assumes $g_1(x) \ge 0, g_2(x) \ge 0, \dots$</dd>
  <dt><code>eq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
  <dd>Equality constraints to the problem. This assumes $h_1(x) = 0, h_2(x) = 0, \dots$</dd>
  <dt><code>method_order: Optional[List[str]]</code> (optional, default: <code>METHOD_ORDER</code>)</dt>
  <dd>Specifies the order of methods to try for decomposition.</dd>
  <dt><code>configs: Optional[Dict[str, Dict]]</code> (optional, default: <code>DEFAULT_CONFIGS</code>)</dt>
  <dd>Configurations for different SOS methods.</dd>
</dl>

## Returns

**`Optional[Solution]`**

The solution. If no solution is found, `None` is returned. The `Solution` object contains details of the SOS decomposition.
