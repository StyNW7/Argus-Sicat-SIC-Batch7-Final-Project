import React, { useState, useEffect } from 'react';
import { Menu, X, Eye, Shield, Brain, Zap, Users, TrendingUp, CheckCircle2, ChevronDown, Mail, Phone, Linkedin, Twitter, Github, Play, ArrowRight, Camera, Mic, Cpu, BarChart3, Clock, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Navigation Component
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About', href: '#about' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Features', href: '#features' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-2 group cursor-pointer">
            <div className="bg-black p-2 border-4 border-black transform group-hover:translate-x-1 group-hover:translate-y-1 transition-transform">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-black">ARGUS</span>
          </div>

          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-4 py-2 text-sm font-bold hover:bg-black hover:text-white transition-all duration-200 border-2 border-transparent hover:border-black"
              >
                {link.name}
              </a>
            ))}
            <a
              href="#contact"
              className="ml-4 px-6 py-3 bg-black text-white font-bold border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
            >
              Get Started
            </a>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 border-4 border-black bg-white"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t-4 border-black">
          <div className="px-4 py-6 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-4 py-3 text-lg font-bold border-4 border-black hover:bg-black hover:text-white transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <a
              href="#contact"
              className="block px-4 py-3 text-lg font-bold bg-black text-white border-4 border-black text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

// Footer Component
const Footer = () => {
  const footerLinks = {
    Product: ['Features', 'How It Works', 'Pricing', 'Security'],
    Company: ['About Us', 'Careers', 'Contact', 'Blog'],
    Resources: ['Documentation', 'Help Center', 'Privacy Policy', 'Terms of Service'],
  };

  return (
    <footer className="bg-black text-white border-t-8 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-2 border-4 border-white">
                <Eye className="w-8 h-8 text-black" />
              </div>
              <span className="text-2xl font-black">ARGUS</span>
            </div>
            <p className="text-gray-300 font-medium">
              AI-powered exam integrity for the modern education system.
            </p>
            <div className="flex space-x-4">
              {[Twitter, Linkedin, Github].map((Icon, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="p-2 bg-white text-black border-2 border-white hover:bg-black hover:text-white transition-all"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-lg font-black mb-4 border-b-4 border-white inline-block pb-1">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-300 hover:text-white font-bold transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t-4 border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 font-bold">
              © 2024 Argus. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white font-bold">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white font-bold">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Hero Section
const HeroSection = () => {
  return (
    <section id="home" className="pt-32 pb-20 bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="inline-block px-4 py-2 bg-yellow-300 border-4 border-black font-black text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              🚀 NEXT-GEN EXAM MONITORING
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black leading-tight">
              Secure Exams
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">With AI</span>
                <span className="absolute bottom-2 left-0 w-full h-6 bg-yellow-300 -rotate-1"></span>
              </span>
            </h1>
            
            <p className="text-xl text-gray-700 font-medium leading-relaxed">
              Argus combines Computer Vision, Speech Recognition, and IoT to deliver ethical, intelligent exam proctoring. Maintain integrity without compromise.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="group px-8 py-4 bg-black text-white font-black text-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all duration-200">
                Start Free Trial
                <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="group px-8 py-4 bg-white text-black font-black text-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all duration-200">
                <Play className="inline-block mr-2" />
                Watch Demo
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="bg-white border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] transform hover:shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all duration-300">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { icon: Camera, label: 'Computer Vision', color: 'bg-blue-300' },
                  { icon: Mic, label: 'Speech Recognition', color: 'bg-green-300' },
                  { icon: Cpu, label: 'IoT Integration', color: 'bg-purple-300' },
                  { icon: Shield, label: 'Secure & Ethical', color: 'bg-red-300' }
                ].map((item, idx) => (
                  <div key={idx} className={`${item.color} border-4 border-black p-6 text-center hover:translate-x-1 hover:translate-y-1 transition-transform`}>
                    <item.icon className="w-12 h-12 mx-auto mb-3" />
                    <p className="font-black text-sm">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// About Section
const AboutSection = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">
            About <span className="bg-yellow-300 px-2 border-4 border-black inline-block -rotate-1">Argus</span>
          </h2>
          <p className="text-xl text-gray-600 font-medium max-w-3xl mx-auto">
            We&apos;re revolutionizing exam integrity through ethical AI technology
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Brain, title: 'AI-Powered', desc: 'Advanced machine learning algorithms ensure accurate monitoring while respecting privacy' },
            { icon: Shield, title: 'Ethical Design', desc: 'Built with privacy-first principles and transparent monitoring practices' },
            { icon: Zap, title: 'Real-Time', desc: 'Instant alerts and insights during examinations for immediate action' }
          ].map((item, idx) => (
            <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-300">
              <div className="bg-black border-4 border-black p-4 inline-block mb-4">
                <item.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black mb-3">{item.title}</h3>
              <p className="text-gray-700 font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// How It Works Section
const HowItWorksSection = () => {
  const steps = [
    { num: '01', title: 'Setup & Configuration', desc: 'Install Argus IoT devices and configure the system according to your examination requirements', icon: Cpu },
    { num: '02', title: 'AI Monitoring Begins', desc: 'Computer vision and speech recognition activate to monitor exam integrity in real-time', icon: Eye },
    { num: '03', title: 'Intelligent Detection', desc: 'AI algorithms analyze behavior patterns and flag potential integrity concerns', icon: Brain },
    { num: '04', title: 'Instant Alerts', desc: 'Proctors receive real-time notifications for immediate intervention when needed', icon: Zap }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">How It Works</h2>
          <p className="text-xl text-gray-600 font-medium">Simple setup, powerful results</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-300">
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-black text-white border-4 border-black flex items-center justify-center font-black text-xl">
                  {step.num}
                </div>
                <div className="bg-blue-300 border-4 border-black p-4 inline-block mb-4 mt-4">
                  <step.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black mb-2">{step.title}</h3>
                <p className="text-gray-700 font-medium">{step.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-1 bg-black"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Features Section
const FeaturesSection = () => {
  const features = [
    { icon: Camera, title: 'Computer Vision', desc: 'Advanced CV algorithms detect suspicious movements and unauthorized materials', color: 'bg-blue-300' },
    { icon: Mic, title: 'Speech Recognition', desc: 'Monitors audio environment for unauthorized communication', color: 'bg-green-300' },
    { icon: Cpu, title: 'IoT Integration', desc: 'Seamlessly connects with existing exam infrastructure', color: 'bg-purple-300' },
    { icon: Lock, title: 'Data Security', desc: 'Enterprise-grade encryption protects all examination data', color: 'bg-red-300' },
    { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Comprehensive insights and reporting for administrators', color: 'bg-yellow-300' },
    { icon: Clock, title: '24/7 Monitoring', desc: 'Round-the-clock system availability and support', color: 'bg-pink-300' }
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">Key Features</h2>
          <p className="text-xl text-gray-600 font-medium">Everything you need for secure examinations</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="group">
              <div className={`${feature.color} border-4 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] group-hover:-translate-y-2 transition-all duration-300`}>
                <feature.icon className="w-12 h-12 mb-4" />
                <h3 className="text-2xl font-black mb-3">{feature.title}</h3>
                <p className="text-gray-900 font-medium">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Statistics Section
const StatisticsSection = () => {
  const stats = [
    { value: '99.7%', label: 'Detection Accuracy', icon: TrendingUp },
    { value: '500K+', label: 'Exams Monitored', icon: Users },
    { value: '85%', label: 'Integrity Improvement', icon: Shield },
    { value: '24/7', label: 'System Uptime', icon: Zap }
  ];

  const chartData = [
    { month: 'Jan', integrity: 65, incidents: 45 },
    { month: 'Feb', integrity: 70, incidents: 38 },
    { month: 'Mar', integrity: 75, incidents: 32 },
    { month: 'Apr', integrity: 82, incidents: 25 },
    { month: 'May', integrity: 88, incidents: 18 },
    { month: 'Jun', integrity: 93, incidents: 12 }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">Impact & Statistics</h2>
          <p className="text-xl text-gray-600 font-medium">Real results from real institutions</p>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white border-4 border-black p-6 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-300">
              <stat.icon className="w-8 h-8 mx-auto mb-3" />
              <div className="text-4xl font-black mb-2">{stat.value}</div>
              <div className="text-sm font-bold text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
        
        <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-2xl font-black mb-6 text-center">Integrity Improvement Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeWidth={2} stroke="#000" />
              <XAxis dataKey="month" stroke="#000" strokeWidth={2} style={{ fontWeight: 'bold' }} />
              <YAxis stroke="#000" strokeWidth={2} style={{ fontWeight: 'bold' }} />
              <Tooltip contentStyle={{ border: '3px solid black', fontWeight: 'bold' }} />
              <Line type="monotone" dataKey="integrity" stroke="#000" strokeWidth={3} dot={{ fill: '#000', r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

// Why Argus Section
const WhyArgusSection = () => {
  const reasons = [
    { icon: CheckCircle2, title: 'Privacy-First Approach', desc: 'We prioritize student privacy while maintaining exam integrity' },
    { icon: CheckCircle2, title: 'Easy Integration', desc: 'Seamlessly works with existing examination systems' },
    { icon: CheckCircle2, title: 'Scalable Solution', desc: 'From small classrooms to large examination centers' },
    { icon: CheckCircle2, title: 'Expert Support', desc: 'Dedicated team available to assist you 24/7' },
    { icon: CheckCircle2, title: 'Regular Updates', desc: 'Continuous improvements and new features' },
    { icon: CheckCircle2, title: 'Proven Results', desc: 'Trusted by leading educational institutions' }
  ];

  return (
    <section className="py-20 bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">Why Choose Argus?</h2>
          <p className="text-xl text-gray-300 font-medium">The smart choice for modern education</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, idx) => (
            <div key={idx} className="bg-white text-black border-4 border-white p-6 hover:translate-x-1 hover:translate-y-1 transition-transform duration-200">
              <reason.icon className="w-12 h-12 mb-4" />
              <h3 className="text-xl font-black mb-2">{reason.title}</h3>
              <p className="font-medium text-gray-700">{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Testimonials Section
const TestimonialsSection = () => {
  const testimonials = [
    { name: 'Dr. Sarah Johnson', role: 'Dean, Tech University', text: 'Argus has transformed how we conduct examinations. The AI detection is incredibly accurate while respecting student privacy.', rating: 5 },
    { name: 'Prof. Michael Chen', role: 'Exam Coordinator', text: 'Implementation was seamless, and our integrity incidents dropped by 80% in the first semester. Highly recommend!', rating: 5 },
    { name: 'Emily Rodriguez', role: 'IT Director', text: 'The IoT integration worked flawlessly with our existing infrastructure. Support team was exceptional throughout.', rating: 5 }
  ];

  return (
    <section id="testimonials" className="py-20 bg-gradient-to-br from-pink-50 to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">What Clients Say</h2>
          <p className="text-xl text-gray-600 font-medium">Trusted by educators worldwide</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all duration-300">
              <div className="flex mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>
              <p className="text-gray-800 font-medium mb-6 italic">&quot;{testimonial.text}&quot;</p>
              <div className="border-t-4 border-black pt-4">
                <p className="font-black">{testimonial.name}</p>
                <p className="text-sm text-gray-600 font-bold">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// FAQ Section
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: 'How does Argus protect student privacy?', a: 'Argus uses advanced encryption and only captures relevant data needed for exam monitoring. All data is processed securely and deleted after the examination period.' },
    { q: 'Can Argus integrate with existing exam systems?', a: 'Yes! Argus is designed to seamlessly integrate with most existing examination management systems through our flexible API and IoT compatibility.' },
    { q: 'What kind of support do you offer?', a: 'We provide 24/7 technical support, comprehensive training for staff, and regular system updates to ensure optimal performance.' },
    { q: 'How accurate is the AI detection?', a: 'Our AI achieves 99.7% accuracy in detecting integrity violations while maintaining a very low false positive rate.' },
    { q: 'What is the setup process like?', a: 'Setup typically takes 1-2 days including hardware installation and software configuration. Our team guides you through every step.' }
  ];

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-gray-600 font-medium">Everything you need to know</p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full p-6 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-black text-lg pr-8">{faq.q}</span>
                <ChevronDown className={`w-6 h-6 transform transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === idx && (
                <div className="px-6 pb-6 border-t-4 border-black">
                  <p className="text-gray-700 font-medium pt-4">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = () => {
  return (
    <section id="contact" className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-5xl font-black text-white mb-6">Ready to Transform Your Exams?</h2>
        <p className="text-xl text-white/90 font-medium mb-8">
          Join hundreds of institutions using Argus for secure, ethical exam monitoring
        </p>
        
        <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md mx-auto">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:ring-4 focus:ring-yellow-300"
            />
            <input
              type="email"
              placeholder="Work Email"
              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:ring-4 focus:ring-yellow-300"
            />
            <input
              type="text"
              placeholder="Institution Name"
              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:ring-4 focus:ring-yellow-300"
            />
            <button className="w-full px-8 py-4 bg-black text-white font-black text-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-200">
              Request Demo
            </button>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-8 text-white">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6" />
            <span className="font-bold">hello@argus.ai</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-6 h-6" />
            <span className="font-bold">+1 (555) 123-4567</span>
          </div>
        </div>
      </div>
    </section>
  );
};

// Main App Component
const ArgusLandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <HeroSection />
      <AboutSection />
      <HowItWorksSection />
      <FeaturesSection />
      <StatisticsSection />
      <WhyArgusSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default ArgusLandingPage;