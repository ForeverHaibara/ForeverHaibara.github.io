
import React, { useState, useCallback } from 'react';
import { GRADIO_TRIPLES_URL } from '../../constants';
import { callTriplesGradioApi } from '../../services/triplesService';
import type { GradioServiceCallResult, TriplesOutput } from '../../types'; // Updated import
import LoadingSpinner from '../../components/LoadingSpinner';
import AlertMessage from '../../components/AlertMessage';

const TriplesSolverPage: React.FC = () => {
  const [expression, setExpression] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiServiceResult, setApiServiceResult] = useState<GradioServiceCallResult | null>(null); // Updated state type
  const [clientError, setClientError] = useState<string | null>(null); // Renamed 'error' for clarity

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!expression.trim()) {
      setClientError('Please enter a mathematical expression.');
      setApiServiceResult(null);
      return;
    }

    setIsLoading(true);
    setClientError(null);
    setApiServiceResult(null);

    try {
      const serviceResponse = await callTriplesGradioApi(expression);
      setApiServiceResult(serviceResponse);
      // Further error display is handled in the render section based on apiServiceResult
    } catch (err: any) { // Fallback catch, though callTriplesGradioApi should handle it
      console.error('Gradio API call failed unexpectedly in handleSubmit:', err);
      setApiServiceResult({ apiSuccess: false, errorMessage: err.message || 'Client-side error during API call.' });
    } finally {
      setIsLoading(false);
    }
  }, [expression]);

  const handleClearClientError = useCallback(() => {
    setClientError(null);
  }, []);

  const handleClearApiError = useCallback(() => {
    setApiServiceResult(null);
  }, []);


  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-3xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700">Triples Inequality Prover</h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">
          Enter a mathematical expression to attempt a proof of its non-negativity using the Sum of Squares (SOS) method.
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
            placeholder="e.g., x^2 - 2*x*y + y^2 or a*b*(a-b)^2 + b*c*(b-c)^2 + c*a*(c-a)^2"
            rows={4}
            className="w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-800"
            disabled={isLoading}
            aria-label="Mathematical Expression Input"
          />
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

      {/* Display client-side validation errors */}
      {clientError && (
        <div className="mt-6">
          <AlertMessage type="error" message={clientError} onClose={handleClearClientError} />
        </div>
      )}

      {/* Display API communication errors (if no client error is active) */}
      {!clientError && apiServiceResult && !apiServiceResult.apiSuccess && (
         <div className="mt-6">
          <AlertMessage type="error" message={apiServiceResult.errorMessage || "An API error occurred."} onClose={handleClearApiError} />
        </div>
       )}
      
      {/* Display results from the proof service (if API call was successful and no client error) */}
      {!clientError && apiServiceResult && apiServiceResult.apiSuccess && apiServiceResult.data && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-700 mb-3">Proof Result:</h2>
          {apiServiceResult.data.success ? (
            <div className="bg-slate-50 p-4 rounded-md shadow">
              <pre className="whitespace-pre-wrap break-all text-slate-800 text-sm leading-relaxed">
                {`Proof Successful. Solution:\n${apiServiceResult.data.solution}`}
              </pre>
            </div>
          ) : (
            // Proof service ran but did not find a proof or expression is not non-negative
            <AlertMessage 
              type="warning" 
              message={apiServiceResult.data.error || "The proof could not be completed or the expression might not be provably non-negative with this method."} 
              onClose={handleClearApiError}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TriplesSolverPage;
