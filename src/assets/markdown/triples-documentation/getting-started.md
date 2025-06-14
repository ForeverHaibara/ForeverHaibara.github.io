# Getting Started with Triples Library

This guide will help you set up the Triples library and perform your first non-negativity proof.

## Prerequisites

- Python 3
- SymPy>=1.10
- NumPy
- SciPy
- Clarabel

## Installation

The Triples library is currently unpublished on PyPI. To install, use the source code from GitHub:

[https://github.com/ForeverHaibara/Triple-SOS](https://github.com/ForeverHaibara/Triple-SOS)

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
from triples.core import sum_of_squares 
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

- Explore the [API Reference](./api-reference) to understand more functions and options.
- Try proving more complex inequalities, possibly with [constraints](./api-reference/sum-of-squares#with-constraints).
- Check out the interactive "Triples Solver" on this website for live examples.
