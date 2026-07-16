# Problem

`Problem` is the user-facing name for the `InequalityProblem` class. It stores
an inequality expression together with its inequality and equality constraints,
and provides the common transformations used by the Triples solver.

## Class Definition

```python
class InequalityProblem(Generic[T]):
```

Represents an inequality problem:

```python
Prove expr >= 0
    given {g >= 0 for g in ineq_constraints.keys()}
    and   {h == 0 for h in eq_constraints.keys()}.
```

## Attributes

<dl>
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

  <dt><code>counter_examples: Optional[RootList] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>solution: Optional[Expr] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>roots: Optional[RootList] (default: <code>None</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>REPR_LATEX_DELIM_L (default: <code>'$$'</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>REPR_LATEX_DELIM_R (default: <code>'$$'</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>REPR_LATEX_ALIGN_AT (default: <code>1</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>free_symbols: Set[Symbol]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>gens: Tuple[Symbol, ...]</code></dt>
  <dd>
    Returns an ordered tuple of symbols in <code>self.expr</code>, <code>self.ineq_constraints.keys()</code> and <code>self.eq_constraints.keys()</code>. Ordering rules: * If <code>self.expr</code> is polynomial, its generators come first in the original order. * Other free symbols are sorted in names.
  </dd>

  <dt><code>is_commutative: bool</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>is_polynomial: bool</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>is_convex: Optional[bool]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>is_homogeneous: bool</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

## Methods

### <span data-api-method-heading="true"><code>&#95;&#95;new&#95;&#95;</code></span>

```python
def __new__(
    cls,
    expr: T,
    ineq_constraints: Union[Dict[T, Expr], Iterable[T]] = {},
    eq_constraints: Union[Dict[T, Expr], Iterable[T]] = {}
):
```

#### Parameters

<dl>
  <dt><code>expr: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>ineq_constraints: Union[Dict[T, Expr], Iterable[T]] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eq_constraints: Union[Dict[T, Expr], Iterable[T]] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>new</code></span>

```python
@classmethod
def new(
    cls,
    expr: T,
    ineq_constraints: Dict[T, Expr] = {},
    eq_constraints: Dict[T, Expr] = {}
) -> "InequalityProblem":
```

Initialization of objects without sanity checks.

#### Parameters

<dl>
  <dt><code>expr: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>ineq_constraints: Dict[T, Expr] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eq_constraints: Dict[T, Expr] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

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

### <span data-api-method-heading="true"><code>&#95;repr&#95;latex&#95;</code></span>

```python
def _repr_latex_(
    self
):
```

---

### <span data-api-method-heading="true"><code>copy&#95;new</code></span>

```python
def copy_new(
    self,
    expr: T,
    ineq_constraints: Dict[T, Expr] = {},
    eq_constraints: Dict[T, Expr] = {}
) -> "InequalityProblem":
```

Return a new InequalityProblem with the given <code>expr</code>, <code>ineq_constraints</code> and <code>eq_constraints</code> while other attributes are copied from self.

#### Parameters

<dl>
  <dt><code>expr: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>ineq_constraints: Dict[T, Expr] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eq_constraints: Dict[T, Expr] (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

---

### <span data-api-method-heading="true"><code>copy</code></span>

```python
def copy(
    self
) -> "InequalityProblem":
```

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

---

### <span data-api-method-heading="true"><code>&#95;&#95;iter&#95;&#95;</code></span>

```python
def __iter__(
    self
):
```

This is convenient for <code>sum_of_squares(*self)</code>.

---

### <span data-api-method-heading="true"><code>reduce</code></span>

```python
def reduce(
    self,
    f: Callable[[T], Any],
    reduction: Callable[[Iterable[Any]], Any] = all
) -> Any:
```

Apply a function over self.expr, self.ineq_constraints.keys() and self.eq_constraints.keys(), and reduce them by a given rule. Defaults to "all".

#### Examples

```python
>>> from sympy.abc import a, b
>>> from sympy import Rational
>>> pro = InequalityProblem(5 - 3*a - 4*b, [a, b], [a**2 + b**2 - 1])
>>> pro.reduce(lambda x: x.is_Symbol)
False
>>> pro.reduce(lambda x: x.subs({a: Rational(3,5), b: Rational(4,5)}), list)
[0, 3/5, 4/5, 0]
```

#### Parameters

<dl>
  <dt><code>f: Callable[[T], Any]</code></dt>
  <dd>
    A function to apply over self.expr, self.ineq_constraints.keys() and self.eq_constraints.keys().
  </dd>

  <dt><code>reduction: Callable[[Iterable[Any]], Any] (default: <code>all</code>)</code></dt>
  <dd>
    A reduction function to apply over the results of f, by default "all".
  </dd>

</dl>

#### Returns

**`Any`**

Returns a `Any` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;is&#95;zero</code></span>

```python
def _dtype_is_zero(
    self,
    x: T
) -> Optional[bool]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Optional[bool]`**

Returns a `Optional[bool]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;convert</code></span>

```python
def _dtype_convert(
    self,
    x: T,
    y: Any
) -> T:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>y: Any</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`T`**

Returns a `T` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;free&#95;symbols</code></span>

```python
def _dtype_free_symbols(
    self,
    x: T
) -> Set[Symbol]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Set[Symbol]`**

Returns a `Set[Symbol]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;gens</code></span>

```python
def _dtype_gens(
    self,
    x: T
) -> Tuple[Symbol, ...]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple[Symbol, ...]`**

Returns a `Tuple[Symbol, ...]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;is&#95;homogeneous</code></span>

```python
def _dtype_is_homogeneous(
    self,
    x: T
) -> Optional[bool]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Optional[bool]`**

Returns a `Optional[bool]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;homogenize</code></span>

```python
def _dtype_homogenize(
    self,
    x: T,
    s: Symbol
) -> T:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>s: Symbol</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`T`**

Returns a `T` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;sqf&#95;list</code></span>

```python
def _dtype_sqf_list(
    self,
    x: T
) -> Tuple[Expr, List[Tuple[T, int]]]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple[Expr, List[Tuple[T, int]]]`**

Returns a `Tuple[Expr, List[Tuple[T, int]]]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;std&#95;ineq&#95;constraints</code></span>

```python
def _dtype_std_ineq_constraints(
    self,
    p: T,
    e: Expr
) -> Tuple[T, Expr]:
```

#### Parameters

<dl>
  <dt><code>p: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>e: Expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple[T, Expr]`**

Returns a `Tuple[T, Expr]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;std&#95;eq&#95;constraints</code></span>

```python
def _dtype_std_eq_constraints(
    self,
    p: T,
    e: Expr
) -> Tuple[T, Expr]:
```

#### Parameters

<dl>
  <dt><code>p: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>e: Expr</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple[T, Expr]`**

Returns a `Tuple[T, Expr]` object.

---

### <span data-api-method-heading="true"><code>&#95;dtype&#95;make&#95;reorder&#95;func</code></span>

```python
def _dtype_make_reorder_func(
    self,
    x: T,
    gens: Tuple[Symbol, ...]
) -> Callable[[Permutation], T]:
```

#### Parameters

<dl>
  <dt><code>x: T</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>gens: Tuple[Symbol, ...]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Callable[[Permutation], T]`**

Returns a `Callable[[Permutation], T]` object.

---

### <span data-api-method-heading="true"><code>extract&#95;constraints</code></span>

```python
def extract_constraints(
    self,
    symbols: Union[Symbol, List[Symbol]]
) -> Tuple[Dict[T, Expr], Dict[T, Expr], Dict[T, Expr], Dict[T, Expr]]:
```

Split constraints into those that contain given symbols and those that do not. Returns (contained_ineqs, contained_eqs, uncontained_ineqs, uncontained_eqs).

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> problem = InequalityProblem(a*b, [a, b, a*b, b+c], [a-1, b+c-1])
>>> problem.extract_constraints(a) # doctest: +NORMALIZE_WHITESPACE
({a: a, a*b: a*b},
 {a - 1: a - 1},
 {b: b, b + c: b + c},
 {b + c - 1: b + c - 1})
>>> problem.extract_constraints([b, c]) # doctest: +NORMALIZE_WHITESPACE
({b: b, a*b: a*b, b + c: b + c},
 {b + c - 1: b + c - 1},
 {a: a},
 {a - 1: a - 1})
```

#### Parameters

<dl>
  <dt><code>symbols: Union[Symbol, List[Symbol]]</code></dt>
  <dd>
    The symbols to split constraints by. It can be a symbol or an iterable of symbols.
  </dd>

</dl>

#### Returns

**`Tuple[Dict[T, Expr], Dict[T, Expr], Dict[T, Expr], Dict[T, Expr]]`**

Tuple[Dict[T, Expr], Dict[T, Expr], Dict[T, Expr], Dict[T, Expr]] (contained_ineqs, contained_eqs, uncontained_ineqs, uncontained_eqs)

---

### <span data-api-method-heading="true"><code>is&#95;of&#95;type</code></span>

```python
def is_of_type(
    self,
    dtype
) -> bool:
```

#### Parameters

<dl>
  <dt><code>dtype</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`bool`**

Returns a `bool` object.

---

### <span data-api-method-heading="true"><code>clear&#95;roots</code></span>

```python
def clear_roots(
    self
) -> "InequalityProblem[T]":
```

#### Returns

**`"InequalityProblem[T]"`**

Returns a `"InequalityProblem[T]"` object.

---

### <span data-api-method-heading="true"><code>clear&#95;counter&#95;examples</code></span>

```python
def clear_counter_examples(
    self
) -> "InequalityProblem[T]":
```

#### Returns

**`"InequalityProblem[T]"`**

Returns a `"InequalityProblem[T]"` object.

---

### <span data-api-method-heading="true"><code>clear&#95;solution</code></span>

```python
def clear_solution(
    self
) -> "InequalityProblem[T]":
```

#### Returns

**`"InequalityProblem[T]"`**

Returns a `"InequalityProblem[T]"` object.

---

### <span data-api-method-heading="true"><code>get&#95;symbol&#95;signs</code></span>

```python
def get_symbol_signs(
    self
) -> Dict[Symbol, Tuple[Optional[int], Expr]]:
```

#### Returns

**`Dict[Symbol, Tuple[Optional[int], Expr]]`**

Returns a `Dict[Symbol, Tuple[Optional[int], Expr]]` object.

---

### <span data-api-method-heading="true"><code>get&#95;features</code></span>

```python
def get_features(
    self
) -> Dict[str, Any]:
```

#### Returns

**`Dict[str, Any]`**

Returns a `Dict[str, Any]` object.

---

### <span data-api-method-heading="true"><code>evaluate&#95;complexity</code></span>

```python
def evaluate_complexity(
    self
) -> ProblemComplexity:
```

#### Returns

**`ProblemComplexity`**

Returns a `ProblemComplexity` object.

---

### <span data-api-method-heading="true"><code>sum&#95;of&#95;squares</code></span>

```python
def sum_of_squares(
    self,
    configs: dict = {}
):
```

#### Parameters

<dl>
  <dt><code>configs: dict (default: <code>{}</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

---

### <span data-api-method-heading="true"><code>polylize</code></span>

```python
def polylize(
    self,
    ineqs_sqf: bool = True,
    eqs_sqf: bool = True,
    field: bool = False,
    extension: bool = True,
    unify: bool = False
) -> "InequalityProblem":
```

#### Parameters

<dl>
  <dt><code>ineqs_sqf: bool (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>eqs_sqf: bool (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>field: bool (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>extension: bool (default: <code>True</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>unify: bool (default: <code>False</code>)</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

---

### <span data-api-method-heading="true"><code>remove&#95;redundancy</code></span>

```python
def remove_redundancy(
    self
) -> "InequalityProblem":
```

Remove redundant symbols and constraints. TODO: This function assumes redundant constraints are feasible in the current. This could change in the future.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> pro = InequalityProblem(a**4 - 3*a*b**3 + 2*b**4, [a, a - 2*b, c])
>>> pro.remove_redundancy().ineq_constraints
{a: a, a - 2*b: a - 2*b}
>>> pro = InequalityProblem(a - 4, [a - b, b, b**2 - c, c - 16])
>>> pro.remove_redundancy().ineq_constraints
{a - b: a - b, b: b, b**2 - c: b**2 - c, c - 16: c - 16}
```

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

---

### <span data-api-method-heading="true"><code>sqr&#95;free</code></span>

```python
def sqr_free(
    self,
    problem_sqf: bool = False,
    ineqs_sqf: bool = True,
    eqs_sqf: bool = True,
    inplace: bool = False
) -> Tuple["InequalityProblem", Expr]:
```

Try to make the problem square-free.

#### Examples

```python
>>> from sympy.abc import a, b, c, d, x, y, z
>>> pro = InequalityProblem(a*(b+2) + c + b*d, {a/(b + 2)**3: x, c*b**2: y}, {d**3: z})
>>> pro.sqr_free()[0].ineq_constraints
{a*(b + 2): x*(b + 2)**4, c: y/b**2}
>>> pro.sqr_free()[0].eq_constraints
{d: z**(1/3)}
```

The second argument is the square-free expression from `self.expr`.

```python
>>> pro = InequalityProblem((x - 2)**2*(x**2 - x + 1))
>>> pro.sqr_free(problem_sqf = True) # doctest: +NORMALIZE_WHITESPACE
(<InequalityProblem of 1 variables, with 0 inequality and 0 equality constraints>, x - 2)
>>> pro.sqr_free(problem_sqf = True)[0].expr
x**2 - x + 1
```

#### Parameters

<dl>
  <dt><code>problem_sqf: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to make the problem expression square-free. Default is False.
  </dd>

  <dt><code>ineqs_sqf: bool (default: <code>True</code>)</code></dt>
  <dd>
    Whether to make the inequalities square-free. Default is True.
  </dd>

  <dt><code>eqs_sqf: bool (default: <code>True</code>)</code></dt>
  <dd>
    Whether to make the equalities square-free. Default is True.
  </dd>

  <dt><code>inplace: bool (default: <code>False</code>)</code></dt>
  <dd>
    Whether to modify the problem in-place. Default is False.
  </dd>

</dl>

#### Returns

**`Tuple["InequalityProblem", Expr]`**

problem: InequalityProblem The square-free problem. sqr: Expr The expression such that <code>new_problem.expr * sqr**2 == problem.expr</code>.

---

### <span data-api-method-heading="true"><code>recompute&#95;constraints</code></span>

```python
def recompute_constraints(
    self
) -> "InequalityProblem":
```

Recompute the constraints from the symbol signs.

#### Returns

**`"InequalityProblem"`**

Returns a `"InequalityProblem"` object.

---

### <span data-api-method-heading="true"><code>homogenize</code></span>

```python
def homogenize(
    self,
    hom: Optional[Symbol] = None
) -> Tuple["InequalityProblem", Optional[Symbol]]:
```

Try to homogenize the problem.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> pro = InequalityProblem(1/(a**2 + 1) + 1/(b**2 + 1) - 1, [a, b], [a + b - 2])
>>> pro.homogenize()
(<InequalityProblem of 3 variables, with 3 inequality and 1 equality constraints>, 1)
>>> type(pro.homogenize()[1])
<class 'sympy.core.symbol.Symbol'>
>>> pro.homogenize()[0].expr
1**2/(1**2 + b**2) + 1**2/(1**2 + a**2) - 1
```

The homogenizer defaults to a Symbol named "1". It is also possible to use a customized Symbol object:

```python
>>> pro.homogenize(c)[0].expr
c**2/(b**2 + c**2) + c**2/(a**2 + c**2) - 1
```

#### Parameters

<dl>
  <dt><code>hom: Optional[Symbol] (default: <code>None</code>)</code></dt>
  <dd>
    The homogenizer symbol. * If None, a new symbol named "1" will be created if the problem is not homogeneous. * If given, it tries to homogenize the problem even if it is already homogeneous.
  </dd>

</dl>

#### Returns

**`Tuple["InequalityProblem", Optional[Symbol]]`**

problem: InequalityProblem The homogenized problem. hom: Symbol, optional The homogenizer symbol. None if no homogenizer is used.

---

### <span data-api-method-heading="true"><code>identify&#95;symmetry</code></span>

```python
def identify_symmetry(
    self
) -> PermutationGroup:
```

Try to identify the symmetry of the problem.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> pro = InequalityProblem(a**2*b+b**2*c+c**2*a-3, [a-1, b-1, c-1])
>>> pro.identify_symmetry().is_cyclic
True
>>> pro.gens
(a, b, c)
```

#### Returns

**`PermutationGroup`**

perm_group: PermutationGroup The problem is invariant up to the permutation group.

---

### <span data-api-method-heading="true"><code>wrap&#95;constraints</code></span>

```python
def wrap_constraints(
    self,
    symmetry: Optional[PermutationGroup] = None
) -> Tuple["InequalityProblem", Callable]:
```

Wrap the constraints of the problem by dummy functions.

#### Examples

Consider proving x >= 0 given x + y >= 1 and x**2 + y**2 == 1:

```python
>>> from sympy.abc import a, b, c, x, y
>>> pro = InequalityProblem(x, {x+y-1: x+y-1}, {x**2+y**2-1: x**2+y**2-1})
>>> newpro, restore = pro.wrap_constraints()
>>> newpro.ineq_constraints, newpro.eq_constraints
({x + y - 1: _G0(x, y)}, {x**2 + y**2 - 1: _H0(x, y)})
```

We can define the solution with G0 and H0 and restore it using the restoration function. However, restoration expands the brackets and might break the sum-of-squares structure.

```python
>>> G0, H0 = list(newpro.ineq_constraints.values())[0], list(newpro.eq_constraints.values())[0]
>>> sol = G0 - H0/2 + x**2/2 + (y-1)**2/2; sol
x**2/2 + (y - 1)**2/2 + _G0(x, y) - _H0(x, y)/2
>>> restore(sol)
x - y**2/2 + y + (y - 1)**2/2 - 1/2
>>> restore(sol).expand()
x
```

When symmetry is specified, the wrapper tries to exploit the symmetry.

```python
>>> pro = InequalityProblem(a+b+c, [2*a+b, 2*b+c, 2*c+a])
>>> pro.wrap_constraints()[0].ineq_constraints # doctest: +SKIP
{2*a + b: _G0(a, b), 2*b + c: _G1(b, c), a + 2*c: _G2(a, c)}

>>> from sympy.combinatorics import CyclicGroup
>>> pro.wrap_constraints(CyclicGroup(3))[0].ineq_constraints # doctest: +SKIP
{2*a + b: _G0(a, b), 2*b + c: _G0(b, c), a + 2*c: _G0(c, a)}
```

#### Parameters

<dl>
  <dt><code>symmetry: Optional[PermutationGroup] (default: <code>None</code>)</code></dt>
  <dd>
    The symmetry group of the problem.
  </dd>

</dl>

#### Returns

**`Tuple["InequalityProblem", Callable]`**

problem : InequalityProblem The problem with wrapped constraints. restoration : Callable A function to restore the expression from the wrapped expression.

---

### <span data-api-method-heading="true"><code>find&#95;roots</code></span>

```python
def find_roots(
    self
) -> RootList:
```

Find the equality cases of the problem heuristically.

#### Returns

**`RootList`**

Returns a `RootList` object.

---

### <span data-api-method-heading="true"><code>set&#95;roots</code></span>

```python
def set_roots(
    self,
    roots
) -> RootList:
```

Safely set the roots of the problem. Accepts multiple input types (None or list of tuples or list of dicts).

#### Parameters

<dl>
  <dt><code>roots</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`RootList`**

Returns a `RootList` object.

---

### <span data-api-method-heading="true"><code>transform</code></span>

```python
def transform(
    self,
    transform: Dict[Symbol, Expr],
    inv_transform: Dict[Symbol, Expr]
) -> Tuple["InequalityProblem", Callable]:
```

#### Examples

A manual approach to solve the IMO-1983 problem by Ravi substitution:

```python
>>> from sympy.abc import a, b, c, x, y, z
>>> from sympy import Function
>>> F = Function('F')
>>> problem = InequalityProblem(a**2*b*(a-b)+b**2*c*(b-c)+c**2*a*(c-a),{b+c-a:F(a),c+a-b:F(b),a+b-c:F(c)})
>>> new_pro, restore = problem.transform({a:y+z,b:z+x,c:x+y}, {x:(b+c-a)/2,y:(c+a-b)/2, z:(a+b-c)/2})
>>> new_pro.expr.expand(), new_pro.ineq_constraints # doctest: +NORMALIZE_WHITESPACE
(2*x**3*z - 2*x**2*y*z + 2*x*y**3 - 2*x*y**2*z - 2*x*y*z**2 + 2*y*z**3,
 {2*x: F(y + z), 2*y: F(x + z), 2*z: F(x + y)})

After we find a solution (sympy Expr) to the transformed problem, use `restore` to
transform it back to the original problem.
>>> sol = (-x + z)**2*F(x + y)*F(x + z)/2 + (x - y)**2*F(x + y)*F(y + z)/2 + (y - z)**2*F(x + z)*F(y + z)/2
>>> (sol.xreplace({F(y + z): 2*x, F(x + z): 2*y, F(x + y): 2*z}) - new_pro.expr).expand()
0
>>> restore(sol) # doctest: +SKIP
(-a + b)**2*F(a)*F(b)/2 + (a - c)**2*F(a)*F(c)/2 + (-b + c)**2*F(b)*F(c)/2
>>> (restore(sol).xreplace({F(a):b+c-a, F(b):c+a-b, F(c):a+b-c}) - problem.expr).expand()
0

Transformations should be birational if the problem is polynomial.
>>> from sympy import cbrt
>>> InequalityProblem(a**2).polylize().transform({a: cbrt(b)}, {b: a**3}) # doctest:+SKIP
Traceback (most recent call last):
...
PolynomialError: b**(2/3) contains an element of the set of generators.
```

#### Parameters

<dl>
  <dt><code>transform: Dict[Symbol, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

  <dt><code>inv_transform: Dict[Symbol, Expr]</code></dt>
  <dd>
    <!-- TODO: add description -->
  </dd>

</dl>

#### Returns

**`Tuple["InequalityProblem", Callable]`**

Returns a `Tuple["InequalityProblem", Callable]` object.

---

### <span data-api-method-heading="true"><code>marginalize</code></span>

```python
def marginalize(
    self,
    transform: Dict[Symbol, Expr],
    diff: Optional[Dict[Symbol, Expr]] = None
) -> Tuple["InequalityProblem", Callable]:
```

Substitute the variables in the problem with the new substitutions. Currently only work for polynomial problems.

#### Examples

```python
>>> from sympy.abc import a, b, c
>>> pro = InequalityProblem(a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b), [a,b,c]).polylize()
>>> pro2, restore = pro.marginalize({b: c}, {b: b - c})
>>> pro2.expr
Poly(a**3 - 2*a**2*c + a*c**2, a, c, domain='ZZ')
>>> pro2.ineq_constraints
{Poly(a, a, c, domain='ZZ'): a, Poly(c, a, c, domain='ZZ'): c}
>>> restore(a*(a - c)**2)
a*(a - c)**2 - (a - 2*c)*(b - c)**2 - (a**2 - a*c)*(b - c) + (b - c)**3
>>> restore(a*(a - c)**2).expand()
a**3 - a**2*b - a**2*c - a*b**2 + 3*a*b*c - a*c**2 + b**3 - b**2*c - b*c**2 + c**3
```

#### Parameters

<dl>
  <dt><code>transform: Dict[Symbol, Expr]</code></dt>
  <dd>
    The new substitutions applied to the variables.
  </dd>

  <dt><code>diff: Optional[Dict[Symbol, Expr]] (default: <code>None</code>)</code></dt>
  <dd>
    The difference between the old variables and the new substitutions if it is not omitted.
  </dd>

</dl>

#### Returns

**`Tuple["InequalityProblem", Callable]`**

problem : InequalityProblem The new problem with the variables substituted. restore : Callable The function to restore the solution to the original problem.

---

### <span data-api-method-heading="true"><code>formulate&#95;qcqp</code></span>

```python
def formulate_qcqp(
    self
) -> Optional[Tuple["QCQP", Callable]]:
```

Try to formulate self as a QCQP instance. If success, it returns the QCQP instance and the restoration function.

#### Returns

**`Optional[Tuple["QCQP", Callable]]`**

Returns a `Optional[Tuple["QCQP", Callable]]` object.