import Link from 'next/link';

const channels = [
  { name: 'Web account', state: 'Ready now', tone: 'ready', text: 'Create a verified account and keep people, confirmed clues and saved ideas in one private gift space.', action: '/api/auth/signup', label: 'Create account' },
  { name: 'Alexa+', state: 'Developer setup', tone: 'progress', text: 'The protected MCP service is deployed. Amazon add-on onboarding, its exact redirect URI and Web Simulator evidence are still required.', action: '/simulator', label: 'Try browser demo' },
  { name: 'Google calendar', state: 'Optional · not connected', tone: 'planned', text: 'A future just-in-time connection for occasions you choose to share. It is not required to use WanderWrap.' },
  { name: 'Telegram', state: 'Adapter planned', tone: 'planned', text: 'A signed webhook and explicit bot permissions are required before this can be enabled.' },
  { name: 'Facebook / Messenger', state: 'Review required', tone: 'planned', text: 'Login never means access to friends or feeds. Any messaging connection will require separate Meta approval and consent.' },
  { name: 'Mobile', state: 'On the roadmap', tone: 'planned', text: 'The responsive website works on mobile now; a native app can follow once identity and journey contracts are stable.' }
];

export default function ConnectionsPage() {
  return <main className="shell dashboard">
    <nav className="nav" aria-label="Connections navigation"><Link className="brand" href="/">wanderwrap <span aria-hidden="true">✦</span></Link><div className="navLinks"><Link href="/dashboard">Gift space</Link><a href="/api/auth/login">Sign in</a></div></nav>
    <header className="pageIntro"><p className="eyebrow">CONNECTIONS</p><h1>Your gifting world, connected carefully.</h1><p className="lede">Use WanderWrap with no extra connector. Add a channel only when it earns its place—and see exactly what is live before granting access.</p></header>
    <section className="connectionGrid" aria-label="Connection availability">{channels.map(channel => <article className="connectionCard" key={channel.name}>
      <div className="connectionTop"><h2>{channel.name}</h2><span className={`statusPill ${channel.tone}`}>{channel.state}</span></div><p>{channel.text}</p>{channel.action ? <a className="textButton" href={channel.action}>{channel.label} →</a> : <span className="mutedAction">No credentials needed yet</span>}
    </article>)}</section>
    <aside className="honestyNote"><strong>Connection promise</strong><p>WanderWrap will never describe a planned connector or fixture result as a live provider action. Every connection gets its own consent, verification and revoke path.</p></aside>
  </main>;
}
