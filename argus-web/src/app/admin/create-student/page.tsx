/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useEffect, useState } from "react";
import RegisterUI from "../../auth/register/page";
import supabase from "../../../lib/supabaseClient";
import bcrypt from "bcryptjs";
import { useRouter } from "next/navigation";

export default function AdminCreateStudent() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const a = localStorage.getItem("isAdmin");
    setIsAdmin(Boolean(a));
  }, []);

  const handleCreate = async (data: {
    name: string;
    email: string;
    password: string;
    nim: string;
  }) => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      // create auth user
      const { error: signErr } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      if (signErr) {
        alert("Gagal membuat akun di auth: " + signErr.message);
        setLoading(false);
        return;
      }

      // hash password for students table
      const hash = bcrypt.hashSync(data.password, 10);
      const { error: insErr } = await supabase
        .from("students")
        .insert([
          {
            nim: data.nim,
            name: data.name,
            email: data.email,
            password_hash: hash,
          },
        ]);
      if (insErr) {
        alert("Gagal menyimpan data siswa: " + insErr.message);
        setLoading(false);
        return;
      }

      alert("Siswa berhasil dibuat.");
      router.push("/teacher-monitoring");
    } catch (e: any) {
      alert(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Akses ditolak</h2>
          <p>Halaman ini hanya untuk admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <RegisterUI onSubmit={handleCreate} />
    </div>
  );
}
