import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

export default function TermsOfService() {
  return (
    <>
      <SEO
        title="Terms of Service | QR Gear"
        description="QR Gear terms of service — the rules and guidelines for using our website and purchasing our products."
      />
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 13, 2026</p>

        <div className="prose dark:prose-invert space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using qrgear.com ("the Site") and any related services provided by QR Gear
              ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree
              to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Products and Orders</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              QR Gear sells custom merchandise featuring QR codes through a print-on-demand model.
              When you place an order:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>All products are made-to-order and custom printed. Because of this, we cannot accept
                returns or exchanges for products that are not defective.</li>
              <li>Product colors, sizing, and appearance may vary slightly from what is shown on screen
                due to differences in displays and printing processes.</li>
              <li>Prices are displayed in USD and include the cost of production. Shipping costs are
                calculated at checkout.</li>
              <li>We reserve the right to refuse or cancel any order for any reason, including suspected
                fraud or inaccurate product information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. QR Code Products</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Our products feature different types of QR codes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>QR Basic</strong> — Static QR codes that permanently encode your chosen content
                (URL, text, or contact info). Once printed, the encoded data cannot be changed.</li>
              <li><strong>QR Plus</strong> — Dynamic QR codes that link to a destination you can update
                at any time through your account.</li>
              <li><strong>QR Canvas</strong> — Dynamic QR codes that display a custom image or graphic
                you configure and can update.</li>
              <li><strong>QR Play</strong> — Dynamic QR codes that play a video you upload and can update.</li>
              <li><strong>QR Compose</strong> — Dynamic QR codes that rotate through a playlist of
                content on a schedule you set.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Dynamic QR products (Plus, Canvas, Play, Compose) require an active hosting subscription
              after the initial included period. If hosting expires, the QR code will display a renewal
              notice instead of your content. You can renew at any time to restore your content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Member Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Members who create accounts to sell QR Gear products agree to the following:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>You must not upload content that is illegal, offensive, infringing, or otherwise
                violates these terms.</li>
              <li>Member earnings are based on the pricing structure set by QR Gear and may be adjusted
                at our discretion with notice.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The QR Gear name, logo, website design, and original content are the property of QR Gear
              and are protected by intellectual property laws. You may not copy, reproduce, or distribute
              our branding or website content without written permission. You retain ownership of any
              original graphics, images, or content you upload to customize your products. By uploading
              content, you grant us a license to use it solely for the purpose of producing and
              delivering your orders.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Content Guidelines</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You agree not to use our services to create products or QR code content that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Is illegal, harmful, threatening, abusive, or harassing</li>
              <li>Infringes on intellectual property rights of others</li>
              <li>Contains malware, phishing links, or deceptive content</li>
              <li>Promotes illegal activities or violence</li>
              <li>Violates any applicable laws or regulations</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We reserve the right to remove any content and terminate accounts that violate these guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Shipping and Delivery</h2>
            <p className="text-muted-foreground leading-relaxed">
              Products are manufactured and shipped by our print-on-demand partner. Typical production
              time is 2-5 business days, with shipping times varying by destination. We are not responsible
              for delays caused by shipping carriers, customs processing, or incorrect shipping information
              provided by the customer. Tracking information will be provided when available.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Returns and Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              Because all products are custom-made to order, we generally do not accept returns. However,
              if you receive a product that is defective, damaged in shipping, or significantly different
              from what was ordered, please contact us within 14 days of delivery at info@qrgear.com with
              photos of the issue. We will arrange a replacement or refund at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Claim Codes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Certain products include a claim code that allows you to register and activate your
              purchased item. You are responsible for keeping your claim code secure. QR Gear is not
              responsible for unauthorized use of claim codes that you share or fail to protect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              QR Gear provides its services "as is" without warranties of any kind, either express or
              implied. We shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of our services. Our total liability for any claim
              arising from your use of our services shall not exceed the amount you paid for the specific
              product or service giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be posted
              on this page with an updated "Last updated" date. Your continued use of our services after
              changes are posted constitutes acceptance of the revised terms. For significant changes,
              we will make reasonable efforts to notify registered users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service shall be governed by and construed in accordance with the laws of
              the United States. Any disputes arising from these terms shall be resolved in the
              appropriate courts of jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
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
