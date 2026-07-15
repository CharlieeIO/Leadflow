import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for LeadFlow AI — how we collect, use, and protect your information.',
}

export default function PrivacyPage() {
  const effective = 'June 19, 2026'
  const company   = 'LeadFlow AI LLC'
  const email     = 'charlie.cessex@gmail.com'
  const website   = 'https://www.theleadflowautomation.com'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-slate-900">LeadFlow AI</Link>
          <nav className="flex gap-5 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-slate-800 transition-colors">Terms and Conditions</Link>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-6">Effective date: {effective}</p>

        {/* TCR-required SMS data sharing notice — must be prominent and standalone */}
        <div className="bg-slate-900 text-white rounded-xl p-5 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">SMS &amp; Text Messaging — Data Sharing Notice</p>
          <p className="text-sm leading-relaxed">
            <strong>No mobile information will be shared with third parties or affiliates for marketing or
            promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared
            with any third parties under any circumstances. Standard message and data rates may apply.
            Reply <strong>STOP</strong> to cancel at any time.
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. Introduction</h2>
            <p>
              {company} ("LeadFlow AI," "we," "us," or "our") is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our website at {website} or receive SMS text message
              communications sent through our platform on behalf of our business clients.
            </p>
            <p className="mt-2">
              Please read this policy carefully. If you do not agree with its terms, please
              discontinue use of our services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">2a. Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Phone number</strong> — when you text a business using our platform or submit a web form</li>
              <li><strong>Name and email address</strong> — when provided voluntarily in conversation or a form</li>
              <li><strong>Message content</strong> — the text of SMS messages you send to businesses using our platform</li>
              <li><strong>Appointment and service details</strong> — information you share about what services you need</li>
              <li><strong>Account information</strong> — for business subscribers: name, email, billing details</li>
            </ul>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">2b. Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Message delivery status and timestamps from our SMS provider</li>
              <li>Device information when visiting our website</li>
            </ul>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">2c. AI-Processed Information</h3>
            <p>
              Messages sent through our platform may be processed by artificial intelligence to
              generate responses, extract qualification information (such as service type, urgency,
              and location), and assist with appointment scheduling. This processing is performed
              on behalf of the business you are communicating with.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Deliver SMS text messages between you and the businesses using our platform</li>
              <li>Generate AI-powered responses on behalf of those businesses</li>
              <li>Schedule and confirm appointments</li>
              <li>Provide business subscribers with lead management and analytics tools</li>
              <li>Send appointment reminders and follow-up messages you have consented to receive</li>
              <li>Improve, operate, and maintain our services</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. SMS Text Messaging — Your Rights and Our Commitments</h2>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">4a. No Sharing of SMS Opt-In Data</h3>
            <p>
              <strong>
                No mobile information, including SMS opt-in consent, phone numbers, and text message
                content, will be shared with third parties or affiliates for marketing or promotional
                purposes. All categories of personal data described in this policy exclude text
                messaging originator opt-in data and consent — this information will not be shared
                with any third parties under any circumstances.
              </strong>
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">4b. How to Opt Out (STOP)</h3>
            <p>
              You may stop receiving SMS text messages at any time by replying <strong>STOP</strong> to
              any message you receive from us. After opting out, you will receive a single confirmation
              message and no further messages will be sent to your number. To resume messages, reply{' '}
              <strong>START</strong>. For help, reply <strong>HELP</strong> or contact us at{' '}
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
            </p>
            <p className="mt-2">
              Opting out of SMS messages does not delete any previously collected information.
              To request deletion of your personal data, contact us at{' '}
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">4c. Message Frequency</h3>
            <p>
              Message frequency varies based on your inquiry and the business you have contacted.
              You may receive multiple messages related to a single service request or appointment.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">4d. Message and Data Rates</h3>
            <p>
              Standard message and data rates from your wireless carrier may apply to any SMS text
              messages you send or receive through our platform.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">4e. Consent</h3>
            <p>
              By texting a business number powered by LeadFlow AI, or by submitting your phone
              number through a web form connected to our platform, you consent to receive automated
              SMS text messages from that business. <strong>Consent is not a condition of any
              purchase.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Disclosure of Your Information</h2>
            <p>We may share information in the following limited circumstances:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Business clients:</strong> Information you share via SMS is visible to the
                business whose number you contacted. We act as a data processor on their behalf.
              </li>
              <li>
                <strong>Service providers:</strong> We share data with vetted third-party providers
                who help us operate the platform (e.g., SMS carrier, cloud hosting, payment
                processor). These providers are contractually bound to protect your data and may
                not use it for their own purposes.
              </li>
              <li>
                <strong>Legal compliance:</strong> We may disclose information when required by
                law, court order, or government authority, or to protect the rights and safety of
                LeadFlow AI, our clients, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale
                of assets, your information may be transferred as part of that transaction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Data Retention</h2>
            <p>
              We retain conversation data and lead information for as long as the business client
              maintains an active account with us, and for a reasonable period thereafter for
              compliance and dispute resolution purposes. Business subscribers may delete lead
              records from within their dashboard at any time.
            </p>
            <p className="mt-2">
              To request deletion of your personal data, email us at{' '}
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
              We will process your request within 30 days, subject to any legal obligations to retain data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Data Security</h2>
            <p>
              We implement industry-standard technical and organizational measures to protect your
              information against unauthorized access, alteration, disclosure, or destruction.
              These include encrypted data storage, secure HTTPS transmission, and access controls
              limited to authorized personnel. However, no method of transmission over the internet
              or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">8. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 13. We do not knowingly
              collect personal information from children under 13. If we become aware that we have
              collected such information, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">9. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">10. Third-Party Services</h2>
            <p>
              Our platform integrates with third-party services including SMS carriers, AI providers,
              payment processors, and scheduling tools. Each third party has its own privacy policy
              governing its use of data. We encourage you to review those policies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by updating the effective date at the top of this page. Your continued use of
              the Service after changes are posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please
              contact us:
            </p>
            <address className="not-italic mt-2 space-y-0.5">
              <p><strong>{company}</strong></p>
              <p>
                Email:{' '}
                <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>
              </p>
              <p>Website: <a href={website} className="text-blue-600 hover:underline">{website}</a></p>
            </address>
          </section>

        </div>
      </main>

      <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400">
        <div className="flex gap-5 justify-center">
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms and Conditions</Link>
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} {company}. All rights reserved.</p>
      </footer>
    </div>
  )
}
