# CyclicSum

The `CyclicSum` class represents cyclic sums as symbolic expressions and
integrates them with SymPy's expression and simplification system.

## Class Definition

```python
class CyclicSum(CyclicExpr):
```

Represent cyclic sums.

## Examples

```python
>>> from sympy.abc import a, b, c, d, x, y, z
>>> from sympy.combinatorics import PermutationGroup, Permutation, SymmetricGroup
>>> CyclicExpr.PRINT_FULL = True
```

Every CyclicSum object is defined by an expression, a tuple of symbols, and a permutation group.

```python
>>> expr = CyclicSum(a*(b-c)**2, (a, b, c), PermutationGroup(Permutation([1,2,0]))); expr
CyclicSum(a*(b - c)**2, (a, b, c), PermutationGroup([
    (0 1 2)]))
```

Sums are simplified by choosing the lexicographically smallest representation of the summand and checking nested symmetries.

```python
>>> CyclicSum(z*y**2, (x, y, z), SymmetricGroup(3)) # doctest:+SKIP
CyclicSum(x*y**2, (x, y, z), PermutationGroup([
    (0 1 2),
    (2)(0 1)]))
>>> CyclicSum(a*b*CyclicSum(a, (a, b, c), SymmetricGroup(3)), (a, b, c), SymmetricGroup(3))
(CyclicSum(a, (a, b, c), PermutationGroup([
    (0 1 2),
    (2)(0 1)])))*(CyclicSum(a*b, (a, b, c), PermutationGroup([
    (0 1 2),
    (2)(0 1)])))
>>> CyclicSum(1, (a, b, c, d), SymmetricGroup(4))
24
```

SymPy expressions containing cyclic sums can be expanded by calling doit().

```python
>>> expr.doit()
a*(b - c)**2 + b*(-a + c)**2 + c*(a - b)**2
```

When the permutation group is not specified, it is assumed to be the cyclic group.

```python
>>> CyclicSum(a*(b-c+d)**2, (a, b, c, d)).doit()
a*(b - c + d)**2 + b*(a + c - d)**2 + c*(-a + b + d)**2 + d*(a - b + c)**2
```

When neither the symbols nor the permutation group is specified, it assumes the cyclic sum is with respect to (a, b, c) and the cyclic group.

```python
>>> CyclicSum(a**3*b**2*c).doit()
a**3*b**2*c + a**2*b*c**3 + a*b**3*c**2

>>> CyclicExpr.PRINT_FULL = False
```

## Attributes

<dl>
  <dt><code>precedence (default: <code>PRECEDENCE['Mul']</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>base_func (default: <code>Add</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

## Methods

### <span data-api-method-heading="true"><code>&#95;&#95;new&#95;&#95;</code></span>

```python
def __new__(
    cls,
    expr,
    *args,
    **kwargs
):
```

#### Parameters

<dl>
  <dt><code>expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>&#95;str&#95;latex</code></span>

```python
@classmethod
def _str_latex(
    cls,
    printer,
    expr
):
```

#### Parameters

<dl>
  <dt><code>printer</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>&#95;str&#95;str</code></span>

```python
@classmethod
def _str_str(
    cls,
    printer,
    expr
):
```

#### Parameters

<dl>
  <dt><code>printer</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>&#95;eval&#95;degenerate</code></span>

```python
@classmethod
def _eval_degenerate(
    cls,
    expr,
    perm_group: PermutationGroup
):
```

#### Parameters

<dl>
  <dt><code>expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>perm_group: PermutationGroup</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>&#95;eval&#95;simplify&#95;</code></span>

```python
@classmethod
def _eval_simplify_(
    cls,
    expr,
    symbols,
    perm_group: PermutationGroup
):
```

#### Parameters

<dl>
  <dt><code>expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>symbols</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>perm_group: PermutationGroup</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>as&#95;content&#95;primitive</code></span>

```python
def as_content_primitive(
    self,
    radical = False,
    clear = True
):
```

#### Parameters

<dl>
  <dt><code>radical (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>clear (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>