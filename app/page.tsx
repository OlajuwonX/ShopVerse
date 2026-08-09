export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 px-6 py-12 text-stone-950">
      <section className="w-full max-w-2xl" aria-labelledby="stage-title">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-stone-500">
          ShopVerse migration
        </p>
        <h1 id="stage-title" className="text-5xl font-bold leading-none md:text-7xl">
          Core configuration is ready.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-stone-700">
          Stage 03 configures TypeScript, Tailwind CSS v4, formatting, environment
          validation, security headers and base metadata. Commerce features remain
          deferred to their own stages.
        </p>
      </section>
    </main>
  );
}
