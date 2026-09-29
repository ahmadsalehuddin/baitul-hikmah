import React from "react";
import { Link } from "react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Client-side guard for admin-only pages (Tambah Ceramah, Urus Pustaka). The backend's
 * `require_admin` remains the real guard; this only avoids showing a broken page to viewers.
 */
export function AdminGate({ children }) {
  const { isAdmin, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-6" aria-label="Memuatkan" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6">
        <EmptyState
          icon={ShieldAlert}
          title="Akses Ditolak"
          description="Hanya pentadbir dibenarkan menggunakan halaman ini. Sila hubungi pentadbir jika anda memerlukan akses."
          action={
            <Button asChild variant="ghost">
              <Link to="/">Kembali ke Laman Utama</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return children;
}
