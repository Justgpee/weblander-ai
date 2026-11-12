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
npx tsc --noEmit
npm run build
```

## Current scope

The studio supports Generic, Restaurant, Fashion, and Real Estate templates; five visual styles; and Editorial and Split layouts. It generates and edits page-specific content, supports page selection, additional page generation and page-level regeneration, and offers optional user-triggered hero-image generation. Each page supports independent regeneration of its headline, description, features, and call-to-action. Restaurant pages also support Menu Highlights regeneration, Fashion pages support Collection Highlights, and Real Estate pages support Featured Properties. These section actions use `POST /api/regenerate-page-section`; existing `POST /api/regenerate-section` remains available for the original landing-page flow. Project-wide appearance and typed navigation settings are saved separately from the ordered page content. The renderer provides purpose-specific compositions for Home, About, Contact, Restaurant Menu, Fashion Collections, Real Estate Properties, and supported Generic Services and Products pages; older or unknown pages retain a legacy path.

Saved project settings use browser `localStorage`; custom logo image bytes use project-scoped browser `IndexedDB`. Neither storage syncs across browsers or devices (or between accounts or deployment origins), and clearing browser data can remove saved projects and logos. Custom logos accept validated PNG, JPEG, and WebP files up to 2 MB and can show as an image alone or alongside the business name. Export the selected page as a standalone HTML file with embedded styles and its validated hero image and logo, or export the complete stored website as a ZIP containing individual HTML pages, shared CSS, and shared image assets when present. Typed CTA targets support safe HTTP(S) links, same-page sections, and explicitly selected pages or page sections. Legacy external URLs and supported section anchors remain compatible. The brand logo links Home in Studio and complete website exports; a standalone secondary-page export has no invented Home destination.

Repository configuration expects `OPENAI_API_KEY` on the server and optionally `OPENAI_MODEL`; the provider uses a default model when the latter is absent. Keep credentials in server-side deployment settings and never use a `NEXT_PUBLIC_` prefix for them. Cost-bearing POST routes include `/api/generate`, `/api/generate-template`, `/api/generate-fashion`, `/api/generate-real-estate`, `/api/generate-page`, `/api/regenerate-section`, `/api/regenerate-page-section`, and `/api/generate-image`.

## Vercel preview testing

The following setup is intended for **personal, non-commercial testing** on Vercel Hobby and remains subject to Vercel's current plan terms. Repository source cannot configure or verify Vercel or OpenAI dashboard settings.

### Reported private-preview configuration

The following deployment settings and test were reported by the project owner; they have **not** been independently inspected in either dashboard by this repository or this guide:

- Vercel Deployment Protection is reported enabled for **All Deployments** using Vercel Authentication, with access limited to authorized Vercel accounts. The owner reports that an incognito visit displayed the authentication screen. Testers should sign in with an authorized Vercel account; this setup is not an anonymous shareable-link flow.
- The owner previously reported a Vercel Firewall fixed-window rate-limit rule named `weblander-ai-api-rate-limit` covering the seven original cost-bearing routes, with a shared starting threshold of 10 requests per source IP per 60 seconds and a 429 action. For this release, verify that its match covers **all** of these cost-bearing POST paths: `/api/generate`, `/api/generate-template`, `/api/generate-fashion`, `/api/generate-real-estate`, `/api/generate-page`, `/api/regenerate-section`, `/api/regenerate-page-section`, and `/api/generate-image`. This README does not claim that the rule has been updated or verified.
- The owner previously reported a Monitoring rule named `WebLander AI - AI API Monitoring` logging POST requests to the seven original routes. For this release, verify that its match covers **all** of these cost-bearing POST paths: `/api/generate`, `/api/generate-template`, `/api/generate-fashion`, `/api/generate-real-estate`, `/api/generate-page`, `/api/regenerate-section`, `/api/regenerate-page-section`, and `/api/generate-image`. The owner reports a test request to `/api/generate` with an invalid brief returned `400 INVALID_BRIEF` and appeared in Firewall logs. This verifies only that reported test path; it does not prove that valid provider calls are blocked at the rate threshold or establish a spending cap. This README does not claim that the Monitoring rule has been updated or verified.

These rate and monitoring settings are dashboard configuration, not application-level user quotas. IP-based limits can affect multiple testers behind the same network, and a firewall threshold is not a guaranteed global OpenAI spend ceiling. Verify the actual rule match conditions, counters, response behavior, and plan availability in Vercel before inviting testers.

### Preview release checklist

1. Use a non-production branch for the test build. Confirm in Vercel that it is a **Preview** deployment, that its deployment build completed successfully, and that the intended Production branch and Production deployment are not being exposed by mistake. Keep Deployment Protection enabled for both Preview and Production URLs during this private-testing milestone. Access to dashboard settings has not been independently verified here.
2. Confirm Deployment Protection covers **All Deployments** and that each invited tester's Vercel account is authorized. Test both the ordinary Preview URL and any deployment-specific URL in a private browser session. Do not distribute an unprotected URL.
3. In Vercel's **Preview** environment only, configure `OPENAI_API_KEY` as a server-side secret. Optionally set `OPENAI_MODEL` there. Do not define either as `NEXT_PUBLIC_*`. Redeploy the Preview after changing environment variables. The repository reads these values in server-side provider modules; it does not confirm that deployment settings exist or are correct.
4. Verify the configured Node.js runtime and function-duration/Fluid Compute settings against the current Vercel documentation and the provider timeout used by the application. The local package declares Next.js 16.4.1; local configuration does not prove the deployed runtime settings.
5. In the Vercel Firewall dashboard, verify that the reported fixed-window rule covers all eight cost-bearing POST paths, including `/api/regenerate-page-section`, and uses the intended shared per-IP threshold/action. Confirm the separate Monitoring rule covers those same paths, is active, and review its logs. Safely test rejection with invalid requests that do not reach the provider, then test rate limiting without valid provider payloads where the deployed rules make that possible; do not use repeated valid AI requests as a load test. These dashboard settings are not independently verified by this README or repository.
6. In the OpenAI dashboard, use a separate staging project/key for Preview and review available spend alerts, project limits, and model/request/token controls. A previously proposed $5 hard spend limit has **not** been verified as configured or as an instantaneous guaranteed ceiling. Treat alerts and limits as safeguards that may lag, not as a precise maximum cost.
7. Smoke-test one invited session across text generation, additional-page generation, core and template-specific section regeneration, page regeneration, optional image generation, editing and reopening a saved project, selected-page HTML export, and complete website ZIP export with navigation and CTA destinations. Projects are stored in that browser's `localStorage` and are not synced; use the same browser and deployment origin to reopen them.
8. Keep the Production deployment protected and non-public for this milestone. Before any public SaaS release, separately review authentication, per-user quotas, abuse controls, privacy expectations, and cost monitoring; the current IP rule is not a substitute for application-level account limits.

The private preview should remain available only to authorized testers while these settings are in place. Recheck protection after configuration changes or redeployments. No public launch or production security configuration is claimed by this README.

### Release readiness and verification status

- **Repository capabilities:** The studio includes initial landing-page generation, Generic, Restaurant, Fashion, and Real Estate template flows, five visual styles, Editorial and Split layouts, optional hero-image generation, editable generated content, browser-local projects, multi-page generation and page-specific editing, independently regenerated core and template-specific page sections, typed navigation and CTA targets, a clickable Home brand logo, selected-page standalone HTML export, and complete multi-page ZIP export. Page compositions include Home, About, Contact, Menu, Services, and Products variants where supported by the selected template. Milestone 13F.1 accessibility work is represented in the studio controls and accessibility tests. The repository test suite covers these behaviors; passing automated tests do not replace the deployed smoke tests below.
- **Previously reported verification:** An isolated production build passed in a temporary workspace without `.env*` files or provider credentials. It preserved the 39 dirty Git entries present when that check was run. This does not verify a Vercel deployment build, and the working-tree state can change independently.
- **Owner-reported deployment facts:** Authentication, Firewall rules, and the invalid-brief log event above were reported by the owner and tested in the owner's browser/dashboard. Codex has not independently inspected Vercel settings or deployment behavior.
- **Not yet verified for this release:** Successful Preview deployment build and post-deployment smoke tests for each listed flow, plus Firewall matching and 429 behavior at the configured threshold. The reported invalid-brief request does not validate provider-backed generation or rate-limit enforcement.

Before a protected Preview deployment, confirm Vercel Authentication is active for all deployments, authorize tester accounts, verify all eight cost-bearing routes (including `/api/regenerate-page-section`) match both the Firewall rate-limit and Monitoring rules, and configure Preview credentials only as server-side variables. This documentation does not claim the dashboard rules have been updated or independently verified. IP-based rules are secondary protection; they do not provide per-user quotas or a guaranteed global cost ceiling. During Preview, verify the deployment build and smoke-test the checklist flows. Before a public SaaS launch, add and verify application-level authentication, per-user quotas, abuse controls, and a persistence model suitable for cross-device use, and review current Hobby plan collaborator and Firewall limits. Those controls are not claimed as implemented here.
