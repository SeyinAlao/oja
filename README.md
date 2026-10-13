# Oja

Listing writer for small Nigerian sellers on Instagram and WhatsApp. Upload 1 to 3 product photos, add optional hints, pick a voice (Clear English, Naija Pidgin or Yoruba-flavoured English) and get a title, caption with hashtags, description, WhatsApp status and a rough price guide, ready to copy.

Built with Next.js (App Router), TypeScript (strict), Tailwind CSS and Framer Motion. The AI is any open-weight vision model behind an OpenAI-compatible endpoint; the default is `gemma3:4b` on local Ollama.

> Screenshots: _add `docs/mobile.png` and `docs/result.png` here._

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

## Use another open-weight endpoint

No code changes: set the three variables. For example, any hosted provider serving a vision-capable open model (Gemma 3, Llama 3.2 Vision, Qwen2.5-VL, Pixtral) through `/v1/chat/completions`:

```
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=<vision model id>
AI_API_KEY=<key>
```

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

A GPU or a hosted endpoint is far faster; these are the worst-case numbers.

## Privacy

Photos are resized in the browser, sent once to the model, and never written to disk or a database. Oja has no database, no accounts and no analytics. The server logs only style, image count, model and duration.

## Deploy on Render

A hosted model is required (Render cannot reach your laptop's Ollama).

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Environment: `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, optionally `AI_TIMEOUT_SECONDS`, and `NODE_VERSION=22`.
- Free instances sleep after idle time, so the first request is slow.

## Why open models

Sellers pay for the output, not for a brand of model. Open weights mean you choose where it runs: free on your own machine, on a cheap hosted endpoint, or later on a local box so customer photos never leave your control. Swapping models is an env var, so the product improves whenever a better open model ships.
