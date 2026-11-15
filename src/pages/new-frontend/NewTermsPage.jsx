import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { safeNewPath } from './newPaths';
import NewMasthead from './NewMasthead';

const NewTermsPage = () => {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to');
  const back = returnTo ? safeNewPath(returnTo, '') : '';

  return (
    <>
      <Helmet>
        <title>Terms & Conditions - AGC Padel Academy</title>
        <meta name="description" content="Terms and conditions, cancellation policy and privacy policy for AGC Padel Academy." />
      </Helmet>
      <NewMasthead title="Terms & Conditions" lead="Legal notice, general terms, cancellation and credit policy, and privacy policy." />
      <article className="nf-page nf-legal-copy">
        {back ? <Link to={back} className="nf-back">Back to registration</Link> : <Link to="/new" className="nf-back">Back to Home</Link>}

        <section>
          <h2>1. UPDATED LEGAL NOTICE (IMPRESSUM)</h2>
          <p>CAG Padel Academy GmbH</p>
          <p>Email: agcpadelacademy@gmail.com</p>
          <p>Durisolstrasse 3, 5612 Villmergen, Switzerland</p>
          <p>Phone: +41 76 611 40 61</p>
          <p>Legal Representative: Albert Garcia Costa</p>
          <p>Commercial Register / UID Number: CH-400.4.455.262-2</p>
          <p>Applicable Law: Swiss Law</p>
          <p>Competent Court: District Court of the company’s registered office (Villmergen / Canton of Aargau)</p>
          <p>Registered in the Swiss Commercial Register</p>
        </section>

        <section>
          <h2>2. GENERAL TERMS AND CONDITIONS (GTC)</h2>
          <h3>Scope of Application</h3>
          <p>These terms govern the relationship between CAG Padel Academy GmbH (hereinafter “the Academy”) and all users who contract padel lessons, programs, memberships, single bookings, or any product or service offered through the website or in person.</p>
          <h3>Nature of the Service</h3>
          <p>The Academy offers padel lessons in the following formats:</p>
          <ul>
            <li>Monthly memberships (adults)</li>
            <li>Semi-annual programs (children)</li>
            <li>Individual or group lessons paid per session</li>
          </ul>
          <p>All bookings are subject to availability and confirmation by the Academy.</p>
          <h3>Payments</h3>
          <p>Adults and single classes: payment by bank transfer, based on an invoice issued by CAG Padel Academy GmbH.</p>
          <p>Children: payment by invoice issued by CAG Padel Academy GmbH.</p>
          <h3>Denial of Service</h3>
          <p>The Academy reserves the right to exclude or suspend students in cases of inappropriate behavior, non-payment, or breach of these terms.</p>
          <h3>Membership Cancellation Conditions (Adults – Monthly Memberships)</h3>
          <ul>
            <li>Memberships do not entitle the user to any refund.</li>
            <li>Membership cancellation must be communicated 30 days before the following month, i.e., by the 1st day of the previous month.</li>
            <li>If no notice is given, the membership is automatically renewed and the full month is charged.</li>
          </ul>
          <h3>Liability</h3>
          <p>The Academy is not responsible for injuries or personal damage suffered while participating in activities, except in cases of proven gross negligence. Personal insurance coverage is recommended.</p>
          <h3>Schedule Changes</h3>
          <p>The Academy may modify schedules, instructors, and groups for organizational reasons. When possible, prior notice will be given.</p>
        </section>

        <section>
          <h2>3. CANCELLATION AND CREDIT POLICY (Non-refundable)</h2>
          <h3>General Principle</h3>
          <p>No monetary refunds are granted under any circumstances.</p>
          <p>No student – adult, child, or single-class participant – is entitled to a refund.</p>
          <h3>Conditions to Obtain Credit (Compensation)</h3>
          <p>Credits are granted only if:</p>
          <ul>
            <li>The user gives at least 48 hours’ notice, or</li>
            <li>A valid medical certificate is provided.</li>
          </ul>
          <p>If none of these conditions are met → no credit of any kind will be granted.</p>
          <h3>3.1. Credits – Adults (Monthly Memberships and Single Classes Paid Online)</h3>
          <ul>
            <li>Credits available only with ≥48h notice or medical certificate</li>
            <li>Expiry: 3 weeks from the date of the missed session</li>
            <li>Credits are unlimited and accumulative</li>
            <li>Credits cannot be converted into money</li>
            <li>You cannot use credit from two or more classes for the next class.</li>
          </ul>
          <p>Usage options:</p>
          <ul>
            <li>Attend another class with available space</li>
            <li>Use it toward an individual lesson by paying only the difference (e.g. individual lesson CHF 140 → with 1 credit, pay CHF 70)</li>
          </ul>
          <h3>3.2. Credits – Children (Semi-annual Programs, Payment by Invoice)</h3>
          <ul>
            <li>Credits granted only with ≥48h notice or medical certificate</li>
            <li>Expiry: until the end of the paid semester</li>
            <li>Primarily used for extra sessions or rescheduling</li>
            <li>Cannot be used for individual lessons</li>
            <li>Cannot be converted into money</li>
          </ul>
          <h3>3.3. Single Classes (One-time Payment)</h3>
          <p>Adult rules apply, without the possibility of converting credit into a private lesson discount:</p>
          <ul>
            <li>Credit only to attend another similar class</li>
            <li>Cannot be used to reduce the cost of an individual session</li>
          </ul>
        </section>

        <section>
          <h2>4. Privacy Policy – Swiss nLPD</h2>
          <h3>Data Controller</h3>
          <p>CAG Padel Academy GmbH<br />Durisolstrasse 3, 5612 Villmergen, Switzerland<br />Email: agcpadelacademy@gmail.com</p>
          <h3>Types of Data Collected</h3>
          <p>Personal data may include name, surname, email address, phone number, booking history, and payment information (payments are made by bank transfer). Medical data is processed only when voluntarily provided by the user for credit eligibility purposes.</p>
          <h3>Legal Basis</h3>
          <p>Data processing is based on the performance of a contract (Art. 31 Swiss nLPD), legal obligations, and explicit consent where required.</p>
          <h3>Data Storage & Processors</h3>
          <p>Data is stored securely using Supabase. Payments are made by bank transfer to CAG Padel Academy GmbH; no third-party payment processor is used. Data is retained only as long as required for contractual and legal obligations.</p>
          <h3>User Rights</h3>
          <p>Users have the right to access, rectify, restrict, or request deletion of their personal data by contacting agcpadelacademy@gmail.com.</p>
          <h3>International Transfers</h3>
          <p>Where service providers process data outside Switzerland, appropriate safeguards and contractual clauses apply.</p>
        </section>

        <section>
          <h2>5. Mandatory Acceptance at Checkout</h2>
          <p>Before completing any payment, users must explicitly confirm that they have read and accepted:</p>
          <ul>
            <li>These Terms & Conditions</li>
            <li>The Cancellation and Credit Policy</li>
            <li>The Privacy Policy</li>
          </ul>
          <p>No payment can be processed without this explicit consent.</p>
        </section>

        <section>
          <h2>6. Post-Payment Confirmation Email</h2>
          <p>After successful payment, users receive an automatic confirmation email summarizing the legal conditions of their booking.</p>
          <p>Legal Reminder Included:</p>
          <ul>
            <li>No monetary refunds</li>
            <li>Credits only with ≥48h notice or medical certificate</li>
            <li>Adults: credits expire after 3 weeks</li>
            <li>Children: credits expire at the end of the paid semester</li>
          </ul>
        </section>

        <p>Last updated: December 2024</p>
        <button type="button" className="nf-pill is-quiet border-0" onClick={() => window.print()}>Print / Download as PDF</button>
      </article>
    </>
  );
};

export default NewTermsPage;
