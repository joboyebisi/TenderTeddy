const steps = [
  ['People', 'Invite someone or add preferences they have shared with you.'],
  ['Moments', 'Birthdays, holidays and group occasions live in one timeline.'],
  ['Ideas', 'Recommendations show why they fit, what is uncertain and what must be confirmed.'],
  ['Gifts', 'Track approval, provider handoff, fulfilment and thank-you moments.']
];

export default function DashboardPage() {
  return (
    <main className="shell dashboard">
      <header className="dashboardHeader">
        <div><p className="eyebrow">YOUR GIFT SPACE</p><h1>Good evening.</h1></div>
        <button className="primary" type="button">Ask WanderWrap</button>
      </header>
      <section className="journeyGrid" aria-label="Gifting journey">
        {steps.map(([title, copy], index) => (
          <article className="journeyCard" key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span><h2>{title}</h2><p>{copy}</p>
          </article>
        ))}
      </section>
      <aside className="systemNote">
        <strong>One journey, not six bots.</strong>
        <p>Continue a conversation started on Alexa or Telegram without giving either channel unrestricted access to your account.</p>
      </aside>
    </main>
  );
}
