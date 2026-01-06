/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const [student, setStudent] = useState<any | null>(null);
  const [seat, setSeat] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userEmail = sessionData?.session?.user?.email;
    let st: any = null;
    if (userEmail) {
      const { data } = await supabase.from('students').select('*').eq('email', userEmail).maybeSingle();
      st = data as any;
    } else {
      // fallback to local session stored after bcrypt verification
      const localNim = (typeof window !== 'undefined') ? localStorage.getItem('localStudentNim') : null;
      if (!localNim) {
        router.push('/login');
        return;
      }
      const { data } = await supabase.from('students').select('*').eq('nim', localNim).maybeSingle();
      st = data as any;
    }
    const { data: stData } = { data: st };
    setStudent(st as any);

    if (st) {
      const { data: s } = await supabase.from('seats').select('*').eq('student_nim', (st as any).nim).maybeSingle();
      setSeat(s as any);
    }

    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('localStudentNim');
    }
    router.push('/login');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (!student) return <div className="p-8">Student not found. Please login.</div>;

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-xl bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Student Dashboard</h2>
          <button onClick={signOut} className="text-sm text-red-600">Sign out</button>
        </div>

        <div className="space-y-2">
          <div><strong>Nama:</strong> {student.name}</div>
          <div><strong>NIM:</strong> {student.nim}</div>
          <div><strong>Email:</strong> {student.email}</div>
          <div><strong>Status Kursi:</strong> {seat ? seat.status : 'Belum ditempatkan'}</div>
          {seat && (
            <div className="mt-3 p-3 bg-gray-100 rounded">Meja: {seat.row} x {seat.col}</div>
          )}
        </div>
      </div>
    </div>
  );
}
