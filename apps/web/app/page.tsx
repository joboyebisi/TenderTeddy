import Link from 'next/link';

const steps = [
  ['Tell us who matters', 'Start with a person, an occasion and only the preferences they have actually shared.'],
  ['See the reason', 'Compare a small, explainable shortlist instead of scrolling through a catalogue.'],
  ['Approve the handoff', 'Check delivery and provider details before you leave WanderWrap. Nothing is silently purchased.']
];

export default function HomePage() {
  return (
    <main>
      <div className="shell">
        <nav className="nav" aria-label="Primary navigation">
          <Link className="brand" href="/">wanderwrap <span aria-hidden="true">✦</span></Link>
          <div className="navLinks"><Link href="/connections">Connections</Link><a href="/api/auth/login">Sign in</a><a className="navButton" href="/api/auth/signup">Create account</a></div>
        </nav>
        <section className="hero">
          <div className="heroCopy">
            <p className="eyebrow">ONE THOUGHTFUL JOURNEY · EVERY CHANNEL</p>
            <h1>Remember the person. Find the gift.</h1>
            <p className="lede">WanderWrap turns a few confirmed clues into gifts with a reason behind them—on the web today and ready to continue with Alexa+.</p>
            <div className="actions"><a className="primary" href="/api/auth/signup">Start your gift space</a><Link className="secondary" href="/simulator">Try the Alexa+ demo</Link></div>
            <p className="microcopy">Free to try · You control what is remembered · No automatic purchases</p>
          </div>
          <aside className="giftPreview" aria-label="Example recommendation conversation">
            <div className="voiceOrb" aria-hidden="true"><span /><span /><span /></div>
            <p className="previewLabel">WANDERWRAP IS LISTENING</p>
            <blockquote>“A Christmas gift for my sister in Toronto. She loves ceramics and slow weekends.”</blockquote>
            <div className="previewResult"><span>01</span><div><strong>A hand-thrown tea set</strong><small>Fits her ceramics interest and unhurried rituals. Delivery must be verified.</small></div></div>
          </aside>
        </section>
      </div>
      <section className="marquee" aria-label="Available and planned channels"><div>WEB <span>✦</span> ALEXA+ <span>✦</span> TELEGRAM <span>✦</span> MESSENGER <span>✦</span> MOBILE</div></section>
      <section className="shell storySection">
        <div className="sectionHeading"><p className="eyebrow">LESS SEARCHING. MORE KNOWING.</p><h2>A calm path from “I should get something” to “this feels right.”</h2></div>
        <div className="stepGrid">{steps.map((step, index) => <article className="stepCard" key={step[0]}><span>0{index + 1}</span><h3>{step[0]}</h3><p>{step[1]}</p></article>)}</div>
      </section>
      <section className="connectionBand">
        <div className="shell connectionLayout"><div><p className="eyebrow light">YOUR CHANNELS, YOUR CHOICE</p><h2>Begin on the sofa. Continue on your phone.</h2></div><div><p>Your WanderWrap account keeps the journey together. Each extra channel is connected separately, with its own permissions and an honest fallback when a provider is not available.</p><Link className="creamButton" href="/connections">Explore connections</Link></div></div>
      </section>
      <section className="shell finalCta"><p className="eyebrow">MAKE THOUGHTFUL FEEL EFFORTLESS</p><h2>Who are you showing up for?</h2><a className="primary" href="/api/auth/signup">Create your account</a></section>
    </main>
  );
}
