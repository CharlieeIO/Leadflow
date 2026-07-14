import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms and Conditions for LeadFlow AI and SMS messaging services.',
}

export default function TermsPage() {
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
            <Link href="/privacy" className="hover:text-slate-800 transition-colors">Privacy Policy</Link>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 mb-10">Effective date: {effective}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using the services provided by {company} ("LeadFlow AI," "we," "us," or
              "our") at {website}, you agree to be bound by these Terms and Conditions. If you do not
              agree, please do not use our services. These Terms apply to all visitors, users, and
              others who access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. Description of Service</h2>
            <p>
              LeadFlow AI provides an AI-powered lead conversion platform for local service businesses.
              Our platform enables businesses to engage with prospective customers via automated SMS
              messaging, appointment scheduling, lead qualification, and related communications tools.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. SMS Messaging — Consent, Opt-Out, and Frequency</h2>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">3a. Consumer Consent</h3>
            <p>
              By providing your phone number to a business that uses LeadFlow AI, or by initiating a
              text message conversation with a LeadFlow AI-powered number, you expressly consent to
              receive automated SMS text messages from that business. These messages may include
              appointment reminders, follow-up communications, booking confirmations, and related
              service information.
            </p>
            <p className="mt-2">
              <strong>Consent is not a condition of purchase.</strong> You are not required to consent
              to receive SMS messages in order to purchase any goods or services.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">3b. Message Frequency</h3>
            <p>
              Message frequency varies by business and the nature of your inquiry. You may receive
              multiple messages in connection with a single appointment or service request. Standard
              message and data rates from your wireless carrier may apply.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">3c. How to Opt Out</h3>
            <p>
              You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to
              any message you receive. After opting out, you will receive a single confirmation message
              and no further messages will be sent. To re-subscribe, reply <strong>START</strong>.
            </p>
            <p className="mt-2">
              For help, reply <strong>HELP</strong> to any message or contact us at{' '}
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
            </p>

            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">3d. No Third-Party Marketing</h3>
            <p>
              We do not sell, rent, or share your phone number with third parties for their own
              marketing purposes. SMS messages are sent solely on behalf of the specific business
              whose services you have inquired about.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. User Accounts (Business Subscribers)</h2>
            <p>
              Businesses that subscribe to LeadFlow AI must create an account. You are responsible for
              maintaining the confidentiality of your login credentials and for all activities that
              occur under your account. You agree to notify us immediately at {email} if you become
              aware of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Send spam, unsolicited commercial messages, or messages to individuals who have opted out</li>
              <li>Violate the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, or applicable carrier guidelines</li>
              <li>Impersonate any person or entity</li>
              <li>Transmit any content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Subscriptions and Billing</h2>
            <p>
              LeadFlow AI offers subscription plans billed on a monthly basis. By subscribing, you
              authorize us to charge your payment method on a recurring basis. Subscriptions
              automatically renew unless cancelled before the next billing cycle. Refunds are
              issued at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are and will remain
              the exclusive property of {company}. Our trademarks and trade dress may not be used in
              connection with any product or service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">8. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR
              OTHER HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">9. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, {company.toUpperCase()} SHALL NOT
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH
              YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH
              DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE
              MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">10. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              Commonwealth of Massachusetts, without regard to its conflict of law provisions.
              Any disputes shall be resolved exclusively in the state or federal courts located in
              Massachusetts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material
              changes by updating the effective date above. Continued use of the Service after changes
              constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">12. Contact Us</h2>
            <p>If you have questions about these Terms, contact us:</p>
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
