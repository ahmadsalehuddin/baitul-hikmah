import React from "react";
import { Link, useLocation } from "react-router";
import { LibraryBig, LogOut, MapPin, Menu, User, Users, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { TextSizeControl } from "@/components/TextSizeControl";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getActiveDevUser, setActiveDevUser } from "@/lib/api";
import { getInitials } from "@/lib/format";

// Dev user switcher: local development only (spec §8.3.3). Vite strips this from production builds.
const IS_LOCAL_DEV = import.meta.env.DEV;
const DEV_USERS = [
  { email: "admin@example.com", label: "Ahmad (Pentadbir)" },
  { email: "viewer@example.com", label: "Ayah (Penonton)" },
];

// Cloudflare Access clears the session at this edge path (spec §6.1).
const LOGOUT_URL = "/cdn-cgi/access/logout";

// "Urus Pustaka" sub-menu; `tab` is read by the Urus Pustaka page (spec §8.3.8).
const URUS_ITEMS = [
  { tab: "ceramah", label: "Ceramah", icon: Video },
  { tab: "koleksi", label: "Koleksi Kitab", icon: LibraryBig },
  { tab: "penceramah", label: "Penceramah", icon: User },
  { tab: "lokasi", label: "Lokasi", icon: MapPin },
];

function BrandLink() {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-md">
      <img src="/logo.png" alt="" className="size-12 object-contain" />
      <span className="font-heading text-2xl text-foreground">Baitul Hikmah</span>
    </Link>
  );
}

// Home, speaker, collection and search views all belong to "Pustaka Ceramah".
function isLibraryPath(pathname) {
  return ["/penceramah", "/koleksi", "/cari"].some((p) => pathname.startsWith(p)) || pathname === "/";
}

function DesktopNav({ isAdmin, pathname }) {
  return (
    <NavigationMenu viewport={false} className="hidden @2xl:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild active={isLibraryPath(pathname)} className={navigationMenuTriggerStyle()}>
            <Link to="/">Pustaka Ceramah</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {isAdmin && (
          <NavigationMenuItem>
            <NavigationMenuLink asChild active={pathname.startsWith("/tambah")} className={navigationMenuTriggerStyle()}>
              <Link to="/tambah">Tambah Ceramah</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        )}

        {isAdmin && (
          <NavigationMenuItem>
            <NavigationMenuTrigger>Urus Pustaka</NavigationMenuTrigger>
            <NavigationMenuContent className="z-50 sm:absolute sm:right-0 sm:left-auto sm:w-auto">
              <ul className="grid w-48 gap-1">
                {URUS_ITEMS.map(({ tab, label, icon: Icon }) => (
                  <li key={tab}>
                    <NavigationMenuLink asChild active={pathname.startsWith("/urus")}>
                      <Link to={`/urus?tab=${tab}`}>
                        <Icon />
                        {label}
                      </Link>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function PhoneNav({ isAdmin }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="@2xl:hidden" aria-label="Buka menu navigasi">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="size-10 object-contain" />
            Baitul Hikmah
          </SheetTitle>
          <SheetDescription className="sr-only">Navigasi utama</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          <Button asChild variant="ghost" size="lg" className="justify-start">
            <SheetClose asChild>
              <Link to="/">Pustaka Ceramah</Link>
            </SheetClose>
          </Button>
          {isAdmin && (
            <>
              <Button asChild variant="ghost" size="lg" className="justify-start">
                <SheetClose asChild>
                  <Link to="/tambah">Tambah Ceramah</Link>
                </SheetClose>
              </Button>
              <Separator className="my-2" />
              <p className="px-2.5 text-sm text-muted-foreground">Urus Pustaka</p>
              {URUS_ITEMS.map(({ tab, label, icon: Icon }) => (
                <Button key={tab} asChild variant="ghost" size="lg" className="justify-start">
                  <SheetClose asChild>
                    <Link to={`/urus?tab=${tab}`}>
                      <Icon />
                      {label}
                    </Link>
                  </SheetClose>
                </Button>
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ProfileMenu({ user }) {
  const activeDevEmail = getActiveDevUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu pengguna">
          <Avatar>
            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
            <AvatarFallback>{getInitials(user?.display_name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm">
          Assalamualaikum, <strong>{user?.display_name ?? "…"}</strong>
        </div>

        <DropdownMenuSeparator />
        <TextSizeControl />

        {IS_LOCAL_DEV && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                Tukar Pengguna (Pembangun)
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeDevEmail} onValueChange={setActiveDevUser}>
                {DEV_USERS.map((devUser) => (
                  <DropdownMenuRadioItem key={devUser.email} value={devUser.email}>
                    {devUser.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={LOGOUT_URL}>
            <LogOut />
            Log Keluar
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  const { pathname } = useLocation();
  const { user, isAdmin } = useCurrentUser();

  return (
    <header className="@container w-full">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1">
          <PhoneNav isAdmin={isAdmin} />
          <BrandLink />
        </div>
        <div className="flex items-center gap-2">
          <DesktopNav isAdmin={isAdmin} pathname={pathname} />
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
