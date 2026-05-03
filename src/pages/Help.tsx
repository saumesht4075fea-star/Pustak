import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, MessageCircle, Mail, FileText, ChevronRight, ChevronDown, Calculator, CreditCard, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How do I download my purchased ebook?",
      a: "Once your payment is verified by the admin, you can find all your ebooks in the 'My Orders' section. Just click on the 'Download' button next to your book. Verification usually takes 5-30 minutes."
    },
    {
      q: "Why is my payment status still pending?",
      a: "Pending means we are verifying the UTR (transaction ID) you provided. Please ensure you've uploaded the correct screenshot or entered the right UTR. If it takes longer than 2 hours, please contact support."
    },
    {
      q: "How can I become a seller?",
      a: "Go to your 'Profile' section and look for the 'Register as Seller' button. Fill in your details and UPI information. Once approved, you can start uploading your own products."
    },
    {
      q: "What is the commission for affiliates?",
      a: "Every product has a specific commission set by the author. You can see the earning potential on each product page. Earnings from referrals are added to your balance immediately after admin verification."
    },
    {
      q: "Is there a limit on withdrawals?",
      a: "The minimum withdrawal limit is ₹500. Withdrawals are processed daily and usually settled within 24 hours to your registered UPI ID."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 sm:px-0">
      <header className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 rounded-2xl shadow-xl">
          <HelpCircle className="w-8 h-8 text-orange-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 uppercase italic">Help Center</h1>
          <p className="text-zinc-500 font-medium">Find answers, learn about Pustak, or get in touch.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl shadow-zinc-100 bg-white rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black italic uppercase">Email Support</h3>
            <p className="text-zinc-500 text-sm font-medium">Direct support for billing and technical issues.</p>
            <p className="text-orange-600 font-bold text-sm">support@pustak.com</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-zinc-100 bg-white rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black italic uppercase">WhatsApp</h3>
            <p className="text-zinc-500 text-sm font-medium">Fast answers for purchasing help.</p>
            <p className="text-green-600 font-bold text-sm">+91 99999 99999</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-zinc-100 bg-white rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black italic uppercase">Resources</h3>
            <p className="text-zinc-500 text-sm font-medium">Seller guides and legal documents.</p>
            <p className="text-zinc-900 font-bold text-sm">View Guides</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <h2 className="text-3xl font-black tracking-tight text-zinc-900 uppercase italic text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <Card key={i} className="border-none shadow-lg shadow-zinc-100 bg-white rounded-2xl overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full text-left px-8 py-6 flex items-center justify-between group"
              >
                <span className="font-black uppercase text-zinc-900 group-hover:text-orange-600 transition-colors">
                  {faq.q}
                </span>
                {openIndex === i ? <ChevronDown className="w-5 h-5 text-orange-600" /> : <ChevronRight className="w-5 h-5 text-zinc-400" />}
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-8 pb-6 text-zinc-600 font-medium leading-relaxed border-t border-zinc-50 pt-4 mx-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl font-black italic uppercase">Still Need Help?</h3>
          <p className="text-zinc-400 font-medium">Our support team is active from 9AM to 9PM IST.</p>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white font-black italic px-10 h-14 rounded-2xl shadow-xl shadow-orange-900/20">
          CONTACT US
        </Button>
      </div>
    </div>
  );
}
