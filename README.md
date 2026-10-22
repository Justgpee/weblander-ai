# WebLander AI

WebLander AI turns a business brief into landing-page copy and a visual preview. The app uses the OpenAI Responses API to generate structured text and the OpenAI Images API for optional, user-triggered hero artwork; neither feature generates or executes HTML, JavaScript, or JSX.

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

The app includes a business brief form, visual style selection, structured AI copy generation, editable generated copy with section regeneration, optional user-triggered hero image generation, configurable three-link navigation and call-to-action destinations, and a responsive landing-page preview with two layouts. Saved website projects, including generated hero images, are stored locally in the current browser; they are not synced across devices or accounts. Standalone HTML export embeds the current image and includes the current content, layout, and validated site links.

## Vercel preview testing

The following setup is intended for **personal, non-commercial testing** on Vercel Hobby and is subject to Vercel's current plan terms. Verify plan eligibility and all settings in the Vercel and OpenAI dashboards; these settings are not configured by this repository.

1. Create a non-production branch from the version you want testers to review and push it to GitHub. When importing this repository, confirm `master` is the intended production branch and that the deployment target is labeled **Preview** before deploying or sharing it. Vercel may otherwise use `master` as the production branch when `main` is absent.
2. Enable Vercel Authentication for Preview deployments, then create one shareable link for the Preview deployment. Shareable links let people view the deployment without Vercel accounts, but the link is a bearer credential: anyone who receives it can access the deployment until it is revoked. Hobby currently allows one shareable link per account. Without deployment protection, anyone with the ordinary deployment URL can view it. A Vercel account is needed for collaboration features such as comments.
3. In Vercel project settings, configure `OPENAI_API_KEY` as a **Preview-only server-side secret**. Optionally set `OPENAI_MODEL` as Preview-only configuration. Do not use a `NEXT_PUBLIC_` variable for the key. Redeploy the Preview after changing environment variables.
4. Verify the Vercel project uses Node.js 20.9 or later and check that Fluid Compute is enabled. New Vercel projects enable it by default, but verify the setting. If it is disabled, the default Hobby function duration can be shorter than this app's 30-second OpenAI request timeout; confirm suitable function-duration configuration before testing.
5. In the Vercel Firewall dashboard, configure one fixed-window rate-limit rule for `POST` requests whose path is `/api/generate`, `/api/regenerate-section`, or `/api/generate-image`, counted by source IP. **Proposed setting to configure and verify:** approximately 10 combined requests per IP per minute. Hobby permits one rate-limit rule per project, so all three routes share the limit. Testers behind the same network may share an IP limit, and regional counters mean this is not a global spending cap. Confirm current WAF availability, limits, and pricing in the dashboard.
6. In the OpenAI dashboard, create a separate staging project and key for Preview. **Proposed setting to configure and verify:** a $5 project hard spend limit, with lower spend alerts and conservative model request/token limits where available. Alerts do not stop requests, and hard-limit enforcement can lag and allow slight overspend; do not treat $5 as a guaranteed exact ceiling.
7. Saved projects remain in each tester's browser storage. They do not sync across browsers or devices, and a different deployment origin has separate browser storage. Use the same stable Preview branch URL when revisiting saved projects.
8. When testing ends, revoke the shareable link in the Vercel deployment's Share settings.
