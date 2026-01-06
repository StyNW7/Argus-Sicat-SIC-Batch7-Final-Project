"use client";

import React, { useState } from "react";
import AuthLogin from "../auth/login/page";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import bcrypt from "bcryptjs";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (data: {
    emailOrNim: string;
    password: string;
    rememberMe: boolean;
  }) => {
    setLoading(true);
    setError(null);
    const { emailOrNim, password } = data;

    // admin check
    if (
      emailOrNim === process.env.NEXT_PUBLIC_ADMIN_NIM &&
      password === process.env.NEXT_PUBLIC_ADMIN_PASS
    ) {
      localStorage.setItem("isAdmin", "1");
      setLoading(false);
      router.push("/teacher-monitoring");
      return;
    }

    let email: string | null = null;

    if (emailOrNim.includes("@")) {
      email = emailOrNim;
    } else {
      const nim = emailOrNim;
      const { data: student } = await supabase
        .from("students")
        .select("email")
        .eq("nim", nim)
        .maybeSingle();
      email = (student as any)?.email || null;
    }

    if (!email) {
      setError("NIM / email tidak ditemukan");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError) {
      setLoading(false);
      router.push("/student-dashboard");
      return;
    }

    // fallback: compare bcrypt hash stored in students
    const { data: st } = await supabase
      .from("students")
      .select("nim,password_hash")
      .eq("email", email)
      .maybeSingle();
    const passHash = (st as any)?.password_hash;
    const nimFromDb = (st as any)?.nim;
    if (passHash && bcrypt.compareSync(password, passHash)) {
      if (nimFromDb) localStorage.setItem("localStudentNim", nimFromDb);
      setLoading(false);
      router.push("/student-dashboard");
      return;
    }

    setError(signInError.message);
    setLoading(false);
  };

  return (
    <AuthLogin onSubmit={handleLogin} loading={loading} externalError={error} />
  );
}
