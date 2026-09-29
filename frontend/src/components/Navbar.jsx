import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Users, Check } from "lucide-react";
import { fetchCurrentUser, getActiveDevUser, setActiveDevUser, onDevUserChange } from "../lib/api";

const DEV_USERS = [
  { email: "admin@example.com", label: "Ahmad (Pentadbir)" },
  { email: "viewer@example.com", label: "Ayah (Penonton)" },
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Navbar({ activeTab, onTabChange }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(null);

  const loadUser = useCallback(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadUser();
    return onDevUserChange(loadUser);
  }, [loadUser]);

  const isAdmin = user?.role === "admin";
  const activeDevEmail = getActiveDevUser();

  function handleSwitchUser(email) {
    setActiveDevUser(email);
    setProfileOpen(false);
  }

  return (
    <header className="w-full bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div
          className="flex items-center gap-3.5 cursor-pointer select-none"
          onClick={() => onTabChange("pustaka")}
        >
          <img
            src="/logo.png"
            alt="Baitul Hikmah"
            className="w-12 h-12 object-contain"
          />
          <span className="font-heading text-2xl font-bold text-foreground tracking-tight">
            Baitul Hikmah
          </span>
        </div>

        {/* Navigation Items */}
        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => onTabChange("pustaka")}
              className={`text-sm font-medium transition-colors ${
                activeTab === "pustaka"
                  ? "text-brand-emerald font-semibold border-b-2 border-brand-emerald pb-1"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pustaka Ceramah
            </button>

            {isAdmin && (
              <button
                onClick={() => onTabChange("tambah")}
                className={`text-sm font-medium transition-colors ${
                  activeTab === "tambah"
                    ? "text-brand-emerald font-semibold border-b-2 border-brand-emerald pb-1"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tambah Ceramah
              </button>
            )}

            {isAdmin && (
              <div className="relative group">
                <button
                  onClick={() => onTabChange("urus")}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Urus Pustaka</span>
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </button>
              </div>
            )}
          </nav>

          {/* User Profile Badge */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              aria-label="Menu Pengguna"
            >
              <span className="w-9 h-9 rounded-full bg-brand-sage/60 text-brand-forest font-semibold text-xs flex items-center justify-center border border-brand-emerald/10 shrink-0">
                {getInitials(user?.display_name)}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold text-foreground">
                  {user?.display_name || "..."}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                    isAdmin ? "bg-brand-gold/15 text-brand-gold" : "bg-brand-sage text-brand-forest"
                  }`}
                >
                  {isAdmin ? "Pentadbir" : "Penonton"}
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-xs text-muted-foreground">Assalammualaikum,</p>
                  <p className="text-sm font-semibold text-foreground">
                    {user?.display_name || "Pengguna"}
                  </p>
                  {user?.email && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{user.email}</p>
                  )}
                </div>

                <div className="px-4 py-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    Tukar Pengguna (Dev Mode)
                  </p>
                  <div className="space-y-1">
                    {DEV_USERS.map((devUser) => (
                      <button
                        key={devUser.email}
                        onClick={() => handleSwitchUser(devUser.email)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg text-left transition-colors ${
                          activeDevEmail === devUser.email
                            ? "bg-brand-sage/50 text-brand-forest font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span>{devUser.label}</span>
                        {activeDevEmail === devUser.email && (
                          <Check className="w-3.5 h-3.5 text-brand-forest" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
