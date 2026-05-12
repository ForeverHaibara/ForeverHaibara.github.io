# Limitations

There are things that the triples library can do and things it cannot.

<font color="red">It should always be noted that
the solver could **FAIL** even if the problem is correct.</font>   

## Nonalgebraic Inequalities

Inequalities are a very large concept in mathematics. Below lists some types of inequalities that the `sum_of_squares` function cannot handle. A few of them might be supported in the future, but not now.

* Infinite-term inequalities: $\frac{1}{n}\sum_{i=1}^n a_i^2\geq \sqrt[n]{\prod_{i=1}^n a_i^2}$.
* Functional inequalities: $\int_0^1 f'^2(x)dx\geq \frac{\pi^2}{4}\int_0^1f^2(x)dx$, $f(0)=0$.
* Transcendental inequalities: $e^x - x-1\geq 0$.
* Comparison of constants: $\pi < 22/7$.
* Algebra beyond real numbers: $\text{tr}(ABB^\top A^\top)\geq 0$.
* Number theory or combinatorics: $\text{liminf}\ (p_{n+1}-p_n)<7\times 10^7$.

<br>

## Limitations of Sum-of-Squares

Not every nonnegative multivariate polynomial can be represented as sum of squares of polynomials. The most renowned example is perhaps the Motzkin's form:

$$
x^4y^2+x^2y^4+z^6-3x^2y^2z^2\geq 0.
$$

The polynomial is clearly nonnegative by using the AM-GM inequality:

$$
x^4y^2+x^2y^4+z^6\geq 3\sqrt[3]{x^4y^2\cdot x^2y^4\cdot z^6} =3 x^2y^2z^2.
$$

However, $x^4y^2+x^2y^4+z^6-3x^2y^2z^2$ cannot be written as sum of squares of real polynomials.
To prove its nonnegativity via sum-of-squares, it can be written as a quotient of two nonnegative expressions:

$$
\begin{aligned} x^4y^2+x^2y^4+z^6-3x^2y^2z^2   =\frac{ x^{2} y^{2} \left(x^{2} + y^{2} - 2 z^{2}\right)^{2} + z^{2} \left(x^{2} \left(y^{2} - z^{2}\right)^{2} + y^{2} \left(x^{2} - z^{2}\right)^{2}\right)}{x^2+y^2}.\end{aligned}
$$

<br>

### Non-deterministic Results

A sum-of-squares proof is not unique. For example, there are multiple ways to show $\sum_{\text{cyc}} a(a-b)(a-c)\geq 0$ for $a,b,c\in\mathbb {R}_+$:

$$
\sum_{\text{cyc}} a(a-b)(a-c)
=\frac{ \sum_{\text{cyc}} [(b-c)^2(b+c-a)^2+2 bc(b-c)^2]}{2\sum_{\text{cyc}} a}
=\frac{2\sum_{\text{cyc}} a(a-b)^2(a-c)^2}{\sum_{\text{cyc}} (b-c)^2}
=\frac{\sum_{\text{cyc}} bc(b^2-c^2)^2}{\prod_{\text{cyc}} (b+c)}.
$$

It is hard to define the best or the most beautiful sum-of-squares solution, and the sum-of-squares solution might vary across different versions of the library and platforms.


<br>

### Wrong Conclusions

Sometimes an expression is not nonnegative although we can write it as a rational function of sum of nonnegative expressions.

**Example 1** Consider proving $-1\geq 0$ given constraints $x-y^2+3\geq 0$ and $y+x^2+2=0$. It seems impossible but:

$$
-1 = -10(y+x^2+2)+2(x-y^2+3) + \frac{1}{10}(10x-1)^2+\frac{1}{2} (2y + 5)^2+\frac{2}{5}\geq 0.
$$

However, the conclusion $-1\geq 0$ is incorrect because the set $\{x-y^2+3\geq 0,\ y+x^2+2=0\}$ is empty. In fact, the above
equation is a proof that the set is empty. This is related to the Hilbert's Nullstellensatz.

<br>

**Example 2** Consider proving $a\geq 0$ given constraints $ab\geq 0$ and $b\geq 0$. At first glance, it seems that

$$
a = \frac{ab}{b}\geq 0,
$$

as it is the quotient of two nonnegative expressions. However, it is wrong when $b = 0$. Actually,
$(a,b)=(-1,0)$ is a counterexample to the problem.

In some cases the `sum_of_squares` function outputs such
sum-of-squares expressions, but its nonnegativity should be more carefully examined. Other tools such as CAD (cylindrical algebraic decomposition) may be more suitable for such cases.

<br>

### No Simplification Assumptions

Consider the Schur inequality $a,b,c\in\R_+\implies \sum_{\text{cyc}}a(a-b)(a-c)\geq 0$. As shown 
above, the polynomial must be lifted to degree 4 to obtain a sum-of-squares proof:
$$
\sum_{\text{cyc}} a(a-b)(a-c)
=\frac{ \sum_{\text{cyc}} [(b-c)^2(b+c-a)^2+2 bc(b-c)^2]}{2\sum_{\text{cyc}} a}\geq 0.
$$
However, if we assume $a\geq b\geq c\geq 0$ by symmetry, there is no need to lift the degree:
$$
\sum_{\mathrm{cyc}} a \left(a - b\right) \left(a - c\right) = \frac{3 c \left(b - c\right)^{2}}{4} + \frac{c \left(2 a - b - c\right)^{2}}{4} + \left(a - b\right)^{3} + 2 \left(a - b\right)^{2} \left(b - c\right)\geq 0.
$$

Some algorithms introduce order assumptions to simplify the problem, e.g., the branch-and-bound and the successive difference substitution (SDS) algorithms. However, the triples solver does not introduce such extra assumptions by default, and it always tries to find a direct sum-of-squares proof unless the assumptions are provided as constraints.  Moreover,
inequalities that are not proved via direct sum-of-squares are banned,
e.g., Karamata's inequality.  This could increase the complexity of the computation as well as the output. 

<br>

### Limited to Rational Numbers

The triples library will try to find a solution with coefficients in the rational number field $\mathbb Q$ if the given problem is entirely in $\mathbb Q$. Considering the polynomial $\sum_{\mathrm{cyc}}  a^2(a^2+2b^2-3bc-4ab+4ac )$ over $a,b,c\in\mathbb R_+$, it is a sum of squares but not a rational sum of squares.
Since the solver tries to obtain solutions with rational coefficients by default,
it has to lift the degree to 5:
$$
\sum_{\mathrm{cyc}}  a^2(a^2+2b^2-3bc-4ab+4ac ) = \frac{7 \prod_{\mathrm{cyc}} a \sum_{\mathrm{cyc}} \left(a - b\right)^{2} + 2 \sum_{\mathrm{cyc}} a \left(- a^{2} + 2 a b - 2 a c + b^{2} - b c + c^{2}\right)^{2}}{2 \sum_{\mathrm{cyc}} a}.
$$

An irrational sum-of-squares without degree lifting is given by
$$
\frac{1}{2}\sum_{\mathrm{cyc}} (a^2-b^2-(\sqrt 2-1)(ab-ac)+(\sqrt 2+1)(bc-ab))^2
+(\sqrt 2- 1)\sum_{\mathrm{cyc}} bc(b-a-(\sqrt 2+1)(c-a))^2.
$$
Another example is Scheiderer's form, which can be found in Macaulay2's documentation.

<br>

### Limited to Rational Functions


The current solver tries to find a solution using only rational functions if
the given problem is entirely on the rational function field. However, sometimes
irrational or transcendental operators are useful when proving polynomial inequalities.

**Example 3** The Motzkin polynomial is a sum-of-squares if cubic roots are allowed,

$$
x^4y^2+x^2y^4+z^6-3x^2y^2z^2
=\frac{1}{2}(x^{\frac{4}{3}}y^{\frac{2}{3}}+x^{\frac{2}{3}}y^{\frac{4}{3}}+z^2)
((x^{\frac{4}{3}}y^{\frac{2}{3}}-x^{\frac{2}{3}}y^{\frac{4}{3}})^2+(x^{\frac{4}{3}}y^{\frac{2}{3}}-z^2)^2
+(x^{\frac{2}{3}}y^{\frac{4}{3}}-z^2)^2),
$$
which is in fact a direct corollary of $a^3+b^3+c^3 -3abc=(a+b+c)((a-b)^2+(b-c)^2+(c-a)^2)/2$.

<br>

**Example 4** Consider proving $\sum_{i=1}^n\sum_{j=1}^n(|a_i+a_j|-|a_i-a_j|)\geq 0$. Noting that
$\int_0^{\infty}\frac{\sin (at)\sin (bt)}{t^2}dt = \frac{\pi}{4}(|a+b|-|a-b|)$, a direct solution is given
by
$$
\sum_{i=1}^n\sum_{j=1}^n(|a_i+a_j|-|a_i-a_j|)
=\frac{4}{\pi}\int_0^\infty\frac{1}{t^2}\left(\sum_{i=1}^n \sin( a_i t)\right)^2dt\geq 0.
$$
The elegant proof uses a sum-of-squares expression with trigonometric functions and integrals,
which is out of the scope of the current solver.

<br>

## Limitations of Symbolic Computations



### Slowness

The triples library is based on symbolic computations and aims to provide
exact certificates of nonnegativity. However, symbolic computations could
be expensive, and could be slow for large-scale problems. It is recommended
to try out other solvers for specific problems. E.g.,
* For large-scale polynomial optimization, numerical solvers might be more suitable. 
* If a readable sum-of-squares proof is not needed, CAD or SAT solvers might be more suitable.

<br>

### Inexactness

The triples library employs numerical solvers for optimization and then round
them to exact rational numbers. However, the rounding procedure could be
difficult, and might fail. The triples library might not output an exact
proof even if a numerical solution is detected.