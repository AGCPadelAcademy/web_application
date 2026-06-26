import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
const ContactPage = () => {
  const {
    toast
  } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const handleChange = e => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('submit-contact-form', {
        body: formData
      });
      if (error) throw error;
      toast({
        title: "Message Sent",
        description: "Thank you for contacting us. We have received your message successfully.",
        className: "bg-green-600 border-green-700 text-white"
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "There was a problem sending your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <>
      <Helmet>
        <title>AGC Padel Academy - Contact</title>
        <meta name="description" content="Get in touch with AGC Padel Academy. Find our address, phone, email or send us a message through our form." />
      </Helmet>
      <div className="px-6 py-12 md:py-24 bg-black">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8
        }} className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Get in Touch</h1>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Have questions? Ready to start? We're here to help.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <motion.div initial={{
            opacity: 0,
            x: -20
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            duration: 0.8,
            delay: 0.2
          }} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
              <h2 className="text-3xl font-bold mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                    <Input id="name" type="text" placeholder="Your name" required className="bg-gray-800 border-gray-700" value={formData.name} onChange={handleChange} />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <Input id="email" type="email" placeholder="you@email.com" required className="bg-gray-800 border-gray-700" value={formData.email} onChange={handleChange} />
                  </div>
                </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                    <Input id="phone" type="text" placeholder="Enter your phone number" required className="bg-gray-800 border-gray-700" value={formData.phone} onChange={handleChange} />
                  </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                  <Input id="subject" type="text" placeholder="Subject of your message" required className="bg-gray-800 border-gray-700" value={formData.subject} onChange={handleChange} />

                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                  <textarea id="message" rows="5" placeholder="Write your message here..." required className="w-full rounded-md border border-input bg-gray-800 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white" value={formData.message} onChange={handleChange}></textarea>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl">
                  {isSubmitting ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </> : 'Send Message'}
                </Button>
              </form>
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            x: 20
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            duration: 0.8,
            delay: 0.4
          }} className="space-y-8">
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">Contact Information</h3>
                <ul className="space-y-4 text-gray-300">
                  <li className="flex items-start space-x-4">
                    <MapPin className="w-6 h-6 mt-1 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Our Academy</p>
                      <p>Durisolstrasse 3, 5612 Villmergen</p>
                    </div>
                  </li>
                  <li className="flex items-center space-x-4">
                    <Phone className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="font-semibold text-white">Call Us</p>
                      <p>+41 76 611 40 61</p>
                    </div>
                  </li>
                  <li className="flex items-center space-x-4">
                    <Mail className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="font-semibold text-white">Write to Us</p>
                      <p>agcpadelacademy@gmail.com</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl h-64 overflow-hidden">
                <img className="w-full h-full object-cover" alt="Map showing the location of the padel academy" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/albert-ensenyan-pilota-agc-Mii0Q.jpg" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>;
};
export default ContactPage;