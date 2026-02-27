# Winnie's Pup Coach

A React application to help manage your puppy's schedule and training, powered by Gemini AI.

## Deployment to Vercel

This project is ready to be deployed to Vercel.

### Prerequisites

1.  A Vercel account.
2.  A Google Gemini API Key.

### Steps

1.  **Push to GitHub/GitLab/Bitbucket**: Push this repository to your preferred git provider.
2.  **Import Project in Vercel**:
    *   Go to your Vercel dashboard.
    *   Click "Add New..." -> "Project".
    *   Import the repository you just pushed.
3.  **Configure Project**:
    *   Vercel should automatically detect that this is a Vite project.
    *   **Environment Variables**: You MUST add the following environment variable:
        *   `GEMINI_API_KEY`: Your Google Gemini API key.
4.  **Deploy**: Click "Deploy".

### Important Note on Security

Since this is a client-side application, the `GEMINI_API_KEY` will be embedded in the build. This means it is visible to anyone who inspects the application code in the browser.

**Recommendation**: Restrict your API key in the Google Cloud Console to only allow requests from your Vercel deployment domain (e.g., `your-app-name.vercel.app`).

## Development

To run locally:

1.  Clone the repo.
2.  Create a `.env` file with `GEMINI_API_KEY=your_key_here`.
3.  Run `npm install`.
4.  Run `npm run dev`.
