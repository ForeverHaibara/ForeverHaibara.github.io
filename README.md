# ForeverHaibara Personal Website

This is the source code for the personal website of ForeverHaibara, built with React, TypeScript, Tailwind CSS, and featuring an interactive demo for the 'triples' inequality proof library using a Gradio backend.

Homepage: [https://foreverhaibara.github.io/](https://foreverhaibara.github.io/)

## Features

-   Clean, modern, responsive design with a blue/white color scheme.
-   Multiple pages (Home, About, Triples Solver, Triples Documentation).
-   **Triples Solver**: An interface to input mathematical expressions and get non-negativity proofs via the Sum of Squares method by calling a Gradio backend. Results are rendered using KaTeX.
-   **KaTeX Integration**: Uses a locally installed `katex` package for rendering mathematical notation.

## Tech Stack

-   **Frontend**: React 18, TypeScript, Vite (recommended for setup), Tailwind CSS
-   **Routing**: React Router (HashRouter for GitHub Pages compatibility)
-   **LaTeX Rendering**: KaTeX (local npm package)
-   **Gradio Interaction**: `@gradio/client`

## Project Setup and Running Locally

To run and build this project, a development environment with Node.js and a bundler like Vite is required.

**1. Prerequisites:**
   - Node.js (v18.x or newer recommended)
   - npm or yarn

**2. Initialize a Vite Project (if starting from scratch):**
   ```bash
   npm create vite@latest my-personal-website -- --template react-ts
   cd my-personal-website
   npm install
   ```

**3. Integrate Generated Files:**
   - Copy all the generated `.tsx`, `.ts`, `.html`, and `.json` files into the appropriate directories of your Vite project. Typically:
     - `index.html` at the project root.
     - `App.tsx`, `index.tsx` (or `main.tsx`), `components/`, `pages/`, `services/`, `types.ts`, `constants.ts` inside the `src/` directory.
     - `metadata.json`, `README.md` at the project root.
   - Adjust paths in `index.html` (e.g., `src="/src/index.tsx"` or `src="/src/main.tsx"`) and imports if your file structure differs from the one Vite creates. The current `index.html` has `src="/index.tsx"`.

**4. Install Dependencies:**
   Make sure you have the necessary dependencies installed:
   ```bash
   npm install react react-dom react-router-dom @gradio/client katex
   # For development
   npm install -D typescript @types/react @types/react-dom @types/katex @vitejs/plugin-react tailwindcss postcss autoprefixer
   ```

**5. Configure Tailwind CSS with Vite:**
   - Create `tailwind.config.js` and `postcss.config.js`:
     ```bash
     npx tailwindcss init -p
     ```
   - Configure `tailwind.config.js`:
     ```javascript
     /** @type {import('tailwindcss').Config} */
     export default {
       content: [
         "./index.html", // If index.html is in root
         "./src/**/*.{js,ts,jsx,tsx}", // If your source files are in src/
         // Add direct paths if your structure differs
         // "./components/**/*.{js,ts,jsx,tsx}",
         // "./pages/**/*.{js,ts,jsx,tsx}",
       ],
       theme: {
         extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'], // Match font in index.html
            },
         },
       },
       plugins: [],
     }
     ```
   - Create a `src/index.css` (or `style.css`) file and add Tailwind directives:
     ```css
     @tailwind base;
     @tailwind components;
     @tailwind utilities;
     ```
   - Import this CSS file in your main entry point (e.g., `src/index.tsx` or `src/main.tsx`):
     ```typescript
     import './index.css'; // Or your CSS file path
     // Ensure KaTeX CSS is also imported, typically in KatexDisplay.tsx or globally here
     // import 'katex/dist/katex.min.css'; // If not imported directly in the component
     ```
   - **Note:** The generated `index.html` previously used the Tailwind CDN. If you set up Tailwind with PostCSS as described, you should remove the Tailwind CDN script tag from `index.html` for a fully bundled approach.

**6. Configure Gradio Backend URL:**
   - Open `src/constants.ts` (assuming constants.ts is in `src/`).
   - Update `GRADIO_TRIPLES_URL` to point to your deployed Gradio application.
     ```typescript
     export const GRADIO_TRIPLES_URL = 'YOUR_GRADIO_APP_URL'; // e.g., 'https://username-spacename.hf.space/' or 'http://localhost:7860/'
     ```
   - Ensure `GRADIO_SUM_OF_SQUARES_ENDPOINT` matches the API endpoint name in your Gradio app.

**7. Start the Development Server:**
   ```bash
   npm run dev
   ```
   This will typically start the app on `http://localhost:5173`.

## Triples Gradio Backend

The "Triples Solver" page communicates with a Gradio backend. You need to have this backend running and accessible at the URL specified in `constants.ts`.

**Example Gradio App (`app.py`):**
```python
import gradio as gr

# Placeholder for your actual triples library logic
# from your_triples_library import prove_non_negativity # This should return a dict like TriplesOutput
# e.g.
# def prove_non_negativity(expr_str: str):
#     # ... your logic ...
#     if success:
#         return {
#             "success": True,
#             "solution": " (a - b)**2 ",
#             "latex": " \\\\text{LHS} = \\\\left(a - b\\\\right)^{2} ",
#             "latex_aligned": " \\\\text{LHS} &= \\\\left(a - b\\\\right)^{2} ",
#             "error": None
#         }
#     else:
#         return {
#             "success": False,
#             "solution": "",
#             "latex": "",
#             "latex_aligned": "",
#             "error": "Could not prove."
#         }


def sum_of_squares_proof(expr: str): # Matches Gradio client input { expr: "..." }
    """
    Attempts to prove the non-negativity of the expression.
    Returns a dictionary matching the TriplesOutput structure.
    """
    print(f"Received expression: {expr}")
    if not expr.strip():
        return { "success": False, "solution": "", "latex": "", "latex_aligned": "", "error": "Please enter a mathematical expression." }
    
    try:
        # result_dict = prove_non_negativity(expr) # Your actual library call
        # Dummy logic for demonstration:
        if "x^2" in expr and "y^2" in expr and "-2*x*y" in expr :
             result_dict = {
                "success": True,
                "solution": f"{expr} = (x - y)^2",
                "latex": f"{expr} = (x - y)^2",
                "latex_aligned": f"{expr} &= (x - y)^2",
                "error": None
            }
        elif "error_test" in expr:
            result_dict = { "success": False, "solution": "", "latex": "", "latex_aligned": "", "error": "This is a simulated processing error." }
        else:
            result_dict = { "success": False, "solution": "", "latex": "", "latex_aligned": "", "error": f"Could not automatically prove non-negativity for '{expr}'." }
        return result_dict

    except Exception as e:
        return { "success": False, "solution": "", "latex": "", "latex_aligned": "", "error": f"Error processing expression '{expr}': {str(e)}" }

# Create the Gradio interface
# For the JS client to correctly parse the JSON output, the output component should be gr.JSON or ensure your string output is valid JSON.
# If returning a dictionary, Gradio handles JSON serialization.
iface = gr.Interface(
    fn=sum_of_squares_proof,
    inputs=gr.Textbox(lines=3, placeholder="Enter mathematical expression (e.g., x^2 - 2*x*y + y^2)", label="Expression (expr)"), # input component name is not 'expr', Gradio uses argument name
    # The output component should ideally be gr.JSON if your function returns a dict that needs to be directly used as JSON by the client.
    # If using gr.Textbox, ensure the Python function returns a string representation of the JSON or that the JS client handles it.
    # Given the JS client expects a JSON object in `result.data[0]`, `outputs=gr.JSON()` is preferred.
    outputs=gr.JSON(label="Proof Result"), 
    # outputs=gr.Textbox(label="Proof Result", lines=10), # If returning stringified JSON
    title="Triples Inequality Prover Backend",
    description="Backend service for proving non-negativity of mathematical expressions using SOS method.",
    allow_flagging="never",
    # The api_name parameter for gr.Interface or specific routes in gr.Blocks is important for client.predict("/api_name")
    # If no api_name, default is often /api/predict/ or just /predict (index-based)
    # The client uses GRADIO_SUM_OF_SQUARES_ENDPOINT = '/sum_of_squares'
    # This implies the Gradio app needs to expose an endpoint with this name.
    # One way is using gr.Blocks and naming the API for a button or event:
    # with gr.Blocks() as demo:
    #    input_expr = gr.Textbox(label="Expression")
    #    output_json = gr.JSON(label="Result")
    #    btn = gr.Button("Prove")
    #    btn.click(fn=sum_of_squares_proof, inputs=input_expr, outputs=output_json, api_name="sum_of_squares")
    # demo.launch(...)
    # For a simple gr.Interface, if the URL path /sum_of_squares is critical, ensure Gradio version and setup supports it.
    # Otherwise, adjust GRADIO_SUM_OF_SQUARES_ENDPOINT in constants.ts to what Gradio exposes (e.g. /predict or an index).
)


if __name__ == "__main__":
    iface.launch(server_name="0.0.0.0", server_port=7860) # Default URL: http://localhost:7860
```
Run this Python script to start your Gradio backend.

## Building for Production

```bash
npm run build
```
This command will create a `dist` folder with the optimized static assets for your website.

## Deploying to GitHub Pages

1.  **Repository Setup:**
    -   Ensure your project is a GitHub repository.
    -   Push your code to the repository.

2.  **Configure `vite.config.js`:**
    -   Set the `base` path if deploying to a subdirectory (e.g., `https://YourUsername.github.io/YourRepositoryName/`):
        ```javascript
        // vite.config.js
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react()],
          base: '/YourRepositoryName/', // Replace YourRepositoryName
        });
        ```
    -   If deploying to `https://YourUsername.github.io/`, `base` should be `/`.

3.  **Build the Project:**
    ```bash
    npm run build
    ```

4.  **Deploy (GitHub Actions recommended):**
    Create `.github/workflows/deploy.yml`:
    ```yaml
    name: Deploy to GitHub Pages

    on:
      push:
        branches:
          - main # Or your default branch
      workflow_dispatch:

    permissions:
      contents: read
      pages: write
      id-token: write

    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout repository
            uses: actions/checkout@v4
          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '18'
              cache: 'npm'
          - name: Install dependencies
            run: npm install
          - name: Build project
            run: npm run build
          - name: Upload GitHub Pages artifact
            uses: actions/upload-pages-artifact@v3
            with:
              path: ./dist

      deploy:
        needs: build
        runs-on: ubuntu-latest
        environment:
          name: github-pages
          url: ${{ steps.deployment.outputs.page_url }}
        steps:
          - name: Deploy to GitHub Pages
            id: deployment
            uses: actions/deploy-pages@v4
    ```

5.  **Configure GitHub Pages Settings:**
    -   In your GitHub repository: `Settings` > `Pages`.
    -   Source: `GitHub Actions`.

Your website should then be live. Remember `HashRouter` usage means URLs will have a `#`.

---

This project provides a solid foundation for your personal website. Feel free to expand upon it by adding more pages, features, and styling. Good luck!