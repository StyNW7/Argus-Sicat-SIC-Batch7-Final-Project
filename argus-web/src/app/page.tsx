/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg transition-transform group-hover:scale-105">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">ARGUS</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
            <a
              href="/login"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Login
            </a>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-blue-600" /> : <Menu className="w-6 h-6 text-blue-600" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-4 py-3 text-gray-700 hover:text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <a
              href="#contact"
              className="block px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg text-center"
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
    <footer className="bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">ARGUS</span>
            </div>
            <p className="text-gray-400 font-medium leading-relaxed">
              AI-powered exam integrity for the modern education system.
            </p>
            <div className="flex space-x-4">
              {[Twitter, Linkedin, Github].map((Icon, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all duration-300 hover:scale-110"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-6 text-gray-300">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-400 hover:text-white font-medium transition-colors hover:pl-2 duration-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-500 font-medium">
              © 2024 Argus. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white font-medium">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white font-medium">Terms of Service</a>
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
    <section id="home" className="pt-32 pb-20 bg-gradient-to-br from-blue-50 via-white to-blue-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-50/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full text-white font-semibold text-sm shadow-lg">
              🚀 NEXT-GEN EXAM MONITORING
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Secure Exams
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                With AI Intelligence
              </span>
            </h1>
            
            <p className="text-lg text-gray-600 font-medium leading-relaxed max-w-2xl">
              Argus combines Computer Vision, Speech Recognition, and IoT to deliver ethical, intelligent exam proctoring. Maintain integrity without compromise.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                Start Free Trial
                <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="group px-8 py-4 bg-white text-gray-800 font-semibold text-lg rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <Play className="inline-block mr-2" />
                Watch Demo
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { icon: Camera, label: 'Computer Vision', color: 'from-blue-100 to-blue-200' },
                  { icon: Mic, label: 'Speech Recognition', color: 'from-blue-50 to-blue-100' },
                  { icon: Cpu, label: 'IoT Integration', color: 'from-blue-100 to-blue-200' },
                  { icon: Shield, label: 'Secure & Ethical', color: 'from-blue-50 to-blue-100' }
                ].map((item, idx) => (
                  <div key={idx} className={`bg-gradient-to-br ${item.color} rounded-xl p-6 text-center hover:scale-105 transition-transform duration-300`}>
                    <item.icon className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                    <p className="font-semibold text-gray-800">{item.label}</p>
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
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            About <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">Argus</span>
          </h2>
          <p className="text-lg text-gray-600 font-medium max-w-3xl mx-auto">
            We&apos;re revolutionizing exam integrity through ethical AI technology
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Brain, title: 'AI-Powered', desc: 'Advanced machine learning algorithms ensure accurate monitoring while respecting privacy' },
            { icon: Shield, title: 'Ethical Design', desc: 'Built with privacy-first principles and transparent monitoring practices' },
            { icon: Zap, title: 'Real-Time', desc: 'Instant alerts and insights during examinations for immediate action' }
          ].map((item, idx) => (
            <div key={idx} className="bg-gradient-to-b from-white to-blue-50 rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-lg inline-block mb-6">
                <item.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-600 font-medium">{item.desc}</p>
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
    <section id="how-it-works" className="py-20 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-lg text-gray-600 font-medium">Simple setup, powerful results</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 h-full">
                <div className="absolute -top-4 left-8 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  {step.num}
                </div>
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-lg inline-block mb-6 mt-4">
                  <step.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 font-medium">{step.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-200 to-blue-300"></div>
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
    { icon: Camera, title: 'Computer Vision', desc: 'Advanced CV algorithms detect suspicious movements and unauthorized materials', color: 'from-blue-50 to-blue-100' },
    { icon: Mic, title: 'Speech Recognition', desc: 'Monitors audio environment for unauthorized communication', color: 'from-blue-100 to-blue-200' },
    { icon: Cpu, title: 'IoT Integration', desc: 'Seamlessly connects with existing exam infrastructure', color: 'from-blue-50 to-blue-100' },
    { icon: Lock, title: 'Data Security', desc: 'Enterprise-grade encryption protects all examination data', color: 'from-blue-100 to-blue-200' },
    { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Comprehensive insights and reporting for administrators', color: 'from-blue-50 to-blue-100' },
    { icon: Clock, title: '24/7 Monitoring', desc: 'Round-the-clock system availability and support', color: 'from-blue-100 to-blue-200' }
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Key Features</h2>
          <p className="text-lg text-gray-600 font-medium">Everything you need for secure examinations</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="group">
              <div className={`bg-gradient-to-br ${feature.color} rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 h-full`}>
                <feature.icon className="w-12 h-12 mb-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 font-medium">{feature.desc}</p>
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
    <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Impact & Statistics</h2>
          <p className="text-lg text-gray-600 font-medium">Real results from real institutions</p>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl p-8 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
              <stat.icon className="w-10 h-10 mx-auto mb-4 text-blue-600" />
              <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
              <div className="text-sm font-medium text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
          <h3 className="text-2xl font-semibold text-gray-900 mb-8 text-center">Integrity Improvement Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280" 
                style={{ fontWeight: 'medium' }}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                stroke="#6b7280" 
                style={{ fontWeight: 'medium' }}
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontWeight: 'medium'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="integrity" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 6 }}
                activeDot={{ r: 8 }}
              />
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
    <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Why Choose Argus?</h2>
          <p className="text-lg text-gray-300 font-medium">The smart choice for modern education</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, idx) => (
            <div key={idx} className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
              <reason.icon className="w-12 h-12 mb-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white mb-3">{reason.title}</h3>
              <p className="font-medium text-gray-400">{reason.desc}</p>
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
    <section id="testimonials" className="py-20 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">What Clients Say</h2>
          <p className="text-lg text-gray-600 font-medium">Trusted by educators worldwide</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
              <div className="flex mb-6">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xl">★</span>
                ))}
              </div>
              <p className="text-gray-700 font-medium mb-8 italic leading-relaxed">&quot;{testimonial.text}&quot;</p>
              <div className="border-t border-gray-100 pt-6">
                <p className="font-semibold text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-600 font-medium">{testimonial.role}</p>
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
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-lg text-gray-600 font-medium">Everything you need to know</p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-300">
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full p-6 flex justify-between items-center text-left hover:bg-blue-50/50 transition-colors rounded-lg"
              >
                <span className="font-semibold text-gray-900 pr-8 text-lg">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-blue-600 transform transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === idx && (
                <div className="px-6 pb-8">
                  <p className="text-gray-600 font-medium pt-2 leading-relaxed">{faq.a}</p>
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
    <section id="contact" className="py-20 bg-gradient-to-br from-blue-500 to-blue-700 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Exams?</h2>
        <p className="text-lg text-blue-100 font-medium mb-12">
          Join hundreds of institutions using Argus for secure, ethical exam monitoring
        </p>
        
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-auto">
          <div className="space-y-6">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Work Email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Institution Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-lg rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              Request Demo
            </button>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-8 text-blue-100">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5" />
            <span className="font-medium">hello@argus.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5" />
            <span className="font-medium">+1 (555) 123-4567</span>
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
      {/* <CTASection /> */}
      <Footer />
    </div>
  );
};

export default ArgusLandingPage;