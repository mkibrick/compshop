"use client";

import { useState } from "react";
import Link from "next/link";
import ContactModal from "./ContactModal";

export default function Footer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <footer className="bg-navy text-gray-400 text-sm py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
          <p className="text-xs sm:text-sm leading-relaxed max-w-4xl mx-auto">
            CompShop is an independent directory. Vendor data, products, and
            details may contain inaccuracies and are subject to change.
            Information was compiled from publicly available sources.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 border-t border-white/10">
            <Link
              href="/glossary"
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              Glossary
            </Link>
            <Link
              href="/calendar"
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              Calendar
            </Link>
            <Link
              href="/blog"
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              Blog
            </Link>
            <Link
              href="/mcp"
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              For AI tools
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>
      <ContactModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
