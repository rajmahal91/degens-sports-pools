const pools = [
  ["NFL Survivor", "Weekly survivor picks with strict kickoff locks."],
  ["NFL Pick'em", "Weekly picks, standings and season leaderboard."],
  ["NFL Playoff Fantasy", "QB, RB, RB, WR, WR, TE with no player reuse."],
  ["NHL / NBA Brackets", "Four-round playoff bracket challenges."],
  ["Prize Centre", "Upcoming prizes, eligibility and winner history."],
  ["Live Draw", "Commissioner broadcasts with an auditable random draw."],
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">DEGENS SPORTS POOLS</div>
        <h1>One home for every pool.</h1>
        <p className="lead">Survivor, Pick'em, playoff fantasy, NHL and NBA brackets, payments, prizes and live draws — built for the Degens community.</p>
        <div className="status"><span /> Beta deployment online</div>
      </section>

      <section className="grid">
        {pools.map(([title, description]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="coming">Beta module</div>
          </article>
        ))}
      </section>

      <section className="commissioner">
        <div>
          <div className="eyebrow">COMMISSIONER CONTROL</div>
          <h2>Built to run the whole league from one dashboard.</h2>
        </div>
        <p>This direct-source deployment replaces the broken archive bootstrap. The full connected pool modules can now be added on top of a stable Vercel build.</p>
      </section>
    </main>
  );
}
