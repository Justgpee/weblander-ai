# WebLander AI

WebLander AI turns a business brief into landing-page copy and a visual preview. The current milestone uses the OpenAI Responses API to generate structured content; it does not generate or execute HTML, JavaScript, or JSX.

## Getting started

Requirements: Node.js and npm. Install dependencies, copy the example environment file, and add your OpenAI API key to `.env.local`:

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` locally. Set `OPENAI_API_KEY` to your key and optionally change `OPENAI_MODEL`. Keep the key private; `.env.local` is ignored by Git.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project scripts

```bash
npm test       # Unit and route tests (mocked; no live API request)
npm run evaluate # Deterministic copy evaluation fixtures
npm run lint
npm run build
```

## Current scope

The app includes a business brief form, visual style selection, structured AI copy generation, editable generated copy with section regeneration, configurable three-link navigation and call-to-action destinations, and a responsive landing-page preview with two layouts. Saved website projects are stored locally in the current browser; they are not synced across devices or accounts. Standalone HTML export includes the current content, layout, and validated site links.
