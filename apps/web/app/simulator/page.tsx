import Link from 'next/link';
import AlexaSimulator from './simulator';

export default function SimulatorPage() {
  return <main className="shell dashboard">
    <nav className="nav" aria-label="Simulator navigation"><Link className="brand" href="/">wanderwrap <span aria-hidden="true">✦</span></Link><div className="navLinks"><Link href="/connections">Connections</Link><Link href="/dashboard">Gift space</Link></div></nav>
    <header className="pageIntro simulatorIntro"><p className="eyebrow">AUTHENTICATED ALEXA+ JOURNEY DEMO</p><h1>See the conversation and the tools behind it.</h1><p className="lede">This browser simulator calls WanderWrap’s protected MCP service as the signed-in user. It demonstrates the intended Alexa+ journey; it is not Amazon’s Web Simulator and it cannot purchase anything.</p></header>
    <AlexaSimulator />
  </main>;
}
