import React, { useState, useCallback, useRef } from 'react';
import { GRADIO_TRIPLES_URL } from '../../constants.ts'; // GRADIO_SUM_OF_SQUARES_ENDPOINT is used in service
import { callTriplesGradioApi } from '../../services/triplesService.ts';
import type { GradioServiceCallResult, TriplesOutput } from '../../types.ts';
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

// Helper to generate unique IDs
const generateId = () => `constraint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const TriplesSolverPage: React.FC = () => {
  const [expression, setExpression] = useState<string>('');
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResult, setApiResult] = useState<GradioServiceCallResult | null>(null);
  const [error, setError] = useState<string | null>(null); // For form validation or client-side issues
  const [activeTab, setActiveTab] = useState<TabKey>('solution');
  const [copyStatus, setCopyStatus] = useState<Record<TabKey, string>>({
    solution: 'Copy',
    latex: 'Copy',
    latex_aligned: 'Copy',
  });

  const constraintInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAddConstraint = (type: 'ineq' | 'eq') => {
    const newId = generateId();
    const newConstraint: Constraint = {
      id: newId,
      expression: '',
      alias: '',
      type,
    };
    setConstraints(prev => [...prev, newConstraint]);
    // Focus on the new input field after a short delay to allow DOM update
    setTimeout(() => {
        constraintInputRefs.current?.[`${newId}_expression`]?.focus();
    }, 0);
  };

  const handleConstraintInputChange = (id: string, field: 'expression' | 'alias', value: string) => {
    setConstraints(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
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

    const ineqConstraintsPayload = ineqConstraints.join(';');
    const eqConstraintsPayload = eqConstraints.join(';');

    try {
      const result = await callTriplesGradioApi(expression, ineqConstraintsPayload, eqConstraintsPayload);
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
    if(apiResult && !apiResult.apiSuccess) {
      setApiResult(null);
    }
  }, [apiResult]);

  const handleCopy = useCallback((textToCopy: string, tabKey: TabKey) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copied!' }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copy' }));
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      setCopyStatus(prev => ({ ...prev, [tabKey]: 'Failed' }));
       setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [tabKey]: 'Copy' }));
      }, 2000);
    });
  }, []);

  const proofData = apiResult?.apiSuccess ? apiResult.data : null;

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700">Triples Inequality Prover</h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">
          Enter a mathematical expression and optional constraints to attempt a proof of its non-negativity.
          This tool connects to a Gradio backend at <code className="bg-slate-200 p-1 rounded text-sm">{GRADIO_TRIPLES_URL}</code>.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="expression" className="block text-sm font-medium text-slate-700 mb-1">
            Mathematical Expression
          </label>
          <textarea
            id="expression"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g., x^2 - 2*x*y + y^2"
            rows={3}
            className="w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-800"
            disabled={isLoading}
            aria-label="Mathematical Expression Input"
          />
        </div>

        {/* Constraints Section */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-700">Constraints</h2>
          {constraints.length === 0 && (
            <p className="text-sm text-slate-500">No constraints added. Click buttons below to add.</p>
          )}
          {constraints.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md shadow-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/5">Constraint Expression</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/5">Alias (Optional)</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/5">Type</th>
                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {constraints.map((constraint) => (
                    <tr key={constraint.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          ref={el => { constraintInputRefs.current[`${constraint.id}_expression`] = el; }}
                          type="text"
                          value={constraint.expression}
                          onChange={(e) => handleConstraintInputChange(constraint.id, 'expression', e.target.value)}
                          placeholder="e.g., a*b*c-1"
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          disabled={isLoading}
                          aria-label={`Constraint expression for row ${constraint.id}`}
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={constraint.alias}
                          onChange={(e) => handleConstraintInputChange(constraint.id, 'alias', e.target.value)}
                          placeholder="e.g., F(a,b,c) (defaults to expression)"
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          disabled={isLoading}
                          aria-label={`Alias for constraint row ${constraint.id}`}
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-600">
                        {constraint.type === 'ineq' ? '≥ 0' : '= 0'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveConstraint(constraint.id)}
                          className="text-red-500 hover:text-red-700 opacity-50 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-100"
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
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => handleAddConstraint('ineq')}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              + Add Inequality (≥0)
            </button>
            <button
              type="button"
              onClick={() => handleAddConstraint('eq')}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              + Add Equality (=0)
            </button>
            {constraints.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllConstraints}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 ml-auto"
              >
                Clear All Constraints
              </button>
            )}
          </div>
        </div>


        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Proving...</span>
            </>
          ) : (
            'Prove Non-negativity'
          )}
        </button>
      </form>

      {error && (
        <div className="mt-6">
          <AlertMessage type="error" message={error} onClose={handleClearError} />
        </div>
      )}
      
      {!error && apiResult && !apiResult.apiSuccess && (
         <div className="mt-6">
          <AlertMessage type="error" message={apiResult.errorMessage || "An unknown API error occurred."} onClose={() => setApiResult(null)} />
        </div>
      )}

      {proofData && !proofData.success && proofData.error && (
        <div className="mt-6">
          <AlertMessage type="warning" message={`Proof attempt failed: ${proofData.error}`} onClose={() => setApiResult(null)} />
        </div>
      )}
      
      {proofData && proofData.success && (
        <div className="mt-8 pt-6 border-t border-slate-200 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-3 text-center">Formatted Proof (KaTeX)</h2>
            <div className="bg-slate-50 p-4 rounded-md shadow-inner overflow-x-auto text-center">
              <KatexDisplay latex={proofData.latex_aligned} className="text-lg" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-4 text-center">Result Details</h2>
            <div className="border border-slate-200 rounded-lg shadow-sm">
              <div className="flex border-b border-slate-200">
                {(['solution', 'latex', 'latex_aligned'] as TabKey[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors focus:outline-none
                      ${activeTab === tab 
                        ? 'bg-blue-500 text-white border-b-2 border-blue-700' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }
                      ${tab === 'solution' ? 'rounded-tl-md' : ''}
                      ${tab === 'latex_aligned' ? 'rounded-tr-md' : ''}
                    `}
                  >
                    {tab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
              <div className="p-4 bg-slate-50 rounded-b-lg relative">
                <button
                  onClick={() => handleCopy(proofData[activeTab], activeTab)}
                  className="absolute top-3 right-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium py-1 px-2 rounded transition-colors"
                  aria-label={`Copy ${activeTab.replace('_', ' ')}`}
                >
                  {copyStatus[activeTab]}
                </button>
                <pre className="whitespace-pre-wrap break-all text-slate-800 text-sm leading-relaxed max-h-60 overflow-y-auto pr-16">
                  {proofData[activeTab]}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriplesSolverPage;