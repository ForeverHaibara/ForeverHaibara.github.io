
// constants.ts

/**
 * The base URL for the Gradio 'triples' backend.
 * Replace with your deployed Gradio app URL.
 * For local development, it might be 'http://127.0.0.1:7860/'.
 * If deploying to Hugging Face Spaces, it would be 'your-hf-username/your-space-name'.
 */
export const GRADIO_TRIPLES_URL = 'https://foreverhaibara-ternary-inequality-prover.hf.space/'; // IMPORTANT: Update this URL

/**
 * The specific API endpoint for the sum_of_squares function in your Gradio app.
 * This is often '/api/predict/' or a named route like '/sum_of_squares' if you've defined one.
 * Check your Gradio app's API documentation (usually at GRADIO_TRIPLES_URL + '/info?').
 * The user's example used "/sum_of_squares".
 */
export const GRADIO_SUM_OF_SQUARES_ENDPOINT = '/sum_of_squares'; // IMPORTANT: Update if needed

// Add other global constants here
