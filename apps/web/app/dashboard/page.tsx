import Link from 'next/link';
import GiftWorkspace from './gift-workspace';

export default function DashboardPage() {
  return (
    <main className="shell dashboard">
      <nav className="nav" aria-label="Dashboard navigation">
        <Link className="brand" href="/">wanderwrap <span aria-hidden="true">✦</span></Link>
        <div className="navLinks"><Link href="/connections">Connections</Link><Link href="/simulator">Alexa+ demo</Link><form action="/api/auth/logout" method="post"><button className="quietButton" type="submit">Sign out</button></form></div>
      </nav>
      <header className="dashboardIntro">
        <div>
          <p className="eyebrow">YOUR GIFT SPACE</p>
          <h1>Thoughtfulness, without the scramble.</h1>
          <p className="lede">Add one person, confirm what they enjoy, and turn it into a shortlist you can understand.</p>
        </div>
        <div className="trustPill"><span aria-hidden="true">●</span> Nothing is purchased without your approval</div>
      </header>
      <GiftWorkspace />
    </main>
  );
}
