import { Client } from "@gradio/client";
import { GRADIO_TRIPLES_URL, GRADIO_SUM_OF_SQUARES_ENDPOINT } from '../constants.ts';
import type { GradioServiceCallResult, GradioRawPrediction, TriplesOutput } from '../types.ts';

/**
 * Validates if the given data matches the TriplesOutput structure.
 */
function isTriplesOutput(data: any): data is TriplesOutput {
  return (
    data &&
    typeof data.success === 'boolean' 
    // &&
    // typeof data.solution === 'string' &&
    // typeof data.latex === 'string' &&
    // typeof data.latex_aligned === 'string' &&
    // (typeof data.error === 'string' || data.error === null)
  );
}

/**
 * Calls the Gradio API for the triples sum_of_squares proof.
 * @param expression The mathematical expression string.
 * @param ineqConstraintsStr Optional string of inequality constraints.
 * @param eqConstraintsStr Optional string of equality constraints.
 * @returns A promise that resolves to the API result.
 */
export const callTriplesGradioApi = async (
  expression: string,
  ineqConstraintsStr?: string,
  eqConstraintsStr?: string
): Promise<GradioServiceCallResult> => {
  try {
    const app = await Client.connect(GRADIO_TRIPLES_URL, {});
    
    const payload = {
      expr: expression,
      ineq_constraints: ineqConstraintsStr || "", // Send empty string if undefined
      eq_constraints: eqConstraintsStr || "",   // Send empty string if undefined
    };

    const rawResult: GradioRawPrediction = await app.predict(GRADIO_SUM_OF_SQUARES_ENDPOINT, payload);

    if (rawResult && Array.isArray(rawResult.data) && rawResult.data.length > 0) {
      const triplesData = rawResult.data[0];
      if (isTriplesOutput(triplesData)) {
        return { apiSuccess: true, data: triplesData };
      } else {
        console.warn("Gradio API response data format unexpected:", triplesData);
        return { 
          apiSuccess: false, 
          errorMessage: "Unexpected response data format from proof service." 
        };
      }
    } else if (rawResult && !Array.isArray(rawResult.data) && isTriplesOutput(rawResult.data)) {
      return { apiSuccess: true, data: rawResult.data as TriplesOutput };
    }    
    else {
      console.warn("Gradio API response format unexpected (expected array in data or direct object):", rawResult);
      return { 
        apiSuccess: false, 
        errorMessage: "Unexpected response format from proof service."
      };
    }

  } catch (error: any) {
    console.error("Error calling Gradio API:", error);
    let errorMessage = "An error occurred while communicating with the proof service.";
    if (error.message) {
      errorMessage = error.message;
    }
    if (error instanceof Error && error.message.includes('Could not connect')) {
        errorMessage = `Could not connect to the Triples service at ${GRADIO_TRIPLES_URL}. Please ensure it's running and accessible.`;
    }
    return { apiSuccess: false, errorMessage: errorMessage };
  }
};