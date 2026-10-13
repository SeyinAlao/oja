# Oja

Listing writer for small Nigerian sellers on Instagram and WhatsApp. Upload 1 to 3 product photos, add optional hints, pick a voice (Clear English, Naija Pidgin or Yoruba-flavoured English) and get a title, caption with hashtags, description, WhatsApp status and a rough price guide, ready to copy.

Built with Next.js (App Router), TypeScript (strict), Tailwind CSS and Framer Motion. The AI is any open-weight vision model behind an OpenAI-compatible endpoint; the default is `gemma3:4b` on local Ollama.

<p>
  <img src="docs/mobile.png" alt="Oja on a phone: empty state with photo upload, hints and style picker" width="300">
  <img src="docs/result.png" alt="Oja on a phone: a generated Naija Pidgin listing with copy buttons and a price guide" width="300">
</p>

The second screenshot is one real generation from `gemma3:4b` on local Ollama (CPU only), not a mock-up.

## Run locally

```powershell
ollama pull gemma3:4b
ollama serve          # skip if Ollama is already running
pnpm install
pnpm dev              # http://localhost:3000
```

Other scripts: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Environment variables

Copy `.env.example` to `.env.local` if you want to change anything.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible base URL (`/chat/completions` is appended) |
| `AI_MODEL` | `gemma3:4b` | Model name, must support image input |
| `AI_API_KEY` | empty | Sent as a Bearer token when set |
| `AI_TIMEOUT_SECONDS` | `300` | Per-request timeout |

## Using a hosted open-weight model

No code changes: set `AI_BASE_URL`, `AI_MODEL` and (if the provider needs one) `AI_API_KEY`. The key is sent as `Authorization: Bearer <key>`; with no key, no header is sent (tested both ways). The model must accept image input.

| Provider | `AI_BASE_URL` | `AI_MODEL` (example only) | `AI_API_KEY` |
| --- | --- | --- | --- |
| Local Ollama | `http://localhost:11434/v1` | `gemma3:4b` | leave empty |
| OpenRouter | `https://openrouter.ai/api/v1` | a `provider/model` slug of a vision-capable open model | OpenRouter key |
| Google AI Studio (hosted Gemma) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemma-4-31b-it` or `gemma-4-26b-a4b-it` | Gemini API key |
| Any OpenAI-compatible provider | `https://<host>/v1` | the provider's vision model id | provider key |

What was checked (against the providers' own docs, 13 Oct 2026) and what was not:

- OpenRouter's base URL and Bearer auth are documented. Pick the model slug from `openrouter.ai/models` or `GET /api/v1/models`, and filter for image input.
- Google documents the OpenAI-compatible base URL, Bearer auth and `image_url` data URLs. Its Gemma page lists `gemma-4-31b-it` and `gemma-4-26b-a4b-it` on the Gemini API with image support. I did not confirm that those Gemma IDs are served through the OpenAI-compatible path specifically, and I have not run them. Treat the model names as examples and check the provider's current list.
- Hosted endpoints receive the photos you send. Only the local Ollama setup keeps them on your machine.

## How the AI layer works

- `POST /api/generate` takes `{ images: dataUrl[], hints, style }`.
- Images go in the OpenAI vision format (`image_url` parts); the model is asked for one strict JSON object.
- Output passes through markdown-fence stripping and a brace-balanced extractor, then a zod schema. If invalid, one repair call tells the model what was wrong. After that it returns a clear error.
- Small tolerances: price strings like "₦12,000" are coerced to integers, a reversed range is swapped, hashtags get a `#`.
- Prompt is compact, `max_tokens` is 900, and each style has its own voice brief.
- Generation time is logged (`[oja] generated ... ms=`) and returned as `ms`.

## Decisions

- **Rate limit** is in memory, 10 requests/minute per IP; fine for one instance.
- **Body limit** 6 MB; the browser resizes to 1024px JPEG first.
- **Timeout default 300s**: on a CPU-only laptop gemma3:4b took about 2.5 minutes per listing, so a shorter default would fail regularly.
- **Price guide** is always labelled a rough guide; the model also writes its own note.
- **No streaming**, because the output must be complete valid JSON before it is shown.
- **TypeScript 6**, since typescript-eslint does not support TS 7 yet.

## Measured generation time

`gemma3:4b` on Ollama 0.40.3, 100% CPU, one 1024px photo, hints supplied, no repair needed:

| Style | Server time |
| --- | --- |
| Clear English | 148.7 s |
| Naija Pidgin | 148.0 s |
| Yoruba-flavoured | 157.2 s |

A later run through the browser UI (Naija Pidgin, same photo) took 215.0 s on the server, 215.6 s in the UI, on the same CPU, so expect 2.5 to 3.5 minutes locally. That is why the UI shows an elapsed-seconds counter for local models. A GPU or a hosted endpoint is far faster; I have not measured a hosted endpoint yet.

## Privacy

Photos are resized in the browser, sent once to the model, and never written to disk or a database. Oja has no database, no accounts and no analytics. The server logs only style, image count, model and duration. With local Ollama the photos never leave your machine; with a hosted endpoint they go to that provider, and the model badge in the UI says which one is in use. `/api/health` returns only `ok`, the model name and whether it is local, never the URL or key.

## Deploy on Render

A hosted model is required: Render cannot reach Ollama on your laptop. `render.yaml` describes the service (Node 22, Frankfurt, free plan, health check `/api/health`).

Manual steps:

1. Push the repo to GitHub.
2. Render dashboard: **New > Blueprint**, pick the `oja` repo, apply. Render asks for `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` (they are `sync: false`, so they are never in git). Use the table above.
3. Wait for the first deploy, then open `https://<service>.onrender.com/api/health`. It should return `{"ok":true,"model":"...","local":false}`.
4. Custom domain: service **Settings > Custom Domains > + Add Custom Domain**, enter `oja-ng.tech`, Save. Render also adds `www.oja-ng.tech` and redirects it to the root.
5. At your DNS provider (details below), then click **Verify** on Render and wait for the certificate.

DNS for `oja-ng.tech` (from Render's docs; confirm the values shown in your dashboard):

| Name | Type | Value |
| --- | --- | --- |
| `@` (root) | `ALIAS` or `ANAME` | `<service>.onrender.com` |
| `@` (root), if your provider has neither | `A` | `216.24.57.1` (Cloudflare: use a `CNAME` instead) |
| `www` | `CNAME` | `<service>.onrender.com` |

Remove any `AAAA` records and any domain-forwarding feature on the domain.

Notes:

- The build command is `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`. Corepack reads `packageManager` (`pnpm@11.1.2`) from `package.json`. `--prod=false` keeps TypeScript and Tailwind in case `NODE_ENV=production` is set at build time. `pnpm-workspace.yaml` (`allowBuilds`) is committed and was honoured in a clean clone with `NODE_ENV=production`. That clean-clone build ran on Windows; I have not run it on Render itself.
- `NODE_VERSION=22` is set in `render.yaml` (Render's default is currently newer), and `engines` in `package.json` allows 22 to 24.
- Free instances sleep after idle time, so the first request after a pause is slow.
- Optional: set `AI_TIMEOUT_SECONDS` to something shorter for hosted models.

## Why open models

Sellers pay for the output, not for a brand of model. Open weights mean you choose where it runs: free on your own machine, on a cheap hosted endpoint, or later on a local box so customer photos never leave your control. Swapping models is an env var, so the product improves whenever a better open model ships.
