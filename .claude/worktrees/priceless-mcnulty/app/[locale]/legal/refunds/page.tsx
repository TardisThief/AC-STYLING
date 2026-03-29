
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Refund Policy | AC Styling',
    description: 'Refund Policy for AC Styling services and website.',
};

export default function RefundsPage() {
    return (
        <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-ac-taupe prose-p:text-ac-taupe/80 prose-a:text-ac-espresso hover:prose-a:text-ac-taupe">
            <h1 className="font-serif text-4xl mb-4">REFUND POLICY</h1>
            <p className="text-sm text-gray-500 mb-8">Last updated February 01, 2026</p>

            <p>
                <strong>All sales are final and no refund will be issued.</strong>
            </p>

            <h2>Contact Us</h2>
            <p>
                If you have any questions about our Refunds Policy, please contact us at <a href="mailto:fashionstylist.ac@gmail.com">fashionstylist.ac@gmail.com</a>.
            </p>
        </article>
    );
}
