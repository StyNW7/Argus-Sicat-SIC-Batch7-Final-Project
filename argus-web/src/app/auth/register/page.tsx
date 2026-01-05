"use client";

import React, { useState } from 'react';
import { User, Mail, Check, Copy, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedNIM, setGeneratedNIM] = useState('');
  const [isNIMCopied, setIsNIMCopied] = useState(false);

  const generateRandomNIM = () => {
    // Generate 10-digit random NIM
    const nim = Array.from({ length: 10 }, () => 
      Math.floor(Math.random() * 10)
    ).join('');
    
    setGeneratedNIM(nim);
    setIsNIMCopied(false);
    return nim;
  };

  const copyToClipboard = async () => {
    if (generatedNIM) {
      await navigator.clipboard.writeText(generatedNIM);
      setIsNIMCopied(true);
      setTimeout(() => setIsNIMCopied(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    
    if (!formData.acceptTerms) {
      alert("Please accept the terms and conditions");
      return;
    }
    
    // Generate NIM if not already generated
    const nim = generatedNIM || generateRandomNIM();
    
    const registrationData = {
      name: formData.name,
      email: formData.email,
      nim: nim,
      password: formData.password
    };
    
    console.log('Registration data:', registrationData);
    
    // Here you would typically send data to your backend
    alert(`Registration successful! Your NIM is: ${nim}\nPlease save this for future logins.`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="absolute top-8 left-8 z-10">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg transition-transform group-hover:scale-105">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            ARGUS
          </span>
        </Link>
      </div>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
        {/* Left Side - Benefits */}
        <div className="w-full lg:w-1/2 max-w-md text-center lg:text-left">
          <div className="mb-8 lg:mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full text-white font-semibold text-sm shadow-lg mb-6">
              🎓 JOIN ARGUS
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Start Your Journey with
              <span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Intelligent Proctoring
              </span>
            </h1>
            
            <p className="text-lg text-gray-600 font-medium leading-relaxed">
              Create your account and get access to our AI-powered exam monitoring platform. 
              Ensure academic integrity with cutting-edge technology.
            </p>
          </div>

          <div className="space-y-6">
            {[
              { title: 'AI-Powered Monitoring', desc: 'Advanced computer vision and speech recognition' },
              { title: 'Real-Time Analytics', desc: 'Comprehensive dashboards and reporting tools' },
              { title: '24/7 Support', desc: 'Dedicated team ready to assist you anytime' }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center space-x-4">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-3">
                  <Check className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Registration Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl inline-block mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
              <p className="text-gray-600 font-medium mt-2">
                Fill in your details to get started
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    placeholder="Create a password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Must be at least 8 characters long
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Generated NIM Display */}
              {generatedNIM && (
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-800">Your NIM:</span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {isNIMCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-white border border-blue-300 rounded-lg p-3">
                    <code className="font-mono font-bold text-lg text-gray-900 tracking-wider">
                      {generatedNIM}
                    </code>
                  </div>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    ⚠️ Save this NIM! You&apos;ll need it for logging in.
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <label className="ml-2 block text-sm text-gray-700 font-medium">
                  I agree to the{' '}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-800 font-semibold">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-800 font-semibold">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                onClick={() => !generatedNIM && generateRandomNIM()}
                className="w-full group px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                Create Account
                <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500 font-medium">
                    Already have an account?
                  </span>
                </div>
              </div>

              <Link
                href="/login"
                className="block w-full px-8 py-3 bg-white text-gray-800 font-semibold text-lg rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 text-center"
              >
                Sign In Instead
              </Link>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 font-medium">
              By creating an account, you&apos;ll receive your unique NIM for secure access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;