import Link from 'next/link';

const channels = ['Alexa+', 'Web', 'Mobile', 'Telegram', 'Messenger', 'X'];

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">wanderwrap ✦</Link>
        <Link className="navAction" href="/dashboard">Open your gift space</Link>
      </nav>
      <section className="hero">
        <p className="eyebrow">ONE GIFTING MEMORY · EVERY CHANNEL</p>
        <h1>Thoughtful gifts shouldn’t begin with a search box.</h1>
        <p className="lede">WanderWrap remembers only what people permit, explains every suggestion, and carries one gifting journey from conversation to fulfilment.</p>
        <div className="actions">
          <Link className="primary" href="/dashboard">Find a gift</Link>
          <a className="secondary" href="#channels">See how it connects</a>
        </div>
      </section>
      <section className="channelSection" id="channels">
        <p className="eyebrow">MEET PEOPLE WHERE THEY ARE</p>
        <div className="channelGrid">
          {channels.map((channel, index) => (
            <article className="channelCard" key={channel}>
              <span>0{index + 1}</span>
              <h2>{channel}</h2>
              <p>One identity, consent record and journey state—rendered for this surface.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
