import React, { useState, useCallback, useRef } from 'react';
import { GRADIO_TRIPLES_URL } from '../../constants.ts';
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
    description: 'A classic example of a non-negative polynomial that is not a sum of squares of polynomials (without constraints).',
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
    displayExpressionLatex: '\\frac{a}{b+c} + \\frac{b}{c+a} + \\frac{c}{a+b} - \\frac{3}{2} \\ge 0',
    constraints: [
      { expression: 'a', alias: 'a', type: 'ineq' },
      { expression: 'b', alias: 'b', type: 'ineq' },
      { expression: 'c', alias: 'c', type: 'ineq' },
    ],
  },
  {
    id: 'lax-lax',
    name: "Lax-Lax's Form",
    description: 'A quaternary quartic form that is not sum-of-squares, but nonnegative over reals.',
    expression: 'a*(a-b)*(a-c)*(a-d)+b*(b-c)*(b-d)*(b-a)+c*(c-d)*(c-a)*(c-b)+d*(d-a)*(d-b)*(d-c)+a*b*c*d',
    displayExpressionLatex: '\\sum_{\\text{cyc}}a(a-b)(a-c)(a-d) +abcd \\ge 0',
    constraints: [],
  },
  {
    id: 'imo2000',
    name: 'IMO-2000',
    description: 'Prove (a-1+1/b)(b-1+1/c)(c+1/a) <= 1 given a,b,c>0 and abc=1.',
    expression: '1 - (a-1+1/b)*(b-1+1/c)*(c-1+1/a)',
    displayExpressionLatex: '1\\geq \\prod_{\\text{cyc}}\\left(a-1+\\frac {1}{b}\\right)',
    constraints: [
      { expression: 'a', alias: 'a', type: 'ineq' },
      { expression: 'b', alias: 'b', type: 'ineq' },
      { expression: 'c', alias: 'c', type: 'ineq' },
      { expression: 'a*b*c-1', alias: '', type: 'eq' },
    ]
  }
];

const sectionCardClass = 'rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl sm:p-6';
const primaryCardClass = 'rounded-[30px] border border-white/70 bg-white/62 p-5 shadow-[0_20px_44px_rgba(148,163,184,0.14)] backdrop-blur-xl sm:p-6 lg:p-7';

const TriplesSolverPage: React.FC = () => {
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
    setConstraints(prev => [...prev, newConstraint]);
    setTimeout(() => {
      constraintInputRefs.current?.[`${newId}_expression`]?.focus();
    }, 0);
  };

  const handleConstraintInputChange = (id: string, field: 'expression' | 'alias', value: string) => {
    setConstraints(prev => prev.map(c => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleRemoveConstraint = (id: string) => {
    setConstraints(prev => prev.filter(c => c.id !== id));
  };

  const handleClearAllConstraints = () => {
    setConstraints([]);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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

    constraints.forEach(c => {
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
      const result = await callTriplesGradioApi(expression, ineqConstraints.join(';'), eqConstraints.join(';'));
      setApiResult(result);
      if (!result.apiSuccess) {
        setError(result.errorMessage || 'An unknown API error occurred.');
      }
    } catch (err: any) {
      console.error('Gradio API call failed unexpectedly:', err);
      setError(err.message || 'Failed to connect to the Triples proof service.');
      setApiResult({ apiSuccess: false, errorMessage: err.message || 'Client-side error during API call.' });
    } finally {
      setIsLoading(false);
    }
  }, [expression, constraints]);

  const handleClearError = useCallback(() => {
    setError(null);
    if (apiResult && !apiResult.apiSuccess) {
      setApiResult(null);
    }
  }, [apiResult]);

  const handleCopy = useCallback((textToCopy: string, tabKey: TabKey) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copied!' }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copy' })), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      setCopyStatus(prev => ({ ...prev, [tabKey]: 'Failed' }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copy' })), 2000);
    });
  }, []);

  const handleLoadExample = useCallback((example: TriplesExample) => {
    setExpression(example.expression);
    const newConstraints: Constraint[] = example.constraints.map(ec => ({
      id: generateId(),
      expression: ec.expression,
      alias: '',
      type: ec.type,
    }));
    setConstraints(newConstraints);
    setApiResult(null);
    setError(null);
    setActiveTab('solution');
    setCopyStatus({ solution: 'Copy', latex: 'Copy', latex_aligned: 'Copy' });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const proofData = apiResult?.apiSuccess ? apiResult.data : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/48 px-5 py-6 shadow-[0_18px_42px_rgba(148,163,184,0.12)] backdrop-blur-xl sm:px-7 sm:py-8">
        <header className="max-w-4xl">
        {/* <header className="mx-auto max-w-4xl">text-center xl:text-left" */}
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-sky-900 sm:text-4xl">Triples Inequality Prover</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Enter a mathematical expression and optional constraints to attempt a proof of its non-negativity.
            This tool connects to a Gradio backend at <code className="rounded-full bg-white/80 px-2 py-1 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{GRADIO_TRIPLES_URL}</code>.
          </p>
        </header>
      </section>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(720px,960px)_320px_minmax(0,1fr)] xl:gap-6">
        <div className="hidden xl:block" aria-hidden="true" />

        <section className={primaryCardClass}>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="expression" className="mb-1 block text-sm font-medium text-slate-700">Mathematical Expression</label>
              <textarea
                id="expression"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g., x^2 - 2*x*y + y^2"
                rows={3}
                className="w-full rounded-2xl border border-sky-100 bg-white/82 p-3 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors focus:border-sky-300 focus:ring-sky-200"
                disabled={isLoading}
                aria-label="Mathematical Expression Input"
              />
            </div>

            <div className="space-y-4 border-t border-sky-100 pt-4">
              <h2 className="text-sm font-semibold text-slate-700">Constraints</h2>
              {constraints.length === 0 && <p className="text-sm text-slate-500">No constraints added. Click buttons below to add.</p>}
              {constraints.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full overflow-hidden rounded-2xl border border-sky-100 shadow-[0_12px_30px_rgba(148,163,184,0.1)]">
                    <thead className="bg-[rgba(239,246,255,0.72)]">
                      <tr>
                        <th scope="col" className="w-2/5 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Constraint Expression</th>
                        <th scope="col" className="w-2/5 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Alias (Optional)</th>
                        <th scope="col" className="w-1/5 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Type</th>
                        <th scope="col" className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100 bg-white/80">
                      {constraints.map((constraint) => (
                        <tr key={constraint.id} className="group transition-colors hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-2">
                            <input
                              ref={el => { constraintInputRefs.current[`${constraint.id}_expression`] = el; }}
                              type="text"
                              value={constraint.expression}
                              onChange={(e) => handleConstraintInputChange(constraint.id, 'expression', e.target.value)}
                              placeholder="e.g., a*b*c-1"
                              className="w-full rounded-xl border border-sky-100 bg-white/80 p-2 text-sm focus:border-sky-300 focus:ring-sky-200"
                              disabled={isLoading}
                              aria-label={`Constraint expression for row ${constraint.id}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2">
                            <input
                              type="text"
                              value={constraint.alias}
                              onChange={(e) => handleConstraintInputChange(constraint.id, 'alias', e.target.value)}
                              placeholder="e.g., F(a,b,c) (defaults to expression)"
                              className="w-full rounded-xl border border-sky-100 bg-white/80 p-2 text-sm focus:border-sky-300 focus:ring-sky-200"
                              disabled={isLoading}
                              aria-label={`Alias for constraint row ${constraint.id}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-600">{constraint.type === 'ineq' ? '>= 0' : '= 0'}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveConstraint(constraint.id)}
                              className="rounded-full p-1 text-red-500 opacity-50 transition-opacity hover:bg-red-100 hover:text-red-700 group-hover:opacity-100"
                              title="Remove constraint"
                              disabled={isLoading}
                              aria-label={`Remove constraint row ${constraint.id}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => handleAddConstraint('ineq')} disabled={isLoading} className="rounded-full bg-emerald-500 px-4 py-2 text-sm text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50">+ Add Inequality (&gt;=0)</button>
                <button type="button" onClick={() => handleAddConstraint('eq')} disabled={isLoading} className="rounded-full bg-amber-500 px-4 py-2 text-sm text-white shadow-[0_10px_24px_rgba(245,158,11,0.24)] transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50">+ Add Equality (=0)</button>
                {constraints.length > 0 && <button type="button" onClick={handleClearAllConstraints} disabled={isLoading} className="rounded-full bg-rose-500 px-4 py-2 text-sm text-white shadow-[0_10px_24px_rgba(244,63,94,0.2)] transition-colors hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 disabled:opacity-50 sm:ml-auto">Clear All Constraints</button>}
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1d4ed8_0%,#38bdf8_100%)] px-4 py-3 font-semibold text-white shadow-[0_18px_34px_rgba(59,130,246,0.24)] transition-all hover:shadow-[0_22px_42px_rgba(59,130,246,0.3)] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? <><LoadingSpinner size="sm" /><span className="ml-2">Proving...</span></> : 'Prove Non-negativity'}
            </button>
          </form>
        </section>

        <section className={`${sectionCardClass} mt-6 xl:mt-0 xl:self-start xl:sticky xl:top-24`}>
          <h2 className="text-2xl font-semibold text-slate-700">Tutorial</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">Inputs are parsed by SymPy's "sympify" function and should follow Python syntax.</p>
          <ul className="mt-3 ml-4 list-inside list-disc space-y-2 text-sm text-slate-600 sm:text-base">
            <li>Both "**" and "^" are allowed for exponents. Multiplication symbols ("*") must not be omitted.</li>
            <li>Do not use comparison symbols such as "&gt;", "&lt;", "=", "&gt;=", or "&lt;=".</li>
            <li>Brackets should be "(" or ")", and other brackets are not allowed.</li>
          </ul>
        </section>

        <div className="hidden xl:block" aria-hidden="true" />
      </div>

      {(error || (!error && apiResult && !apiResult.apiSuccess) || (proofData && !proofData.success)) && (
        <section className={sectionCardClass}>
          {error && <AlertMessage type="error" message={error} onClose={handleClearError} />}
          {!error && apiResult && !apiResult.apiSuccess && <AlertMessage type="error" message={apiResult.errorMessage || 'An unknown API error occurred.'} onClose={() => setApiResult(null)} />}
          {proofData && !proofData.success && <AlertMessage type="error" message={`Proof attempt failed: ${proofData.error}`} onClose={() => setApiResult(null)} />}
        </section>
      )}

      {proofData && proofData.success && (
        <section className={sectionCardClass}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
            <div>
              <h2 className="mb-3 text-2xl font-semibold text-slate-700">Proof</h2>
              <div className="overflow-x-auto rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
                <KatexDisplay latex={proofData.latex_aligned} className="text-lg" />
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-2xl font-semibold text-slate-700">Result Details</h2>
              <div className="overflow-hidden rounded-[24px] border border-sky-100 shadow-[0_12px_30px_rgba(148,163,184,0.1)]">
                <div className="flex border-b border-sky-100 bg-[rgba(248,250,252,0.76)]">
                  {(['solution', 'latex', 'latex_aligned'] as TabKey[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${activeTab === tab ? 'bg-[linear-gradient(135deg,#bfdbfe_0%,#dbeafe_100%)] text-sky-800' : 'text-slate-600 hover:bg-white/70 hover:text-slate-800'}`}
                    >
                      {tab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
                <div className="relative bg-white/72 p-4">
                  <button
                    onClick={() => handleCopy(proofData[activeTab], activeTab)}
                    className="absolute right-3 top-3 rounded-full bg-slate-200/90 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-300"
                    aria-label={`Copy ${activeTab.replace('_', ' ')}`}
                  >
                    {copyStatus[activeTab]}
                  </button>
                  <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-all pr-16 text-sm leading-relaxed text-slate-800">
                    {proofData[activeTab]}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={sectionCardClass}>
        <h2 className="mb-6 text-2xl font-semibold text-slate-800 sm:text-3xl">Try these Examples</h2>
        {examplesData.length === 0 && <p className="text-slate-600">No examples available at the moment.</p>}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {examplesData.map((example) => (
            <div key={example.id} className="flex flex-col justify-between rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(239,246,255,0.72))] p-5 shadow-[0_16px_40px_rgba(148,163,184,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(96,165,250,0.16)]">
              <div className="flex-grow">
                <h3 className="mb-2 text-xl font-semibold text-sky-800">{example.name}</h3>
                {example.displayExpressionLatex && (
                  <div className="mb-3 overflow-x-auto rounded-2xl border border-white/80 bg-white/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <KatexDisplay latex={example.displayExpressionLatex} />
                  </div>
                )}
                {!example.displayExpressionLatex && example.expression && (
                  <p className="mb-2 break-all rounded-2xl border border-white/80 bg-white/82 p-3 font-mono text-sm text-slate-700">
                    <code>{example.expression}</code>
                  </p>
                )}
                {example.description && <p className="mb-3 text-sm text-slate-600">{example.description}</p>}
                {example.constraints.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Constraints:</h4>
                    <ul className="list-inside list-disc space-y-0.5 pl-1 text-sm text-slate-600">
                      {example.constraints.map((c, index) => (
                        <li key={index}>
                          <code className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{c.expression} {c.type === 'ineq' ? '>= 0' : '= 0'}</code>
                          {c.alias && c.alias !== c.expression && <span className="text-xs text-slate-500"> (as {c.alias})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleLoadExample(example)}
                className="mt-auto w-full rounded-full bg-[linear-gradient(135deg,#0ea5e9_0%,#38bdf8_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_26px_rgba(14,165,233,0.24)] transition-all hover:shadow-[0_16px_34px_rgba(14,165,233,0.3)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
                aria-label={`Load example: ${example.name}`}
              >
                Load this Example
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionCardClass}>
        <h2 className="mb-6 text-2xl font-semibold text-slate-800 sm:text-3xl">Use it in Python!</h2>
        <pre className="overflow-x-auto rounded-full border border-white/80 bg-white/78 px-6 py-4 shadow-[0_12px_28px_rgba(148,163,184,0.1)]">
          <code className="font-mono text-sm text-slate-800">pip install triples</code>
        </pre>
      </section>
    </div>
  );
};

export default TriplesSolverPage;
