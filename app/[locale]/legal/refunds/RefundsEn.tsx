/**
 * English refund policy. See ./RefundsEs.tsx for the Spanish text and
 * ./page.tsx for how the locale picks between them.
 */
export default function RefundsEn() {
    return (
        <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-ac-taupe prose-p:text-ac-taupe/80 prose-a:text-ac-espresso hover:prose-a:text-ac-taupe">
            <h1 className="font-serif text-4xl mb-4">REFUND POLICY</h1>
            <p className="text-sm text-gray-500 mb-8">Last updated September 23, 2026</p>

            <p>
                <strong>All sales are final and no refund will be issued.</strong>
            </p>

            <h2>Contact Us</h2>
            <p>
                If you have any questions about our Refunds Policy, please contact us at <a href="mailto:hello@theacstyle.com">hello@theacstyle.com</a>.
            </p>
        </article>
    );
}
