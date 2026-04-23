import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
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
          <nav className="flex items-center gap-6">
            <Link
              href="/surveys"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Browse Surveys
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
