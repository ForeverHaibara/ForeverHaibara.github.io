# Getting Started with Triples Library

This guide will help you set up the Triples library and perform your first non-negativity proof.

GitHub:
[https://github.com/ForeverHaibara/Triple-SOS](https://github.com/ForeverHaibara/Triple-SOS)

## Prerequisites

These prerequisites will be automatically installed when you install the triples library using pip.

- Python>=3.6
- [SymPy](https://sympy.org/)>=1.9
- [NumPy](http://numpy.org/)
- [SciPy](https://scipy.org/)
- [Clarabel](https://clarabel.org/)

Tips:

* If clarabel cannot be installed, replace it with other SDP solvers, e.g., [CVXOPT](https://cvxopt.org/).
* Install "[python-flint](https://python-flint.readthedocs.io/en/latest/)" to accelerate some computations.
* Currently, newer SymPy versions are preferred. Update SymPy if possible!

## Installation

The triples library can now be installed using pip:

```bash
pip install triples
```

<!-- The Triples library is typically used as a Python package. If it were published on PyPI, you would install it using pip:

```bash
No, the package is not published on PyPI yet.
```
  -->
## Your First Proof

The triples library bases on SymPy for symbolic computations. Here is a simple example to prove that $x^2 - 2xy + y^2 \ge 0$.
All you need to do is to define a sympy expression and call the `sum_of_squares` function from the library.

```
import sympy as sp
from triples import sum_of_squares
x, y = sp.symbols("x y")
result = sum_of_squares(x**2 - 2*x*y + y**2)
if result is not None:
    print('solution =', result.solution)
```

Expected output for $x^2 - 2xy + y^2$:

```
solution = (x - y)**2
```

## Next Steps

- Explore the [API Reference](./api-reference#/triples/documentation/api-reference/sum-of-squares) to understand more functions and options.
- Try proving more complex inequalities, possibly with constraints.
- Check out the interactive "Triples Solver" on this website for live examples.
