
# Getting Started with Triples Library

This guide will help you set up the Triples library and perform your first non-negativity proof.

## Prerequisites

- Python 3.7+
- Pip (Python package installer)
- SymPy (will be installed as a dependency)

## Installation

The Triples library is typically used as a Python package. If it were published on PyPI, you would install it using pip:

```bash
pip install triples-library # Fictional package name
```

For local development or if you have the source code, you might install it in editable mode from the project's root directory:

```bash
pip install -e .
```

Ensure all dependencies from a `requirements.txt` or `pyproject.toml` are installed.

## Your First Proof

Once installed, you can use the library in your Python scripts or an interactive Python session.

1.  **Import necessary components:**

    ```python
    from sympy.abc import x, y, z # Standard SymPy symbols
    # Assuming your library has a top-level function like this:
    from triples import sum_of_squares 
    ```

2.  **Define an expression:**

    Let's try to prove that $x^2 - 2xy + y^2 \ge 0$.

    ```python
    expr = x**2 - 2*x*y + y**2
    ```

3.  **Call `sum_of_squares`:**

    ```python
    solution = sum_of_squares(expr)
    ```

4.  **Inspect the result:**

    The `solution` object (if the proof is successful) will contain the sum of squares decomposition.

    ```python
    if solution:
        print("Proof successful!")
        print(f"Original expression: {expr}")
        print(f"SOS decomposition: {solution.solution.doit()}") # .doit() expands custom sum/product classes
        # The solution object might also provide LaTeX formatted output
        # print(f"LaTeX: {solution.latex}")
    else:
        print("Could not find a sum of squares decomposition with the default methods.")
    ```

    Expected output for $x^2 - 2xy + y^2$:
    ```
    Proof successful!
    Original expression: x**2 - 2*x*y + y**2
    SOS decomposition: (x - y)**2
    ```

## Next Steps

- Explore the [API Reference](./api-reference) to understand more functions and options.
- Try proving more complex inequalities, possibly with [constraints](./api-reference/sum-of-squares#with-constraints).
- Check out the interactive "Triples Solver" on this website for live examples.
