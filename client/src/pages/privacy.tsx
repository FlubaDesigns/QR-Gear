import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy | QR Gear"
        description="QR Gear privacy policy — how we collect, use, and protect your personal information."
      />
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 13, 2026</p>

        <div className="prose dark:prose-invert space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              QR Gear ("we," "us," or "our") operates the website qrgear.com and related services.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you visit our website or make a purchase. Please read this policy carefully. By using
              our services, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2">Personal Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We may collect personally identifiable information that you voluntarily provide when you:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Create an account or sign in</li>
              <li>Place an order for products</li>
              <li>Subscribe to our communications</li>
              <li>Contact us for support</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              This may include your name, email address, shipping address, and payment information.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">Automatically Collected Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you visit our site, we may automatically collect certain information including your
              IP address, browser type, operating system, referring URLs, and browsing behavior on our site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Process and fulfill your orders</li>
              <li>Create and manage your account</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Improve our website, products, and services</li>
              <li>Prevent fraudulent transactions and protect against illegal activity</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We work with trusted third-party service providers to operate our business:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Stripe</strong> — Secure payment processing. Your payment information is handled
                directly by Stripe and is subject to their privacy policy.</li>
              <li><strong>Printify</strong> — Print-on-demand fulfillment. Shipping details are shared with
                Printify to produce and deliver your orders.</li>
              <li><strong>Firebase (Google)</strong> — Authentication and data storage.</li>
              <li><strong>Resend</strong> — Transactional email delivery.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do not sell, trade, or rent your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. QR Code Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              QR codes on our products may link to URLs, images, videos, or other digital content that you
              configure. For dynamic QR products (QR Plus, QR Canvas, QR Play, QR Compose), we store the
              destination data you provide so it can be served when the QR code is scanned. You can update
              or remove this data at any time through your account. Static QR codes (QR Basic) encode data
              directly into the code itself, and we do not track scans of static QR codes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to maintain your session, remember your preferences,
              and understand how you use our site. You can control cookie preferences through your browser
              settings. Disabling cookies may affect some features of our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. Payment
              information is processed through Stripe's PCI-compliant infrastructure and is never stored
              on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to
              provide you services. Order records are retained for accounting and legal compliance purposes.
              You may request deletion of your account and personal data by contacting us at
              info@qrgear.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
              <li>Request a copy of your data in a portable format</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, please contact us at info@qrgear.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not directed to individuals under the age of 13. We do not knowingly collect
              personal information from children under 13. If you become aware that a child has provided us
              with personal information, please contact us so we can take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new policy on this page and updating the "Last updated" date. Your continued use
              of our services after changes are posted constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong>Email:</strong> info@qrgear.com
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
