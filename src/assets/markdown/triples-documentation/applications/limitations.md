# Limitations

There are things that the triples library can do and things it cannot.

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

Not every nonnegative multivariate polynomial can be represented as sum of squares of polynomials. The most renowned example is perhaps the Motzkin form:

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

However, this is incorrect because the set $\{x-y^2+3\geq 0,\ y+x^2+2=0\}$ is empty. In fact, the above
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

## Limitations of Symbolic Computations

The triples library is based on symbolic computations and aims to provide
exact certificates of nonnegativity. However, symbolic computations could
be expensive, and could be slow for large-scale problems. It is recommended
to try out other numerical solvers if exact arithmetic is not needed, e.g.,
numerical optimization.