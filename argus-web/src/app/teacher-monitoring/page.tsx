/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';

type Seat = { id: string; row?: number | null; col?: number | null; seat_number?: number | null; class_code?: string; status: string; student_nim?: string | null; student_name?: string | null };

export default function TeacherMonitoringPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [currentClass, setCurrentClass] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newSeatCount, setNewSeatCount] = useState<number>(36);
  const [modalSeat, setModalSeat] = useState<Seat | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedNim, setSelectedNim] = useState<string>('');
  const [deviceIdInput, setDeviceIdInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const a = localStorage.getItem('isAdmin');
    setIsAdmin(Boolean(a));
    fetchClasses();
    fetchStudents();
  }, []);

  useEffect(() => {
    // whenever class changes, reload seats
    if (currentClass) fetchSeats();
  }, [currentClass]);

  const fetchSeats = async () => {
    setLoading(true);
    const query = supabase.from('seats').select('*').order('seat_number', { ascending: true });
    const { data } = currentClass ? await query.eq('class_code', currentClass) : await query.eq('class_code', 'default');
    setSeats((data as any) || []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('nim,name').order('name');
    setStudents((data as any) || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
    const cls = (data as any) || [];
    setClasses(cls);
    if (cls.length > 0 && !currentClass) setCurrentClass(cls[0].code);
    // ensure default class exists as fallback
    if (cls.length === 0) {
      setCurrentClass('default');
    }
  };

  const createClass = async (code: string, name?: string) => {
    if (!code) {
      alert('Masukkan kode kelas');
      return;
    }
    // check uniqueness
    const { data: existing } = await supabase.from('classes').select('id').eq('code', code).maybeSingle();
    if (existing) {
      alert('Kode kelas sudah ada, pilih kode lain');
      return;
    }
    const { error } = await supabase.from('classes').insert([{ code, name: name || `Class ${code}` }]);
    if (error) {
      alert('Gagal membuat kelas: ' + error.message);
      return;
    }
    // initialize seats for this class (default seat count variable)
    const inserts: any[] = [];
    const seatCount = Number(newSeatCount) || 36;
    for (let i = 1; i <= seatCount; i++) {
      inserts.push({ row: null, col: null, class_code: code, seat_number: i, status: 'empty', device_id: null });
    }
    const { error: seatError } = await supabase.from('seats').insert(inserts);
    if (seatError) {
      alert('Gagal inisialisasi kursi: ' + seatError.message);
      return;
    }
    await fetchClasses();
    setCurrentClass(code);
  };

  const openModal = (seat: Seat) => {
    setModalSeat(seat);
    setSelectedNim(seat.student_nim || '');
    setModalError(null);
    setSearchQuery('');
    setDeviceIdInput((seat as any).device_id || '');
  };

  const updateSeat = async (action: 'assign' | 'clear' | 'absent') => {
    if (!modalSeat) return;
    let updates: any = { updated_at: new Date().toISOString() };
    if (action === 'clear') {
      updates = { ...updates, status: 'empty', student_nim: null, student_name: null };
    } else if (action === 'absent') {
      updates = { ...updates, status: 'absent' };
    } else if (action === 'assign') {
      // determine student from selectedNim or searchQuery
      let nimToAssign = selectedNim;
      if (!nimToAssign && searchQuery) {
        const byNim = students.find((s) => s.nim === searchQuery);
        if (byNim) nimToAssign = byNim.nim;
        else {
          const byName = students.find((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
          if (byName) nimToAssign = byName.nim;
        }
      }
      if (!nimToAssign) {
        setModalError('Pilih siswa terlebih dahulu (klik dari daftar atau ketik NIM/nama).');
        return;
      }

      // ensure student isn't already assigned in this class (except current seat)
      const cls = modalSeat?.class_code || currentClass || 'default';
      const { data: existing } = await supabase.from('seats').select('id,seat_number').eq('class_code', cls).eq('student_nim', nimToAssign).neq('id', modalSeat.id).limit(1).maybeSingle();
      if (existing) {
        setModalError(`Siswa sudah ditempatkan pada seat #${(existing as any).seat_number}. Hapus terlebih dahulu atau pilih siswa lain.`);
        return;
      }

      const stu = students.find((s) => s.nim === nimToAssign);
      updates = { ...updates, status: 'occupied', student_nim: nimToAssign || null, student_name: stu?.name || null, device_id: deviceIdInput || null };
    }

    await supabase.from('seats').update(updates).eq('id', modalSeat.id);

    // record history
    try {
      await supabase.from('seat_history').insert([{
        seat_id: modalSeat.id,
        class_code: modalSeat.class_code || currentClass,
        seat_number: modalSeat.seat_number || null,
        action: action === 'assign' ? 'assign' : action === 'clear' ? 'clear' : 'absent',
        student_nim: action === 'assign' ? (selectedNim || null) : null,
        student_name: action === 'assign' ? (students.find((s) => s.nim === selectedNim)?.name || null) : null,
        device_id: action === 'assign' ? (deviceIdInput || null) : null,
        performed_by: localStorage.getItem('isAdmin') ? 'admin' : 'unknown'
      }]);
    } catch (e) {
      console.error('Failed to insert seat history', e);
    }

    setModalError(null);
    setModalSeat(null);
    setDeviceIdInput('');
    fetchSeats();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Akses ditolak</h2>
          <p>Halaman ini hanya untuk admin. Silakan login sebagai admin.</p>
          <a href="/login" className="mt-4 inline-block text-blue-600">Ke halaman login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Teacher Monitoring</h1>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 border rounded" value={currentClass} onChange={(e) => setCurrentClass(e.target.value)}>
            <option value="default">default</option>
            {classes.map((cl) => (
              <option key={cl.code} value={cl.code}>{cl.name} — {cl.code}</option>
            ))}
          </select>
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => setShowAddModal(true)}>Add Kelas</button>
            <a href="/admin/create-student" className="px-3 py-2 bg-blue-600 text-white rounded">Create Student</a>
          <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => { localStorage.removeItem('isAdmin'); window.location.href = '/login'; }}>Logout</button>
        </div>
      </div>
      {loading ? (
        <div>Loading seats...</div>
      ) : (
        <div className="grid grid-cols-6 gap-3">
          {seats.map((s) => {
            const key = `${s.class_code || currentClass}-${s.seat_number}`;
            const label = s.student_name || 'Kosong';
            const bg = s.status === 'occupied' ? 'bg-blue-500 text-white' : s.status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700';
            return (
              <div key={key} className={`p-1 rounded-lg h-20 flex flex-col items-center justify-center ${bg}`}>
                <div className="text-sm font-semibold">#{s.seat_number}</div>
                <div className="text-xs">{label}</div>
                <div className="mt-2 flex gap-2">
                  <button className="px-2 py-1 bg-indigo-700 text-white rounded" onClick={() => openModal(s)}>Manage</button>
                  <a className="px-2 py-1 bg-gray-800 text-white rounded" href={`/seat/${s.id}`}>Show detail</a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalSeat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full">
            <h3 className="font-semibold mb-3">Seat #{modalSeat.seat_number}</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Cari siswa (nim atau nama)</label>
              <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedNim(''); }} className="w-full border p-2 rounded" placeholder="Ketik NIM atau nama untuk filter" />
            </div>
            <div className="mb-3 max-h-40 overflow-auto border rounded p-2">
              {students.filter((st) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (st.nim && st.nim.toLowerCase().includes(q)) || (st.name && st.name.toLowerCase().includes(q));
              }).map((st) => (
                <div key={st.nim} className={`p-2 rounded hover:bg-gray-100 cursor-pointer ${selectedNim === st.nim ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedNim(st.nim); setModalError(null); }}>
                  <div className="text-sm font-medium">{st.name}</div>
                  <div className="text-xs text-gray-500">{st.nim}</div>
                </div>
              ))}
            </div>
            {modalError && <div className="text-sm text-red-600 mt-2">{modalError}</div>}

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Device ID (opsional)</label>
              <input value={deviceIdInput} onChange={(e) => setDeviceIdInput(e.target.value)} className="w-full border p-2 rounded" placeholder="Contoh: esp32-abc123" />
            </div>

            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setModalSeat(null)}>Batal</button>
              <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={() => updateSeat('clear')}>Kosongkan</button>
              <button className="px-4 py-2 bg-yellow-500 text-white rounded" onClick={() => updateSeat('absent')}>Tandai Absen</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => updateSeat('assign')}>Simpan</button>
            </div>
          </div>
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-3xl w-full">
            <h3 className="font-semibold mb-3">Buat Kelas Baru</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Kode Kelas</label>
              <input value={newClassCode} onChange={(e) => setNewClassCode(e.target.value.toUpperCase())} className="w-full border p-2 rounded" placeholder="MASUKAN KODE (unik)" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Nama Kelas (opsional)</label>
              <input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full border p-2 rounded" placeholder="Nama kelas" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Jumlah Kursi</label>
              <input value={String(newSeatCount)} onChange={(e) => setNewSeatCount(Number(e.target.value))} type="number" min={1} max={500} className="w-full border p-2 rounded" />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setShowAddModal(false); setNewClassCode(''); setNewClassName(''); setNewSeatCount(36); }}>Batal</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => { await createClass(newClassCode, newClassName); setShowAddModal(false); setNewClassCode(''); setNewClassName(''); setNewSeatCount(36); }}>Buat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
