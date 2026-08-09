export default function HomePage() {
  return (
    <main className="stage-shell">
      <section className="stage-panel" aria-labelledby="stage-title">
        <p className="stage-kicker">ShopVerse migration</p>
        <h1 id="stage-title">Next.js foundation is ready.</h1>
        <p>
          Stage 02 replaces the obsolete Vite prototype with a clean App Router
          baseline. Storefront, catalogue, checkout, payments and admin features
          are intentionally deferred to their own stages.
        </p>
      </section>
    </main>
  );
}
