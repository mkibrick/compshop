"use client";

import { useState } from "react";
import Link from "next/link";
import ContactModal from "./ContactModal";

export default function Footer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <footer className="bg-navy text-gray-400 text-sm py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-xs sm:text-sm">
            CompShop is an independent directory. Vendor data, products, and
            details may contain inaccuracies and are subject to change.
            Information was compiled from publicly available sources.
          </p>
          <div className="flex items-center gap-4 flex-shrink-0">
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
