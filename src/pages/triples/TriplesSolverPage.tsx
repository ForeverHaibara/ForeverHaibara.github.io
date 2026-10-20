import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Arrow, usePageEntrance } from '../../components/PageVisuals';
import '../../styles/showcase.css';
import { callTriplesGradioApi } from '../../services/triplesService.ts';
import type { GradioServiceCallResult } from '../../types.ts';
import LoadingSpinner from '../../components/LoadingSpinner.tsx';
import AlertMessage from '../../components/AlertMessage.tsx';
import KatexDisplay from '../../components/KatexDisplay.tsx';

type TabKey = 'solution' | 'latex' | 'latex_aligned';

interface Constraint {
  id: string;
  expression: string;
  alias: string;
  type: 'ineq' | 'eq';
}

const generateId = () => `constraint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

interface ExampleConstraint {
  expression: string;
  alias?: string;
  type: 'ineq' | 'eq';
}

interface TriplesExample {
  id: string;
  name: string;
  description?: string;
  expression: string;
  displayExpressionLatex?: string;
  constraints: ExampleConstraint[];
}

const examplesData: TriplesExample[] = [
  {
    id: 'motzkin',
    name: "Motzkin's Form",
    description:
      'A classic example of a non-negative polynomial that is not a sum of squares of polynomials (without constraints).',
    expression: '(x^2+y^2-3*z^2)*x^2*y^2 + z^6',
    displayExpressionLatex: '(x^2+y^2-3z^2)x^2y^2 + z^6 \\ge 0',
    constraints: [],
  },
  {
    id: 'schur3',
    name: "Schur's Inequality (r=1, degree 3)",
    description: "Schur's inequality for r=1. Non-negative for non-negative variables.",
    expression: 'a*(a-b)*(a-c)+b*(b-c)*(b-a)+c*(c-a)*(c-b)',
    displayExpressionLatex: 'a(a-b)(a-c)+b(b-c)(b-a)+c(c-a)(c-b) \\ge 0',
    constraints: [
      { expression: 'a', alias: 'a', type: 'ineq' },
      { expression: 'b', alias: 'b', type: 'ineq' },
      { expression: 'c', alias: 'c', type: 'ineq' },
    ],
  },
  {
    id: 'nesbitt',
    name: "Nesbitt's Inequality",
    description: 'A well-known inequality in three variables.',
    expression: 'a/(b+c) + b/(c+a) + c/(a+b) - 3/2',
    displayExpressionLatex:
      '\\frac{a}{b+c} + \\frac{b}{c+a} + \\frac{c}{a+b} - \\frac{3}{2} \\ge 0',
    constraints: [
      { expression: 'a', alias: 'a', type: 'ineq' },
      { expression: 'b', alias: 'b', type: 'ineq' },
      { expression: 'c', alias: 'c', type: 'ineq' },
    ],
  },
  {
    id: 'lax-lax',
    name: "Lax-Lax's Form",
    description:
      'A quaternary quartic form that is not sum-of-squares, but nonnegative over reals.',
    expression:
      'a*(a-b)*(a-c)*(a-d)+b*(b-c)*(b-d)*(b-a)+c*(c-d)*(c-a)*(c-b)+d*(d-a)*(d-b)*(d-c)+a*b*c*d',
    displayExpressionLatex: '\\sum_{\\text{cyc}}a(a-b)(a-c)(a-d) +abcd \\ge 0',
    constraints: [],
  },
  {
    id: 'imo2000',
    name: 'IMO-2000',
    description: 'Prove (a-1+1/b)(b-1+1/c)(c-1+1/a) <= 1 given a,b,c>0 and abc=1.',
    expression: '1 - (a-1+1/b)*(b-1+1/c)*(c-1+1/a)',
    displayExpressionLatex: '1\\geq \\prod_{\\text{cyc}}\\left(a-1+\\frac {1}{b}\\right)',
    constraints: [
      { expression: 'a', alias: 'a', type: 'ineq' },
      { expression: 'b', alias: 'b', type: 'ineq' },
      { expression: 'c', alias: 'c', type: 'ineq' },
      { expression: 'a*b*c-1', alias: '', type: 'eq' },
    ],
  },
];

const TriplesSolverPage: React.FC = () => {
  usePageEntrance();
  const [expression, setExpression] = useState<string>('');
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResult, setApiResult] = useState<GradioServiceCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('solution');
  const [copyStatus, setCopyStatus] = useState<Record<TabKey, string>>({
    solution: 'Copy',
    latex: 'Copy',
    latex_aligned: 'Copy',
  });

  const constraintInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const handleAddConstraint = (type: 'ineq' | 'eq') => {
    const newId = generateId();
    const newConstraint: Constraint = { id: newId, expression: '', alias: '', type };
    setConstraints((prev) => [...prev, newConstraint]);
    setTimeout(() => {
      constraintInputRefs.current?.[`${newId}_expression`]?.focus();
    }, 0);
  };

  const handleConstraintInputChange = (
    id: string,
    field: 'expression' | 'alias',
    value: string
  ) => {
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleRemoveConstraint = (id: string) => {
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearAllConstraints = () => {
    setConstraints([]);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!expression.trim()) {
        setError('Please enter a mathematical expression.');
        setApiResult(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setApiResult(null);
      setCopyStatus({ solution: 'Copy', latex: 'Copy', latex_aligned: 'Copy' });

      const ineqConstraints: string[] = [];
      const eqConstraints: string[] = [];

      constraints.forEach((c) => {
        if (c.expression.trim()) {
          const alias = c.alias.trim() || c.expression.trim();
          const formattedConstraint = `${c.expression.trim()}:${alias}`;
          if (c.type === 'ineq') {
            ineqConstraints.push(formattedConstraint);
          } else {
            eqConstraints.push(formattedConstraint);
          }
        }
      });

      try {
        const result = await callTriplesGradioApi(
          expression,
          ineqConstraints.join(';'),
          eqConstraints.join(';')
        );
        setApiResult(result);
        if (!result.apiSuccess) {
          setError(result.errorMessage || 'An unknown API error occurred.');
        }
      } catch (err: any) {
        console.error('Gradio API call failed unexpectedly:', err);
        setError(err.message || 'Failed to connect to the Triples proof service.');
        setApiResult({
          apiSuccess: false,
          errorMessage: err.message || 'Client-side error during API call.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [expression, constraints]
  );

  const handleClearError = useCallback(() => {
    setError(null);
    if (apiResult && !apiResult.apiSuccess) {
      setApiResult(null);
    }
  }, [apiResult]);

  const handleCopy = useCallback((textToCopy: string, tabKey: TabKey) => {
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopyStatus((prev) => ({ ...prev, [tabKey]: 'Copied!' }));
        setTimeout(() => setCopyStatus((prev) => ({ ...prev, [tabKey]: 'Copy' })), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
        setCopyStatus((prev) => ({ ...prev, [tabKey]: 'Failed' }));
        setTimeout(() => setCopyStatus((prev) => ({ ...prev, [tabKey]: 'Copy' })), 2000);
      });
  }, []);

  const handleLoadExample = useCallback((example: TriplesExample) => {
    setExpression(example.expression);
    const newConstraints: Constraint[] = example.constraints.map((ec) => ({
      id: generateId(),
      expression: ec.expression,
      alias: ec.alias ?? '',
      type: ec.type,
    }));
    setConstraints(newConstraints);
    setApiResult(null);
    setError(null);
    setActiveTab('solution');
    setCopyStatus({ solution: 'Copy', latex: 'Copy', latex_aligned: 'Copy' });
    formRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
    formRef.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, []);

  const proofData = apiResult?.apiSuccess ? apiResult.data : null;

  return (
    <div className="solver-page">
      <header className="solver-heading">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> A SUM-OF-SQUARES WORKSPACE
          </p>
          <h1>
            Triples Inequality Prover<span>.</span>
          </h1>
          <p>A mathematical expression. A few assumptions. A new perspective on the proof.</p>
        </div>
        <Link className="design-text-link" to="/triples/documentation">
          Read the documentation <Arrow diagonal />
        </Link>
      </header>

      <div className="solver-workspace">
        <section className="solver-editor" aria-labelledby="problem-heading">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="solver-panel-heading">
              <h2 id="problem-heading">Define your problem</h2>
              <span className="section-index">01 / INPUT</span>
            </div>
            <label className="solver-label" htmlFor="expression">
              Mathematical expression <span>to prove ≥ 0</span>
            </label>
            <textarea
              id="expression"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g., x^2 - 2*x*y + y^2"
              rows={4}
              className="solver-expression"
              disabled={isLoading}
              aria-label="Mathematical Expression Input"
              aria-describedby="expression-help"
            />
            <p className="solver-field-help" id="expression-help">
              Enter the expression only, without an inequality sign.
            </p>
            <div className="solver-constraints">
              <div className="constraint-heading">
                <h3>
                  Constraints <span>Optional</span>
                </h3>
                {constraints.length > 0 && (
                  <button
                    className="constraint-clear"
                    type="button"
                    onClick={handleClearAllConstraints}
                    disabled={isLoading}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {constraints.length === 0 ? (
                <p className="constraints-empty">
                  Working with assumptions? Add a non-negative expression or an equality below.
                </p>
              ) : (
                <div className="constraint-list">
                  {constraints.map((constraint, index) => (
                    <div className="constraint-row" key={constraint.id}>
                      <div className="constraint-expression-field">
                        <label className="sr-only" htmlFor={`${constraint.id}_expression`}>
                          Constraint expression {index + 1}
                        </label>
                        <input
                          id={`${constraint.id}_expression`}
                          ref={(el) => {
                            constraintInputRefs.current[`${constraint.id}_expression`] = el;
                          }}
                          type="text"
                          value={constraint.expression}
                          onChange={(e) =>
                            handleConstraintInputChange(constraint.id, 'expression', e.target.value)
                          }
                          placeholder="Expression, e.g. a*b*c-1"
                          disabled={isLoading}
                        />
                        <span>{constraint.type === 'ineq' ? '≥ 0' : '= 0'}</span>
                      </div>
                      <div className="constraint-alias-field">
                        <label className="sr-only" htmlFor={`${constraint.id}_alias`}>
                          Alias for constraint {index + 1}
                        </label>
                        <input
                          id={`${constraint.id}_alias`}
                          type="text"
                          value={constraint.alias}
                          onChange={(e) =>
                            handleConstraintInputChange(constraint.id, 'alias', e.target.value)
                          }
                          placeholder="Alias (optional)"
                          disabled={isLoading}
                        />
                      </div>
                      <button
                        type="button"
                        className="constraint-remove"
                        onClick={() => handleRemoveConstraint(constraint.id)}
                        disabled={isLoading}
                        aria-label={`Remove constraint ${index + 1}`}
                        title="Remove constraint"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="constraint-actions">
                <button
                  type="button"
                  onClick={() => handleAddConstraint('ineq')}
                  disabled={isLoading}
                >
                  + Inequality <span>≥ 0</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddConstraint('eq')}
                  disabled={isLoading}
                >
                  + Equality <span>= 0</span>
                </button>
              </div>
            </div>
            <div className="solver-submit-row">
              <span>Find a proof of non-negativity.</span>
              <button
                type="submit"
                disabled={isLoading}
                className="design-button design-button--primary"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" /> Proving...
                  </>
                ) : (
                  <>
                    Prove Non-negativity <Arrow />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="solver-results" aria-labelledby="proof-heading" aria-busy={isLoading}>
          <div className="solver-panel-heading">
            <h2 id="proof-heading">The proof</h2>
            <span className="section-index">02 / RESULT</span>
          </div>
          <div aria-live="polite">
            {isLoading && (
              <div className="proof-placeholder">
                <LoadingSpinner size="sm" />
                <div>
                  <h3>Looking for a decomposition…</h3>
                  <p>The proof service is working on your expression.</p>
                </div>
              </div>
            )}
            {!isLoading && !error && !apiResult && (
              <div className="proof-placeholder">
                <span className="proof-placeholder-symbol" aria-hidden="true">
                  ∑
                </span>
                <div>
                  <h3>Every proof starts with a question.</h3>
                  <p>Enter an expression or load an example. Your proof will appear here.</p>
                </div>
                <span className="proof-placeholder-formula" aria-hidden="true">
                  f = ∑ q²
                </span>
              </div>
            )}
            {error && <AlertMessage type="error" message={error} onClose={handleClearError} />}
            {!error && apiResult && !apiResult.apiSuccess && (
              <AlertMessage
                type="error"
                message={apiResult.errorMessage || 'An unknown API error occurred.'}
                onClose={() => setApiResult(null)}
              />
            )}
            {proofData && !proofData.success && (
              <AlertMessage
                type="warning"
                message={`Proof attempt failed: ${proofData.error || 'No proof was found for this expression.'}`}
                onClose={() => setApiResult(null)}
              />
            )}
          </div>
          {proofData && proofData.success && (
            <div className="proof-output-grid">
              <div className="proof-render">
                <span className="proof-success-label">Proof found</span>
                <div className="proof-math">
                  <KatexDisplay latex={proofData.latex_aligned} />
                </div>
              </div>
              <div className="proof-details">
                <div className="proof-output-tabs" aria-label="Result format">
                  {(['solution', 'latex', 'latex_aligned'] as TabKey[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      aria-pressed={activeTab === tab}
                    >
                      {tab === 'solution'
                        ? 'Solution'
                        : tab === 'latex'
                          ? 'LaTeX'
                          : 'Aligned LaTeX'}
                    </button>
                  ))}
                </div>
                <div className="proof-code-heading">
                  <span>RESULT DETAILS</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(proofData[activeTab], activeTab)}
                    aria-label={`Copy ${activeTab.replace('_', ' ')}`}
                  >
                    {copyStatus[activeTab]}
                  </button>
                </div>
                <pre>{proofData[activeTab]}</pre>
              </div>
            </div>
          )}
        </section>

        <aside className="solver-reference" aria-labelledby="reference-heading">
          <p className="eyebrow">A QUICK REFERENCE</p>
          <h2 id="reference-heading">
            A little syntax goes
            <br />a long way.
          </h2>
          <p>Use Python-style expressions, parsed with SymPy.</p>
          <dl className="syntax-list">
            <div>
              <dt>
                <code>a*b</code>
              </dt>
              <dd>Write multiplication explicitly.</dd>
            </div>
            <div>
              <dt>
                <code>a^2</code>
              </dt>
              <dd>Use ^ or ** for powers.</dd>
            </div>
            <div>
              <dt>
                <code>(a+b)</code>
              </dt>
              <dd>Group terms with parentheses.</dd>
            </div>
          </dl>
          <p className="syntax-note">
            Leave out comparison signs such as &gt;, &lt;, and =. The solver checks whether your
            expression is non-negative.
          </p>
          <button
            className="reference-example"
            type="button"
            onClick={() => handleLoadExample(examplesData[1])}
            disabled={isLoading}
          >
            <span>
              Not sure where to start?<strong>Try Schur's inequality</strong>
            </span>
            <Arrow />
          </button>
        </aside>
      </div>

      <section className="solver-examples" aria-labelledby="examples-heading">
        <div className="design-section-heading">
          <div>
            <p className="eyebrow">A FEW STARTING POINTS</p>
            <h2 id="examples-heading">Small expressions. Interesting problems.</h2>
          </div>
          <span className="section-side-note">Choose an example to load it into the editor.</span>
        </div>
        <div className="example-gallery">
          {examplesData.map((example, index) => (
            <article className="example-card" key={example.id}>
              <div className="example-title">
                <span className="section-index">0{index + 1}</span>
                <h3>{example.name}</h3>
                <span className="example-type">
                  {example.constraints.length ? 'Constrained' : 'Over the reals'}
                </span>
              </div>
              {example.displayExpressionLatex && (
                <div className="example-math">
                  <KatexDisplay latex={example.displayExpressionLatex} />
                </div>
              )}
              <p>{example.description}</p>
              <div className="example-bottom">
                <div className="example-constraints">
                  {example.constraints.length > 0 ? (
                    example.constraints.map((c, i) => (
                      <code key={i}>
                        {c.expression} {c.type === 'ineq' ? '≥ 0' : '= 0'}
                      </code>
                    ))
                  ) : (
                    <span>No additional constraints</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadExample(example)}
                  disabled={isLoading}
                  aria-label={`Load example: ${example.name}`}
                >
                  Load example <Arrow />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="solver-python">
        <div>
          <p className="eyebrow">TAKE IT TO YOUR NOTEBOOK</p>
          <h2>The same ideas. In Python.</h2>
        </div>
        <code>
          <span>$</span> pip install triples
        </code>
        <Link className="design-text-link" to="/triples/documentation/getting-started">
          Get started <Arrow diagonal />
        </Link>
      </section>
    </div>
  );
};

export default TriplesSolverPage;
