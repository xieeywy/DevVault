
"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loginWithGoogle() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={loginWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="font-bold text-lg text-blue-600">G</span>
        {loading ? "Menghubungkan..." : "Continue with Google"}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
