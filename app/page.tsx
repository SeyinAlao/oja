import { Studio } from "@/components/Studio";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <span className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream">
          Open-weight AI
        </span>
      </header>

      <main className="flex-1 pb-12">
        <section className="py-6 sm:py-10">
          <h1 className="font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
            Snap it. We write it.
            <br />
            <span className="text-saffron-deep">You sell it.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Upload a photo of what you’re selling and get a caption, description and WhatsApp status that
            sound like you, in clear English, Naija Pidgin or Yoruba-flavoured English.
          </p>
        </section>
        <Studio />
      </main>

      <footer className="border-t border-forest/15 py-6 text-sm text-muted">
        <p>
          <strong className="font-semibold text-forest">Your photos stay private.</strong> They are
          resized in your browser, sent once to the AI model, and never saved. Oja keeps no database and no
          copies.
        </p>
        <p className="mt-1">Prices are a rough guide, not a guarantee. Always check the market.</p>
      </footer>
    </div>
  );
}
