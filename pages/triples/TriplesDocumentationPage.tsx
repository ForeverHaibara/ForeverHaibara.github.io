
import React from 'react';

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="bg-slate-100 p-4 rounded-md shadow-sm overflow-x-auto text-sm my-3 border border-slate-200">
    <code className="text-slate-800">{children}</code>
  </pre>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-semibold text-blue-700 mt-6 mb-3 border-b border-blue-200 pb-2">{children}</h2>
);

const SubSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xl font-semibold text-blue-600 mt-4 mb-2">{children}</h3>
);

const TriplesDocumentationPage: React.FC = () => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-4xl mx-auto">
      <header className="mb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700">
          <code>sum_of_squares</code> Function Documentation
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">
          Detailed documentation for the main function of the 'triples' library.
        </p>
      </header>

      <article className="text-slate-700 leading-relaxed">
        <p className="mb-4">
          The <code>sum_of_squares</code> function is the core utility for performing sum of squares decomposition on a given polynomial, potentially with constraints.
        </p>

        <SectionTitle>Function Signature</SectionTitle>
        <CodeBlock>
{`def sum_of_squares(
    poly: Union[sp.Poly, sp.Expr],
    ineq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    eq_constraints: Union[List[Expr], Dict[Expr, Expr]] = {},
    method_order: Optional[List[str]] = METHOD_ORDER,
    configs: Optional[Dict[str, Dict]] = DEFAULT_CONFIGS
) -> Optional[Solution]:`}
        </CodeBlock>

        <SectionTitle>Description</SectionTitle>
        <p>
          This is the main function for sum of square decomposition.
        </p>

        <SectionTitle>Examples</SectionTitle>
        <SubSectionTitle>Basic Usage</SubSectionTitle>
        <p>The function relies on SymPy for symbolic computation. First, import necessary items:</p>
        <CodeBlock>
{`>>> from sympy.abc import x, y, a, b, c
>>> from sympy import Expr, Function`}
        </CodeBlock>
        <p>Call the function by passing in a SymPy polynomial or polynomial-like expression:</p>
        <CodeBlock>
{`>>> result = sum_of_squares(a**2+b**2+c**2-a*b-b*c-c*a)`}
        </CodeBlock>
        <p>
          The result will be <code>None</code> if the function fails. However, when the function fails
          it does not mean the polynomial is non positive semidefinite or non sum-of-squares. It only
          means the function could not find a solution.
          If result is not <code>None</code>, it will be a solution class. To access the expression, use <code>.solution</code>:
        </p>
        <CodeBlock>
{`>>> print(isinstance(result.solution, Expr), result.solution) # doctest: +SKIP
True (Σ(a - b)**2)/2`}
        </CodeBlock>
        <p>
          The solution expression might involve <code>CyclicSum</code> and <code>CyclicProduct</code> classes, which are not native
          to SymPy, but defined in this package. The permutation groups are not displayed by default and
          might be sometimes misleading. To avoid ambiguity and to expand them, use <code>.doit()</code> on SymPy expressions:
        </p>
        <CodeBlock>
{`>>> result.solution.doit() # doctest: +SKIP
(-a + c)**2/2 + (a - b)**2/2 + (b - c)**2/2`}
        </CodeBlock>

        <SubSectionTitle>With Constraints</SubSectionTitle>
        <p>
          If we want to add constraints for the domain of the variables, we can pass in a list of inequality
          or equality constraints. This should be the second and the third argument respectively. Here is
          an example for the constraints a,b,c &gt;= 0:
        </p>
        <CodeBlock>
{`>>> sum_of_squares(a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b), [a,b,c]).solution # doctest: +SKIP
((Σ(a - b)**2*(a + b - c)**2)/2 + Σa*b*(a - b)**2)/(Σa)`}
        </CodeBlock>
        <p>
          If we want to track the constraints, we can also pass in a dictionary to imply the "name" of the
          constraints:
        </p>
        <CodeBlock>
{`>>> sum_of_squares(((a+2)*(b+2)*(c+2)*(a**2/(2+a)+b**2/(2+b)+c**2/(2+c)-1)).cancel(), [a,b,c], {a*b*c-1:x}).solution # doctest: +SKIP
x*(Σ(2*a + 13))/6 + Σa*(b - c)**2 + (Σa*b*(c - 1)**2)/6 + 5*(Σ(a - 1)**2)/6 + 7*(Σ(a - b)**2)/12

>>> sum_of_squares(x+y+z-(x*y+y*z+z*x), {x:x, y:y, z:z, 4-(x*y+y*z+z*x+x*y*z):a}).solution # doctest: +SKIP
(a*(Σ(x**2 + 2*x*y)) + Σx*y*(x - y)**2 + (Σx*y*z*(x - y)**2)/2)/(Σ(x*y*z + 4*x*y + 4*x))

>>> G = Function("G")
>>> sum_of_squares(x*(y-z)**2+y*(z-x)**2+z*(x-y)**2, {x:G(x),y:G(y),z:G(z)}).solution # doctest: +SKIP
Σ(x - y)**2*G(z)`}
        </CodeBlock>

        <SectionTitle>Parameters</SectionTitle>
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold text-slate-800"><code>poly: Union[sp.Poly, sp.Expr]</code></dt>
            <dd className="ml-4 text-slate-600">The polynomial to perform SOS on.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800"><code>ineq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
            <dd className="ml-4 text-slate-600">Inequality constraints to the problem. This assumes g_1(x) &gt;= 0, g_2(x) &gt;= 0, ...</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800"><code>eq_constraints: Union[List[Expr], Dict[Expr, Expr]]</code> (optional, default: <code>{}</code>)</dt>
            <dd className="ml-4 text-slate-600">Equality constraints to the problem. This assumes h_1(x) = 0, h_2(x) = 0, ...</dd>
          </div>
           <div>
            <dt className="font-semibold text-slate-800"><code>method_order: Optional[List[str]]</code> (optional, default: <code>METHOD_ORDER</code>)</dt>
            <dd className="ml-4 text-slate-600">Specifies the order of methods to try for decomposition.</dd>
          </div>
           <div>
            <dt className="font-semibold text-slate-800"><code>configs: Optional[Dict[str, Dict]]</code> (optional, default: <code>DEFAULT_CONFIGS</code>)</dt>
            <dd className="ml-4 text-slate-600">Configurations for different SOS methods.</dd>
          </div>
        </dl>

        <SectionTitle>Returns</SectionTitle>
        <p className="font-semibold text-slate-800"><code>Optional[Solution]</code></p>
        <p className="ml-4 text-slate-600">
          The solution. If no solution is found, <code>None</code> is returned. The <code>Solution</code> object contains details of the SOS decomposition.
        </p>
      </article>
    </div>
  );
};

export default TriplesDocumentationPage;
