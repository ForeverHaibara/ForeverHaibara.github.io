# Solution

The `Solution` class is the result object returned by Triples solving routines.
It keeps the original problem, the proposed solution expression, and helpers
for checking, transforming, and formatting that result.

## Class Definition

```python
class Solution(SolutionBase[T]):
```

The `Solution` class is the standard return type of the `sum_of_squares` function.
It holds information about an inequality problem and its solution.
In a Jupyter notebook, it is displayed as a SymPy equation.

```python
>>> from sympy.abc import a
>>> from triples import sum_of_squares
>>> sol = sum_of_squares(a**2 - 2*a + 1)
>>> sol # doctest: +SKIP
Solution(problem = <InequalityProblem of 1 variables, with 0 inequality and 0 equality constraints>,
 solution = (a - 1)**2)
```

The problem expression and the solution can be accessed via `.expr` and `.solution` properties,
which are sympy objects.

```python
>>> sol.expr
a**2 - 2*a + 1
>>> sol.solution # doctest: +SKIP
(a - 1)**2
```

```python
>>> sol.time # doctest: +SKIP
0.014049
```

## Attributes

<dl>
  <dt><code>_start_time (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>_end_time (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>_is_equal (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>method (default: <code>''</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>expr: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>ineq_constraints: Dict[T, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eq_constraints: Dict[T, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>time: float</code></dt>
  <dd>
    Get the elapsed time for computing the solution. Return -1. if not registered.
  </dd>

  <dt><code>gens: Tuple[Symbol, ...]</code></dt>
  <dd>
    Get the free symbols of problem.
  </dd>

  <dt><code>is_equal: bool</code></dt>
  <dd>
    Verify whether the solution is correct. This is heuristic and might fail for hard cases or take a very long time. It is more suggested to verify the solution manually by sampling a few points.
  </dd>

  <dt><code>is_ill: bool</code></dt>
  <dd>
    Whether the solution is ill-defined, e.g. +oo, -oo, NaN, etc. This avoids bugs when encountering 0/0, etc.
  </dd>

  <dt><code>is_Exact: bool</code></dt>
  <dd>
    Whether the solution does not contain floating point numbers.
  </dd>

  <dt><code>numerator</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>multiplier</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>problem</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>solution</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

## Methods

### <span data-api-method-heading="true"><code>&#95;&#95;init&#95;&#95;</code></span>

```python
def __init__(
    self,
    problem: Optional[Union[InequalityProblem[T], T]] = None,
    solution: Optional[Expr] = None,
    ineq_constraints: Optional[Dict[T, Expr]] = None,
    eq_constraints: Optional[Dict[T, Expr]] = None,
    is_equal: Optional[bool] = None
):
```

#### Parameters

<dl>
  <dt><code>problem: Optional[Union[InequalityProblem[T], T]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>solution: Optional[Expr] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>ineq_constraints: Optional[Dict[T, Expr]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eq_constraints: Optional[Dict[T, Expr]] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>is_equal: Optional[bool] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>expr</code></span>

```python
@expr.setter
def expr(
    self,
    value: T
):
```

Bypass immutability: directly overwrite the problem expression; use with care.

#### Parameters

<dl>
  <dt><code>value: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>ineq&#95;constraints</code></span>

```python
@ineq_constraints.setter
def ineq_constraints(
    self,
    value: Dict[T, Expr]
):
```

Bypass immutability: directly overwrite the problem inequality constraints; use with care.

#### Parameters

<dl>
  <dt><code>value: Dict[T, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>eq&#95;constraints</code></span>

```python
@eq_constraints.setter
def eq_constraints(
    self,
    value: Dict[T, Expr]
):
```

Bypass immutability: directly overwrite the problem equality constraints; use with care.

#### Parameters

<dl>
  <dt><code>value: Dict[T, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>&#95;&#95;str&#95;&#95;</code></span>

```python
def __str__(
    self
) -> str:
```

#### Returns

**`str`**

Returns a `str` object.

---

### <span data-api-method-heading="true"><code>&#95;&#95;repr&#95;&#95;</code></span>

```python
def __repr__(
    self
) -> str:
```

#### Returns

**`str`**

Returns a `str` object.

---

### <span data-api-method-heading="true"><code>copy</code></span>

```python
def copy(
    self
) -> "Solution":
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>&#95;str&#95;f</code></span>

```python
def _str_f(
    self,
    name = 'f'
) -> str:
```

#### Parameters

<dl>
  <dt><code>name (default: <code>'f'</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`str`**

Returns a `str` object.

---

### <span data-api-method-heading="true"><code>as&#95;eq</code></span>

```python
def as_eq(
    self,
    lhs_expr = None,
    together = False,
    cancel = False
) -> Equality:
```

Convert the solution to a sympy equality object.

#### Examples

```python
>>> from sympy.abc import a
>>> sol = Solution(a**2 - 2 + 1/a**2, (a**2 - 1)**2/a**2)
>>> sol.as_eq()
Eq(a**2 - 2 + a**(-2), (a**2 - 1)**2/a**2)
>>> sol.as_eq().lhs, sol.as_eq().rhs
(a**2 - 2 + a**(-2), (a**2 - 1)**2/a**2)
>>> sol.as_eq().simplify()
True
>>> sol.as_eq(cancel=True)
Eq(a**2*(a**2 - 2 + a**(-2)), (a**2 - 1)**2)

>>> from sympy import Function
>>> f = Function('f')
>>> sol.as_eq(lhs_expr=f(a), cancel=True)
Eq(a**2*f(a), (a**2 - 1)**2)
```

#### Parameters

<dl>
  <dt><code>lhs_expr (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>together (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>cancel (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Equality`**

Returns a `Equality` object.

---

### <span data-api-method-heading="true"><code>as&#95;sos&#95;list</code></span>

```python
def as_sos_list(
    self
) -> Optional[SOSlist]:
```

#### Returns

**`Optional[SOSlist]`**

Returns a `Optional[SOSlist]` object.

---

### <span data-api-method-heading="true"><code>as&#95;psatz</code></span>

```python
def as_psatz(
    self
) -> Optional[PSatz]:
```

#### Returns

**`Optional[PSatz]`**

Returns a `Optional[PSatz]` object.

---

### <span data-api-method-heading="true"><code>to&#95;string</code></span>

```python
def to_string(
    self,
    mode: str = 'latex',
    lhs_expr = None,
    together = False,
    cancel = False,
    settings = None
) -> str:
```

Convert the solution to a string. The mode can be 'latex', 'txt', or 'formatted'.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> sol = Solution(a**2 + a*b + b**2, (a + b/2)**2 + 3*b**2/4)
>>> sol.to_string()  # doctest: +SKIP
'a^{2} + a b + b^{2} = \frac{3 b^{2}}{4} + \frac{\left(2 a + b\right)^{2}}{4}'
>>> sol.to_string(mode = 'txt')  # doctest: +SKIP
'a² + ab + b² = 3b²/4 + (2a + b)²/4'

>>> from sympy import Function
>>> F = Function('F')
>>> sol.to_string(mode = 'txt', lhs_expr=F(a,b))  # doctest: +SKIP
'F(a, b) = 3b²/4 + (2a + b)²/4'
```

#### Parameters

<dl>
  <dt><code>mode: str (default: <code>'latex'</code>)</code></dt>
  <dd>
    The mode of the string, by default 'latex'. 'latex': Convert to latex string. 'txt': Convert to plain text string. 'formatted': Convert to formatted string where "s" and "p" stands for cyclic sum and cyclic product, respectively. This is not safe when the symbols contain s or p.
  </dd>

  <dt><code>lhs_expr (default: <code>None</code>)</code></dt>
  <dd>
    Sympy expressions to replace the left-hand side problem.
  </dd>

  <dt><code>together (default: <code>False</code>)</code></dt>
  <dd>
    Whether to apply <code>sympy.together</code> on the right-hand side solution.
  </dd>

  <dt><code>cancel (default: <code>False</code>)</code></dt>
  <dd>
    Whether to apply <code>sympy.cancel</code> on the right-hand side solution.
  </dd>

  <dt><code>settings (default: <code>None</code>)</code></dt>
  <dd>
    Settings for printing. See <code>sympy.printing.str.StrPrinter._print</code> for details.
  </dd>

</dl>

#### Returns

**`str`**

Returns a `str` object.

---

### <span data-api-method-heading="true"><code>&#95;repr&#95;latex&#95;</code></span>

```python
def _repr_latex_(
    self
):
```

---

### <span data-api-method-heading="true"><code>together</code></span>

```python
def together(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>together</code> on it. See also: sympy.together.

#### Examples

```python
>>> from sympy.abc import a, b
>>> sol = Solution(a**2 - a*b + b**2, (a + b/2)**2 + 3*b**2/4)
>>> sol.solution
3*b**2/4 + (a + b/2)**2
>>> sol.together().solution
(3*b**2 + (2*a + b)**2)/4
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>signsimp</code></span>

```python
def signsimp(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>signsimp</code> on it. See also: sympy.signsimp.

#### Examples

```python
>>> from sympy.abc import a, b
>>> sol = Solution(a**2 - 2*a*b + b**2, (-a - b)**2)
>>> sol.solution
(-a - b)**2
>>> sol.signsimp().solution
(a + b)**2
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>xreplace</code></span>

```python
def xreplace(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>xreplace</code> on it. See also: sympy.xreplace.

#### Examples

```python
>>> from sympy.abc import a, b, x
>>> sol = Solution(a**2 - 2*a*b + b**2, (a - b)**2)
>>> sol.xreplace({a: x}).solution
(-b + x)**2
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>doit</code></span>

```python
def doit(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply doit on it. This is useful to expand cyclic expressions. See also: sympy.doit.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> from triples.utils import CyclicSum
>>> sol = Solution((a+b+c)*(a*b+b*c+c*a)-9*a*b*c, CyclicSum(a*(b-c)**2, (a,b,c)))
>>> sol.solution
Σ(a*(b - c)**2)
>>> sol.doit().solution
a*(b - c)**2 + b*(-a + c)**2 + c*(a - b)**2
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>collect</code></span>

```python
def collect(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>collect</code> on it. See also: sympy.collect.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> sol = Solution((a+b**2+c)*(b-c)**2, a*(b-c)**2 + b**2*(b-c)**2 + c*(b-c)**2)
>>> sol.solution
a*(b - c)**2 + b**2*(b - c)**2 + c*(b - c)**2
>>> sol.collect((b-c)**2).solution
(b - c)**2*(a + b**2 + c)
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>n</code></span>

```python
def n(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>n</code> on it. See also: sympy.n.

#### Examples

```python
>>> from sympy.abc import a, b
>>> from sympy import sqrt
>>> sol = Solution(a**2+a*b+b**2, (((2-sqrt(3))*a+b)**2+((2-sqrt(3))*b+a)**2)/(8-4*sqrt(3)))
>>> sol.n(4).solution
0.933*(0.2679*a + b)**2 + 0.933*(a + 0.2679*b)**2
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>evalf</code></span>

```python
def evalf(
    self,
    *args,
    **kwargs
) -> "Solution":
```

Make a copy of the solution and apply <code>evalf</code> on it. See also: sympy.evalf.

#### Examples

```python
>>> from sympy.abc import a, b
>>> from sympy import sqrt
>>> sol = Solution(a**2+a*b+b**2, (((2-sqrt(3))*a+b)**2+((2-sqrt(3))*b+a)**2)/(8-4*sqrt(3)))
>>> sol.evalf(4).solution
0.933*(0.2679*a + b)**2 + 0.933*(a + 0.2679*b)**2
```

#### Returns

**`"Solution"`**

Returns a `"Solution"` object.

---

### <span data-api-method-heading="true"><code>as&#95;expr</code></span>

```python
def as_expr(
    self,
    *args,
    **kwargs
) -> Expr:
```

Return the solution as an expression. It is equivalent to .solution.

#### Returns

**`Expr`**

Returns a `Expr` object.

---

### <span data-api-method-heading="true"><code>dehomogenize</code></span>

```python
def dehomogenize(
    self,
    homogenizer: Optional[Symbol] = None
):
```

Dehomogenize the solution. Used internally.

#### Parameters

<dl>
  <dt><code>homogenizer: Optional[Symbol] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>as&#95;fraction</code></span>

```python
def as_fraction(
    self,
    together = True,
    inplace = False
):
```

Denest the fractions and express the solution as the division of two fraction-free expressions.

#### Examples

```python
>>> from sympy.abc import a, b
>>> sol = Solution(a**2 - 2 + 1/a**2, (a**2 - 1)**2/a**2)
>>> sol.as_fraction()
((a**2 - 1)**2, a**2)
```

#### Parameters

<dl>
  <dt><code>together (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>inplace (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>rewrite&#95;symmetry</code></span>

```python
def rewrite_symmetry(
    self,
    symbols: Optional[Tuple[Symbol, ...]] = None,
    perm_group: Optional[PermutationGroup] = None
) -> "Solution":
```

Rewrite the expression heuristically with respect to the given permutation group. After rewriting, it is expected all cyclic expressions are expanded or in the given permutation group. This avoids the ambiguity of the cyclic expressions. It makes a copy of the solution and applies the rewriting on it. Note that the rewriting is not reversible if cyclic expressions are expanded. If this method is to be called multiple times, it is recommended to call on the original solution.

#### Parameters

<dl>
  <dt><code>symbols: Optional[Tuple[Symbol, ...]] (default: <code>None</code>)</code></dt>
  <dd>
    The symbols that the permutation group acts on.
  </dd>

  <dt><code>perm_group: Optional[PermutationGroup] (default: <code>None</code>)</code></dt>
  <dd>
    Sympy permutation group object. Defaults to the CyclicGroup if not given.
  </dd>

</dl>

#### Returns

**`"Solution"`**

Solution A new solution object with the rewritten expression. See also ---------- rewrite_symmetry