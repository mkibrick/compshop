"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ContactModal from "./ContactModal";

export default function Header() {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <>
      <header className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo-compshop-inverse.svg"
                alt="CompShop"
                width={180}
                height={32}
                priority
              />
            </Link>
            <nav className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/search"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Browse Surveys
              </Link>
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="text-sm font-medium px-3 py-1.5 rounded-md border border-white/25 text-white hover:bg-white/10 transition-colors"
              >
                Contact
              </button>
            </nav>
          </div>
        </div>
      </header>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
