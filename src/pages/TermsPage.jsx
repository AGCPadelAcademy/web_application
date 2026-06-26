import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ArrowLeft, FileText, Shield, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
const TermsPage = () => {
  return <>
      <Helmet>
        <title>Terms & Conditions - AGC Padel Academy</title>
        <meta name="description" content="Terms and conditions, cancellation policy and privacy policy for AGC Padel Academy." />
      </Helmet>
      
      <div className="min-h-screen bg-black text-white px-6 py-12 md:py-24">
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="max-w-4xl mx-auto">
          <Link to="/">
            <Button variant="ghost" className="mb-8 pl-0 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="bg-green-500/20 p-4 rounded-2xl">
              <FileText className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-serif">Terms & Conditions</h1>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold mb-4 text-green-400 flex items-center gap-2">
              <Shield className="w-5 h-5" /> 1. UPDATED LEGAL NOTICE (IMPRESSUM)
              </h2>
              <div className="text-gray-300 space-y-4 leading-relaxed">
                <p>
                CAG Padel Academy GmbH
                </p>
                <p>
              </p>
              <p>Email: agcpadelacademy@gmail.com</p>
              <p>Durisolstrasse 3, 5612 Villmergen, Switzerland</p>
              <p>Phone: +41 76 611 40 61</p>
              <p>Legal Representative: Albert Garcia Costa</p>
              <p>Commercial Register / UID Number: CH-400.4.455.262-2</p>
              <p>Applicable Law: Swiss Law</p>
              <p>Competent Court: District Court of the company’s registered office (Villmergen / Canton of Aargau)</p>
              <p>Registered in the Swiss Commercial Register</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> 2. GENERAL TERMS AND CONDITIONS (GTC)
              </h2>
              <div className="text-gray-300 space-y-4 leading-relaxed bg-yellow-400/5 p-6 rounded-xl border border-yellow-400/20">
                <p className="font-semibold text-white">
                Scope of Application
                </p>
              <p>These terms govern the relationship between CAG Padel Academy GmbH (hereinafter “the Academy”) and all users who contract padel lessons, programs, memberships, single bookings, or any product or service offered through the website or in person.</p>
                <p className="font-semibold text-white">
                Nature of the Service
                </p>
              <ul className="list-disc pl-5 space-y-2">
                  <p>The Academy offers padel lessons in the following formats:</p>
                <li>Monthly memberships (adults)</li>
                <li>Semi-annual programs (children)</li>
                <li>Individual or group lessons paid per session</li>
                <p>All bookings are subject to availability and confirmation by the Academy.</p>
              </ul>
              <p className="font-semibold text-white">
                Payments
              </p>
              <p>Adults and single classes: online payment via Stripe (secure payment).</p>
              <p>Children: payment by invoice issued by CAG Padel Academy GmbH.</p>
              <p className="font-semibold text-white">
                Denial of Service
              </p>
              <p>The Academy reserves the right to exclude or suspend students in cases of inappropriate behavior, non-payment, or breach of these terms.</p>
              <p className="font-semibold text-white">
                Membership Cancellation Conditions (Adults – Monthly Memberships)
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Memberships do not entitle the user to any refund.</li>
                <li>Membership cancellation must be communicated 30 days before the following month, i.e., by the 1st day of the previous month.</li>
                <li>If no notice is given, the membership is automatically renewed and the full month is charged.</li>
              </ul>
              <p className="font-semibold text-white">
                Liability
              </p>
              <p>The Academy is not responsible for injuries or personal damage suffered while participating in activities, except in cases of proven gross negligence. Personal insurance coverage is recommended.</p>
              <p className="font-semibold text-white">
                Schedule Changes
              </p>
              <p>The Academy may modify schedules, instructors, and groups for organizational reasons. When possible, prior notice will be given.</p>


              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-6 text-green-400">
                3. CANCELLATION AND CREDIT POLICY (Non-refundable)
              </h2>

              <div className="text-gray-300 space-y-4 leading-relaxed mb-12">
                <p className="font-semibold text-white">General Principle</p>
                <p>No monetary refunds are granted under any circumstances.</p>
                <p>
                  No student – adult, child, or single-class participant – is entitled to a refund.
                </p>

                <p className="font-semibold text-white">
                  Conditions to Obtain Credit (Compensation)
                </p>
                <p>Credits are granted only if:</p>

                <ul className="list-disc pl-5 space-y-2">
                  <li>The user gives at least 48 hours’ notice, or</li>
                  <li>A valid medical certificate is provided.</li>
                </ul>

                <p>
                  If none of these conditions are met → no credit of any kind will be granted.
                </p>
              </div>

              <div className="space-y-12">

                {/* 3.1 */}
                <div className="text-gray-300 space-y-4 leading-relaxed bg-gray-900/40 p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-green-400">
                    3.1. Credits – Adults (Monthly Memberships and Single Classes Paid Online)
                  </h3>

                  <ul className="list-disc pl-5 space-y-2">
                    <li>Credits available only with ≥48h notice or medical certificate</li>
                    <li>Expiry: 3 weeks from the date of the missed session</li>
                    <li>Credits are unlimited and accumulative</li>
                    <li>Credits cannot be converted into money</li>
                    <li>You cannot use credit from two or more classes for the next class.</li>
                  </ul>

                  <p className="font-semibold text-white">Usage options:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Attend another class with available space</li>
                    <li>
                      Use it toward an individual lesson by paying only the difference
                      <span className="block text-sm text-gray-400">
                        (e.g. individual lesson CHF 140 → with 1 credit, pay CHF 70)
                      </span>
                    </li>
                  </ul>
                </div>

                {/* 3.2 */}
                <div className="text-gray-300 space-y-4 leading-relaxed bg-gray-900/40 p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-green-400">
                    3.2. Credits – Children (Semi-annual Programs, Payment by Invoice)
                  </h3>

                  <ul className="list-disc pl-5 space-y-2">
                    <li>Credits granted only with ≥48h notice or medical certificate</li>
                    <li>Expiry: until the end of the paid semester</li>
                    <li>Primarily used for extra sessions or rescheduling</li>
                    <li>Cannot be used for individual lessons</li>
                    <li>Cannot be converted into money</li>
                  </ul>
                </div>

                {/* 3.3 */}
                <div className="text-gray-300 space-y-4 leading-relaxed bg-gray-900/40 p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-green-400">
                    3.3. Single Classes (One-time Payment)
                  </h3>

                  <p>
                    Adult rules apply, without the possibility of converting credit into a
                    private lesson discount:
                  </p>

                  <ul className="list-disc pl-5 space-y-2">
                    <li>Credit only to attend another similar class</li>
                    <li>Cannot be used to reduce the cost of an individual session</li>
                  </ul>
                </div>

              </div>
            </section>


            <section>
              <h2 className="text-2xl font-bold mb-4 text-green-400">
                4. Privacy Policy – Swiss nLPD
              </h2>

              <div className="text-gray-300 space-y-4 leading-relaxed">
                <p className="font-semibold text-white">Data Controller</p>
                <p>
                  CAG Padel Academy GmbH<br />
                  Durisolstrasse 3, 5612 Villmergen, Switzerland<br />
                  Email: agcpadelacademy@gmail.com
                </p>

                <p className="font-semibold text-white">Types of Data Collected</p>
                <p>
                  Personal data may include name, surname, email address, phone number,
                  booking history, and payment information (processed exclusively by Stripe).
                  Medical data is processed only when voluntarily provided by the user for
                  credit eligibility purposes.
                </p>

                <p className="font-semibold text-white">Legal Basis</p>
                <p>
                  Data processing is based on the performance of a contract (Art. 31 Swiss nLPD),
                  legal obligations, and explicit consent where required.
                </p>

                <p className="font-semibold text-white">Data Storage & Processors</p>
                <p>
                  Data is stored securely using Supabase. Stripe acts as an independent payment
                  processor. Data is retained only as long as required for contractual and legal
                  obligations.
                </p>

                <p className="font-semibold text-white">User Rights</p>
                <p>
                  Users have the right to access, rectify, restrict, or request deletion of
                  their personal data by contacting agcpadelacademy@gmail.com.
                </p>

                <p className="font-semibold text-white">International Transfers</p>
                <p>
                  Stripe may process data outside Switzerland. In such cases, appropriate
                  safeguards and contractual clauses apply.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-yellow-400">
                5. Mandatory Acceptance at Checkout
              </h2>

              <div className="text-gray-300 space-y-4 leading-relaxed bg-yellow-400/5 p-6 rounded-xl border border-yellow-400/20">
                <p>
                  Before completing any payment, users must explicitly confirm that they have
                  read and accepted:
                </p>

                <ul className="list-disc pl-5 space-y-2">
                  <li>These Terms & Conditions</li>
                  <li>The Cancellation and Credit Policy</li>
                  <li>The Privacy Policy</li>
                </ul>

                <p className="font-semibold text-white">
                  No payment can be processed without this explicit consent.
                </p>
              </div>
            </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-green-400">
              6. Post-Payment Confirmation Email
            </h2>

            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                After successful payment, users receive an automatic confirmation email
                summarizing the legal conditions of their booking.
              </p>

              <p className="font-semibold text-white">Legal Reminder Included:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>No monetary refunds</li>
                <li>Credits only with ≥48h notice or medical certificate</li>
                <li>Adults: credits expire after 3 weeks</li>
                <li>Children: credits expire at the end of the paid semester</li>
              </ul>
            </div>
          </section>
          
            <div className="pt-8 mt-8 border-t border-gray-800 text-center text-sm text-gray-500">
              <p>Last updated: December 2024</p>
              <Button onClick={() => window.print()} variant="outline" className="mt-4 border-gray-700 hover:bg-gray-800">
                Print / Download as PDF
              </Button>
            </div>

          </div>
        </motion.div>
      </div>
    </>;
};
export default TermsPage;