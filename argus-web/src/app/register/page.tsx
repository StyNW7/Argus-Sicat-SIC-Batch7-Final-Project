/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [nim, setNim] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signError } = await supabase.auth.signUp({ email, password });
    if (signError) {
      setError(signError.message);
      setLoading(false);
      return;
    }

    // insert into students table; mark password source as 'supabase' so password_hash isn't NULL
    const { error: insertErr } = await supabase.from('students').insert([{ nim, name, email, password_hash: 'supabase' }]);
    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Register</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input value={nim} onChange={(e) => setNim(e.target.value)} placeholder="NIM" className="w-full px-4 py-3 border rounded-lg" required />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-4 py-3 border rounded-lg" required />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full px-4 py-3 border rounded-lg" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full px-4 py-3 border rounded-lg" required />
          {error && <div className="text-red-500">{error}</div>}
          <button className="w-full py-3 bg-blue-600 text-white rounded-lg" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
