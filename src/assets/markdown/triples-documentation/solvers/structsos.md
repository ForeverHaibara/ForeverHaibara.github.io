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

## Examples

StructuralSOS uses an expert system to solve inequalities in specific structures. Many classical Olympiad-level ternary symmetric or cyclic inequalities are supported.

```python
>>> from triples import StructuralSOS, CyclicSum
>>> from sympy.abc import a, b, c
>>> sol = StructuralSOS(a**4*(a-b)*(a-c)+b**4*(b-c)*(b-a)+c**4*(c-a)*(c-b)
... -5*(a-b)**2*(b-c)**2*(c-a)**2, [a,b,c])
>>> sol.solution # doctest:+SKIP
4*((Σ(a**2*(a - b)*(a - c)))**2/4 + (Σ(a**2*(b - c)**2*(a**2 - 2*a*b - 2*a*c + b**2 + 2*b*c + c**2)**2))/8
+ (Σ(a*b*(a - b)**2*(a**2 - 2*a*b + 2*a*c + b**2 + 2*b*c - 3*c**2)**2))/4)/(Σ(a**2))
```

StructuralSOS uses very fast (but incomplete) algorithms, and extends to high-degree or high-dimensional problems in some cases.

```python
>>> sol = StructuralSOS(a**30*(a-b)*(a-c)+b**30*(b-c)*(b-a)+c**30*(c-a)*(c-b), [a,b,c])
>>> sol is not None
True
>>> sol.time # doctest:+SKIP
0.191594
```

Sometimes StructuralSOS better handles problems with ill-conditioned or irrational coefficients than other numerical algorithms.

```python
>>> from sympy import sqrt
>>> sol = StructuralSOS(CyclicSum(a**3-a**2*b + (sqrt(13+16*sqrt(2))-1)/2*a*b*(b-a),
... (a,b,c)), [a,b,c])
>>> sol.solution # doctest:+SKIP
(2*(∏(a))*(Σ((a - b)**2)) + (Σ(a*(14*b**2 + b*(-a + c)*(-3*sqrt(13 + 16*sqrt(2))
+ 7 + sqrt(2)*sqrt(13 + 16*sqrt(2)) + 7*sqrt(2)) - 14*c**2 + c*(a - b)*(
-sqrt(2)*sqrt(13 + 16*sqrt(2)) + 7 + 7*sqrt(2) + 3*sqrt(13 + 16*sqrt(2))))**2))/98)/(2*(Σ(a*b)))
```

However, StructuralSOS is not a complete solver and it does not solve general inequality problems. It only provides a quick check to see whether a problem can be easily solved.

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