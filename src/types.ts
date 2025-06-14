// types.ts

/**
 * Represents the raw prediction result from the @gradio/client.
 */
export interface GradioRawPrediction {
  data: any; // This will typically be an array, e.g., [TriplesOutput]
  // May include other properties like `is_generating`, `duration`, `event_id`, etc.
}

/**
 * Defines the expected structure of the JSON object returned by the Gradio backend
 * for a 'triples' proof attempt.
 */
export interface TriplesOutput {
  success: boolean; // Indicates if the proof attempt was successful
  solution: string;
  latex: string;
  latex_aligned: string;
  error: string | null; // Error message if the proof attempt failed
}

/**
 * Represents the structured result from our service wrapper for Gradio API calls.
 */
export interface GradioServiceCallResult {
  apiSuccess: boolean; // Indicates if the API call to Gradio itself was successful
  data?: TriplesOutput; // The parsed data from Gradio if the API call was successful
  errorMessage?: string; // Error message if the API call failed or data parsing failed
}
