/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '../../../lib/supabaseClient';

export default function SeatDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [seat, setSeat] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from('seats').select('*').eq('id', params.id).maybeSingle();
      setSeat(s);
      const { data: h } = await supabase.from('seat_history').select('*').eq('seat_id', params.id).order('created_at', { ascending: false });
      setHistory((h as any) || []);
      setLoading(false);
    })();
  }, [params?.id]);

  if (loading) return <div className="p-6">Loading...</div>;

  if (!seat) return <div className="p-6">Seat not found</div>;

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <button className="text-sm text-blue-600 mb-4" onClick={() => router.back()}>← Back</button>
        <h2 className="text-2xl font-semibold mb-2">Seat #{seat.seat_number} — {seat.class_code}</h2>
        <div className="mb-4">
          <div><strong>Status:</strong> {seat.status}</div>
          <div><strong>Student:</strong> {seat.student_name || 'Kosong'}</div>
          <div><strong>NIM:</strong> {seat.student_nim || '-'}</div>
          <div><strong>Device ID:</strong> {seat.device_id || '-'}</div>
        </div>

        <h3 className="text-xl font-semibold mb-2">History</h3>
        {history.length === 0 ? (
          <div className="text-sm text-gray-500">Tidak ada riwayat.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="p-3 border rounded">
                <div className="text-sm text-gray-600">{new Date(h.created_at).toLocaleString()}</div>
                <div><strong>Action:</strong> {h.action}</div>
                <div><strong>Student:</strong> {h.student_name || '-'}</div>
                <div><strong>NIM:</strong> {h.student_nim || '-'}</div>
                <div><strong>Device:</strong> {h.device_id || '-'}</div>
                <div className="text-xs text-gray-500">By: {h.performed_by || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
