import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QrCode, Utensils, BarChart3, Smartphone } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">MenuQR</span>
          </div>
          <Link href="/login">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Restaurant Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 text-sm text-orange-400 mb-6">
          <span>🚀</span> No app required — scan &amp; order instantly
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent leading-tight">
          Digital Menus &amp;<br />QR Ordering
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Your customers scan a QR code, browse your menu, and place orders — instantly. 
          You manage everything from one dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: QrCode, title: "QR Per Table", desc: "Each table gets its own unique QR code that identifies both the restaurant and the table." },
          { icon: Utensils, title: "Full Menu Control", desc: "Add categories, items, images, spice options, and special offers. Everything in one place." },
          { icon: Smartphone, title: "Works on Any Phone", desc: "Customers scan and order without downloading any app. Works on all smartphones." },
          { icon: BarChart3, title: "Live Order Dashboard", desc: "See new orders instantly. Update status from Pending → Preparing → Ready → Done." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
              <Icon className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-8 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} MenuQR · All rights reserved
      </footer>
    </div>
  );
}
