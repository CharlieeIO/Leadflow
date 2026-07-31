import Link from 'next/link'

export const metadata = {
  title: 'LeadFlow AI — Your Best Salesperson Never Sleeps',
  description: 'AI-powered SMS lead conversion for local service businesses. Instant responses, smart qualification, automatic bookings.',
}

export default async function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080a0f] text-white">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080a0f]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <span className="font-bold text-white text-[15px] tracking-tight">LeadFlow AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-8 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Now live with A2P 10DLC — carrier-approved SMS
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6 max-w-4xl">
            Your best salesperson
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              never sleeps.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            LeadFlow AI replies to every inbound lead in seconds via SMS, qualifies them automatically,
            and books the right appointment — so you show up to jobs, not phones.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link
              href="/login"
              className="px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-base transition-colors shadow-lg shadow-blue-600/20"
            >
              Start converting leads →
            </Link>
            <a
              href="#how-it-works"
              className="px-7 py-3.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-base transition-colors border border-white/10"
            >
              See how it works
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-16 pt-16 border-t border-white/5 grid grid-cols-3 gap-8 max-w-lg">
            {[
              { value: '< 30s', label: 'Avg first response' },
              { value: 'A–D', label: 'Lead grade, every lead' },
              { value: '24/7', label: 'No missed conversations' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-3xl font-black text-white">{value}</p>
                <p className="text-sm text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live demo mockup */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs text-slate-600">Live conversation — Braga Brothers HVAC</span>
            </div>
            <div className="p-6 md:p-10 space-y-4 max-w-lg">
              {[
                { from: 'lead', text: 'Hey my AC stopped working and its 95 degrees inside' },
                { from: 'ai', text: "That's rough — let's get someone out there fast. Is it not blowing cold air at all, or is it making a noise?" },
                { from: 'lead', text: 'Not blowing cold at all, been out since last night' },
                { from: 'ai', text: "Ok that sounds like it needs same-day attention. What's the address?" },
                { from: 'lead', text: '42 Maple St, Barnstable' },
                { from: 'ai', text: "Perfect — we're right in that area. Here's a link to grab a time today: cal.com/bragas/ac-repair" },
              ].map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.from === 'ai'
                        ? 'bg-white/10 text-slate-200 rounded-tl-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-slate-600">AI responded in</span>
                <span className="text-xs font-bold text-green-400">18 seconds</span>
                <span className="ml-auto text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Grade: A</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">What it does</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-16 max-w-xl">
            Everything that happens between "new lead" and "booked job."
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: '⚡',
                title: 'Instant response',
                body: 'Every inbound SMS gets a reply in under 30 seconds, 24 hours a day. No more losing leads to faster competitors.',
              },
              {
                icon: '🎯',
                title: 'Smart qualification',
                body: 'The AI gathers service type, urgency, and address — then grades every lead A through D so you know exactly what\'s worth your time.',
              },
              {
                icon: '📅',
                title: 'Books the right slot',
                body: 'AC repair, heating install, routine maintenance — the AI sends the exact Cal.com link for the right service. No confusion, no back and forth.',
              },
              {
                icon: '🛡️',
                title: 'Service area filter',
                body: 'If a lead is outside your coverage area, the AI declines politely and stops the conversation. No wasted time on jobs you can\'t take.',
              },
              {
                icon: '💬',
                title: 'Handles objections',
                body: '"Too expensive," "just browsing," "need to check with my spouse" — the AI knows exactly what to say to keep the conversation moving.',
              },
              {
                icon: '📨',
                title: 'Briefs you on every lead',
                body: 'The moment a lead is qualified, you get an email with their grade, AI summary, key takeaways, and a direct link to the conversation.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="p-6 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-colors">
                <span className="text-2xl mb-4 block">{icon}</span>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">How it works</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-16">Three steps. Zero missed leads.</h2>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: '01',
                title: 'Lead texts your number',
                body: 'Someone sees your truck, your ad, or your Google listing and texts. The AI picks up instantly — no hold time, no voicemail.',
              },
              {
                step: '02',
                title: 'AI qualifies and books',
                body: 'Within a few messages, the AI knows what they need, confirms the area, handles any pushback, and sends the right booking link.',
              },
              {
                step: '03',
                title: 'You show up to the job',
                body: 'A lead brief hits your inbox the moment they\'re qualified. You arrive knowing their name, issue, urgency, and grade.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="relative">
                <p className="text-6xl font-black text-white/5 mb-4">{step}</p>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-8">Works with the tools you already use</p>
          <div className="flex flex-wrap justify-center gap-6 items-center">
            {['Twilio', 'Cal.com', 'Zapier', 'GoHighLevel', 'HubSpot', 'Stripe'].map((name) => (
              <span key={name} className="text-sm font-semibold text-slate-600 hover:text-slate-400 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Simple. No surprises.</h2>
          <p className="text-slate-500 mb-16">One active location per plan. Cancel anytime.</p>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Starter',
                price: '$97',
                period: '/mo',
                desc: 'Perfect for a single location just getting started.',
                features: ['1 location', '500 SMS/mo', 'AI lead qualification', 'Cal.com booking', 'Email lead briefs'],
                cta: 'Get started',
                highlight: false,
              },
              {
                name: 'Growth',
                price: '$197',
                period: '/mo',
                desc: 'For established businesses that run on inbound leads.',
                features: ['1 location', '2,000 SMS/mo', 'Everything in Starter', 'CRM webhook', 'Booking summaries', 'Lead scoring'],
                cta: 'Get started',
                highlight: true,
              },
              {
                name: 'Pro',
                price: '$397',
                period: '/mo',
                desc: 'Multi-location teams that need full control.',
                features: ['Up to 3 locations', 'Unlimited SMS', 'Everything in Growth', 'Priority support', 'Custom AI instructions', 'Slack alerts'],
                cta: 'Get started',
                highlight: false,
              },
            ].map(({ name, price, period, desc, features, cta, highlight }) => (
              <div
                key={name}
                className={cn(
                  'rounded-2xl p-7 border',
                  highlight
                    ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/20 scale-105'
                    : 'bg-white/[0.03] border-white/8',
                )}
              >
                <p className="text-sm font-bold text-white/60 mb-1">{name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-black text-white">{price}</span>
                  <span className={`text-sm ${highlight ? 'text-blue-200' : 'text-slate-500'}`}>{period}</span>
                </div>
                <p className={`text-sm mb-6 ${highlight ? 'text-blue-100' : 'text-slate-500'}`}>{desc}</p>
                <ul className="space-y-2 mb-8">
                  {features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${highlight ? 'text-blue-50' : 'text-slate-400'}`}>
                      <svg className={`w-4 h-4 shrink-0 ${highlight ? 'text-blue-200' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={cn(
                    'block w-full text-center py-3 rounded-xl font-bold text-sm transition-colors',
                    highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
                  )}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
            Every minute without LeadFlow
            <span className="block text-slate-600">is a lead your competitor answered.</span>
          </h2>
          <p className="text-slate-500 mb-10">Set up takes under 30 minutes. Your AI is live the same day.</p>
          <Link
            href="/login"
            className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-colors shadow-xl shadow-blue-600/20"
          >
            Start for free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <span className="text-sm font-bold text-white">LeadFlow AI</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="/terms.html" className="hover:text-slate-400 transition-colors">Terms</Link>
            <Link href="/privacy.html" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/opt-in.html" className="hover:text-slate-400 transition-colors">SMS Opt-In</Link>
            <a href="mailto:charlie.cessex@gmail.com" className="hover:text-slate-400 transition-colors">Contact</a>
          </div>
          <p className="text-xs text-slate-700">© 2026 LeadFlow AI LLC</p>
        </div>
      </footer>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
