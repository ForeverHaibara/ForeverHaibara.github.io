# SymPy

The triples library is built on top of SymPy. 
SymPy is an open source Python library for symbolic mathematics. It provides a set of tools for working with mathematical objects, e.g., symbols, expressions and polynomials.

This page is a very brief, unofficial introduction to SymPy, for users who are not familiar with it.

See also:
- [SymPy Documentation](https://docs.sympy.org/latest/index.html)
- [SymPy Tutorial](https://docs.sympy.org/latest/tutorial/index.html)
- [SymPy GitHub](https://github.com/sympy/sympy)


<br>

## Installation

To install SymPy, you can use `pip`:
```
pip install sympy
```
And a Python script should import SymPy by:
```python
import sympy as sp
```

<br>

## Usage

### Sympify

A Python string / integer / float can be converted to a SymPy expression by `sp.sympify`.
```python
>>> sp.sympify("a")
a
>>> sp.sympify("1/2+3/5")
11/10
>>> sp.sympify("2*(x+1)^2 - 4") + 6
2*(x + 1)**2 + 2
```

It is important to note that Python uses "**" for exponentiation, rather than "^".

<br>

Typically, division of Python integers gives a float. This might be different from
other computer algebra systems, e.g., Mathematica. To avoid this, use SymPy to
convert the integers to SymPy integers, which uses symbolic computation:
```
>>> 1/7
0.14285714285714285
>>> sp.sympify(1)/7
1/7
>>> sp.sympify('1/7')
1/7
>>> sp.Rational(1, 7)
1/7
```

<br>

### Simplification

An expression can be simplified by calling various methods: `.factor()`, `.expand()`,
`.together()`, `.cancel()`, `.simplify()`, etc. It is also equivalent to calling
`sp.factor(...)`, `sp.expand(...)`, etc.

* `.factor()`: factorize an expression.
* `.expand()`: expand an expression.
* `.together()`: combine the denominators of fractions.
* `.cancel()`: cancel common factors in a fraction.
* `.simplify()`: simplify an expression. This is powerful by employing many heuristics, but is also slower.

```python
>>> a = sp.sympify('a')
>>> b = sp.sympify('b')
>>> c = sp.sympify('c')
>>> expr = (a**2+b**2+c**2)**2 - (a**4+b**4+c**4)*2
>>> expr
-2*a**4 - 2*b**4 - 2*c**4 + (a**2 + b**2 + c**2)**2
>>> expr.expand()
-a**4 + 2*a**2*b**2 + 2*a**2*c**2 - b**4 + 2*b**2*c**2 - c**4
>>> expr.factor()
-(a - b - c)*(a - b + c)*(a + b - c)*(a + b + c)
>>> sp.factor(expr)
-(a - b - c)*(a - b + c)*(a + b - c)*(a + b + c)
```

```python
>>> (1/(a - 1) - 1/a - 1/a/(a + 1)).together()
(a*(a + 1) - a - (a - 1)*(a + 1) + 1)/(a*(a - 1)*(a + 1))
>>> ((a**3 - a)/(a**4 - 3*a + 2)).cancel()
(a**2 + a)/(a**3 + a**2 + a - 2)
>>> ((a**3 - a)/(a**4 - 3*a + 2)).factor()
a*(a + 1)/(a**3 + a**2 + a - 2)
>>> (b**2/(a-sp.sqrt(a**2-b**2)) - (a+sp.sqrt(a**2-b**2))).simplify()
0
>>> (sp.sin(a)**2 + sp.cos(a)**2).simplify() == 1
True
```

#### Substitution and Evaluation

To replace some symbols in an expression, use `.subs(...)` or `.xreplace(...)`.
The former checks matches more carefully and is also slower.

```python
>>> expr = (a + b)**2 + 3*c**3
>>> expr.subs({a: 1, b: 2, c: 3})
90
>>> (a*sp.sqrt(b)/3 + b).xreplace({sp.sqrt(b): c + 1})
a*(c + 1)/3 + b
>>> (a*sp.sqrt(b)/3 + b).subs({sp.sqrt(b): c + 1})
a*(c + 1)/3 + (c + 1)**2
```

Use `.n()` to numerically evaluate the expression at a given precision.

```python
>>> (sp.sqrt(2)*a + b*sp.log(2)).n(15)
1.4142135623731*a + 0.693147180559945*b
```

<br>

### Polynomial

One of the most important features of SymPy is the `Poly` class. A SymPy object
can be converted to `Poly` by `.as_poly()` (it does not work if the expression
is not polynomial, e.g., fractional or transcendental).

After that, it is possible to access
the monomials and coefficients by `.monoms()` and `.coeffs()`, respectively, or
`.terms()` or `.as_dict()`.

* `.monoms()`: return the monomials of the polynomial.
* `.coeffs()`: return the coefficients of the polynomial.
* `.terms()`: return the terms of the polynomial, as a list of pairs `(coeff, monom)`.
* `.as_dict()`: return the polynomial as a dictionary `{monom: coeff}`.
* `.total_degree()`: return the total degree of the polynomial.
* `.as_expr()`: convert the polynomial back to a SymPy expression.
* `.gens`: return the generators (symbols) of the polynomial.

```python
>>> expr = (a + b)**2 + 3*c**3
>>> poly = expr.as_poly()
>>> poly
Poly(a**2 + 2*a*b + b**2 + 3*c**3, a, b, c, domain='ZZ')
>>> poly.monoms()
[(2, 0, 0), (1, 1, 0), (0, 2, 0), (0, 0, 3)]
>>> poly.coeffs()
[1, 2, 1, 3]
>>> poly.terms()
[((2, 0, 0), 1), ((1, 1, 0), 2), ((0, 2, 0), 1), ((0, 0, 3), 3)]
>>> poly.as_dict()
{(2, 0, 0): 1, (1, 1, 0): 2, (0, 2, 0): 1, (0, 0, 3): 3}
>>> poly.total_degree()
3
>>> poly.as_expr()
a**2 + 2*a*b + b**2 + 3*c**3
>>> poly.gens
(a, b, c)
>>> poly(1,2,3) # evaluate the polynomial at (1,2,3)
90
```

It is also possible to build the polynomial on
specified generators:

```python
>>> ((a+b)*(b+c)*(c+a)).as_poly((a, b))
Poly(a**2*b + c*a**2 + a*b**2 + 2*c*a*b + c**2*a + c*b**2 + c**2*b, a, b, domain='ZZ[c]')
>>> ((a+b)*(b+c)*(c+a)).as_poly(a)
Poly((b + c)*a**2 + (b**2 + 2*b*c + c**2)*a + b**2*c + b*c**2, a, domain='ZZ[b,c]')
>>> ((a+b)*(b+c)*(c+a)).as_poly(a).terms()
[((2,), b + c), ((1,), b**2 + 2*b*c + c**2), ((0,), b**2*c + b*c**2)]
```
#### Building Polynomial from Other Types

`Poly` can also be built from Python lists (for univariate polynomials) or dicts.

```python
>>>  sp.Poly([1, 2, sp.Rational(3,4)], sp.sympify('x'))
Poly(x**2 + 2*x + 3/4, x, domain='QQ')
>>> sp.Poly({(4,5): 3, (2, 3): -1}, sp.sympify('x'), sp.sympify('y'))
Poly(3*x**4*y**5 - x**2*y**3, x, y, domain='ZZ')
```

#### Polynomial Arithmetic

The `Poly` class supports various polynomial operations. More details can be found in the [SymPy Polys Reference](https://docs.sympy.org/latest/modules/polys/reference.html). Here we only list a few:
* `.factor_list()`: factorize the polynomial. Note that `Poly` does not have `.factor()` method.
* `.all_roots()`: return all roots of a univariate polynomial. It will return `CRootOf` class for cubic or higher-degree cases.
* `.discriminant()`: compute the discriminant of a univariate polynomial.
* `sp.groebner()`: compute the Groebner basis of a list of polynomials.
* `sp.resultant()`: compute the resultant of two polynomials.

```python
>>> x = sp.Symbol('x')
>>> y = sp.Symbol('y')
>>> sp.Poly([1, 2, sp.Rational(3,4)], x).factor_list()
(1/4, [(Poly(2*x + 1, x, domain='QQ'), 1), (Poly(2*x + 3, x, domain='QQ'), 1)])
>>> sp.Poly([1, 2, sp.Rational(3,4)], x).all_roots()
[-3/2, -1/2]
>>> sp.Poly([1, 2, sp.Rational(3,4)], x).discriminant()
1
>>> sp.groebner([x*y - 2*y, 2*y**2 - x**2])
GroebnerBasis([x**2 - 2*y**2, x*y - 2*y, y**3 - 2*y], x, y, domain='ZZ', order='lex')
>>> sp.resultant(x*y - 2*y, 2*y**2 - x**2, y)
-x**4 + 4*x**3 - 4*x**2
```

<br>


### Expression Tree

The expression tree is a data structure that represents a SymPy symbolic
expression. Most algebraic expressions involve `sp.Symbol`,
`sp.Rational`, `sp.Add`, `sp.Mul`, `sp.Pow` as nodes. The children of an
expression node is stored in the `.args` property.

```python
>>> expr = 4*sp.sqrt(x - y) + 2*(y + x)**2/3/(x + 1) - 5
>>> isinstance(expr, sp.Add)
True
>>> expr.is_Add
True
>>> expr.args
(-5, 4*sqrt(x - y), 2*(x + y)**2/(3*(x + 1)))
>>> expr.args[2]
2*(x + y)**2/(3*(x + 1))
>>> isinstance(expr.args[2], sp.Mul) # or expr.args[2].is_Mul
True
>>> expr.args[2].args
(2/3, 1/(x + 1), (x + y)**2)
>>> isinstance(expr.args[2].args[0], sp.Rational) # or (...).is_Rational
True
>>> isinstance(expr.args[2].args[1], sp.Pow) # or (...).is_Pow
True
>>> expr.args[2].args[1].args # (1/(x + 1)).args
(x + 1, -1)
>>> (1/(x + 1)).args[0].args[1]
x
>>> isinstance((1/(x + 1)).args[0].args[1], sp.Symbol) # or (...).is_Symbol
True
```

In the above example, we have seen how a typical SymPy expression is built
(by composition of `sp.Symbol`, `sp.Rational`, `sp.Add`, `sp.Mul`, `sp.Pow`).
This allows us to access the components of an expression easily.
