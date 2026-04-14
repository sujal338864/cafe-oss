'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, BarChart3, Clock, LayoutDashboard, Smartphone, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-purple-500/30">
      {/* ── Navbar ───────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050508]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-500 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-purple-500/20">
              S
            </div>
            <span className="font-bold text-lg tracking-tight">Cafe OSS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#analytics" className="hover:text-white transition-colors">Analytics</a>
            <a href="#enterprise" className="hover:text-white transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">Log In</Link>
            <Link href="/login" className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-slate-200 transition-all shadow-xl active:scale-95">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        {/* ── Hero Section ─────────────────────────────────────────────── */}
        <section className="px-6 max-w-7xl mx-auto text-center relative">
          {/* Abstract background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full -z-10" />
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-purple-400 mb-8">
              <Zap size={12} className="fill-current" /> Next-Gen POS Architecture
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight leading-[1.05]">
              Run your Cafe <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400">
                with Zero Friction.
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-10">
              The only all-in-one SaaS platform designed for high-volume coffee shops. 
              Real-time KDS, deep analytics, and extreme multi-tenancy support.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto px-8 py-4 bg-purple-600 rounded-2xl font-black text-lg hover:bg-purple-700 transition-all shadow-2xl shadow-purple-600/40 active:scale-95 flex items-center justify-center gap-3 group">
                Launch My Shop <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-lg hover:bg-white/10 transition-all active:scale-95">
                Book a Demo
              </button>
            </div>
          </motion.div>

          {/* ── Floating Mockup ────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-24 relative"
          >
            <div className="aspect-[16/9] w-full max-w-5xl mx-auto rounded-[32px] overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative group">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white/20 select-none text-9xl font-black tracking-tighter italic scale-150 rotate-[-12deg]">
                  SHOP OS
                </div>
              </div>
              <div className="absolute inset-0 p-8 flex flex-col">
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                </div>
                <div className="flex-1 rounded-2xl border border-white/5 bg-white/5 backdrop-blur shadow-2xl overflow-hidden p-6">
                   <div className="flex items-center justify-between mb-8">
                     <div className="h-4 w-32 bg-white/10 rounded-full" />
                     <div className="h-4 w-12 bg-purple-500/20 rounded-full" />
                   </div>
                   <div className="grid grid-cols-3 gap-4 mb-8">
                     <div className="h-32 bg-white/5 rounded-2xl border border-white/5" />
                     <div className="h-32 bg-white/5 rounded-2xl border border-white/5" />
                     <div className="h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-2xl border border-purple-500/10" />
                   </div>
                   <div className="space-y-3">
                     <div className="h-4 w-full bg-white/5 rounded-full" />
                     <div className="h-4 w-[80%] bg-white/5 rounded-full" />
                     <div className="h-4 w-[60%] bg-white/5 rounded-full" />
                   </div>
                </div>
              </div>
            </div>
            
            {/* Secondary floating element */}
            <div className="absolute -bottom-10 -right-4 md:-right-10 w-48 md:w-64 aspect-[9/16] bg-[#0a0a0f] border border-white/10 rounded-[28px] shadow-2xl hidden md:block overflow-hidden p-4">
                 <div className="h-2 w-12 bg-white/5 rounded-full mx-auto mb-6" />
                 <div className="h-24 w-full bg-white/5 rounded-xl mb-4" />
                 <div className="h-3 w-3/4 bg-white/5 rounded-full mb-2" />
                 <div className="h-3 w-1/2 bg-white/5 rounded-full mb-8" />
                 <div className="h-8 w-full bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <div className="h-2 w-1/2 bg-emerald-400/50 rounded-full" />
                 </div>
            </div>
          </motion.div>
        </section>

        {/* ── Features Grid ────────────────────────────────────────────── */}
        <section id="features" className="px-6 max-w-7xl mx-auto mt-40">
           <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black mb-4">Hyper-Focused on Operations.</h2>
              <p className="text-slate-400 font-medium">Built for speed, scale, and sub-1s load times.</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Isolated Multi-Tenancy', icon: ShieldCheck, desc: 'Enterprise-grade data isolation ensuring your shop data never leaks. Independent logic per outlet.' },
                { title: 'Real-time KDS', icon: Zap, desc: 'Instantly transmit orders to kitchen displays via optimized Socket.io streams. Zero lag, zero missed orders.' },
                { title: 'Mega Analytics', icon: BarChart3, desc: 'Deep-dive into revenue, COGS, and loyalty metrics with our pre-computed aggregation engine.' },
                { title: 'QR Menu System', icon: Smartphone, desc: 'Generate custom QR codes for tables. Customers order directly, reducing staff overhead by 40%.' },
                { title: 'Automatic Inventory', icon: LayoutDashboard, desc: 'Stop managing spreadsheets. Real-time stock alerts and automated purchase history logs.' },
                { title: 'High-Speed Egress', icon: Clock, desc: 'Optimized payloads and Redis-layered caching for a snappy dashboard even on slow networks.' },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-[32px] border border-white/5 bg-white/2 hover:bg-white/5 transition-all group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-purple-500/10 transition-colors">
                    <f.icon size={120} />
                  </div>
                  <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                    <f.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
           </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="mt-40 border-t border-white/5 pt-20 px-6">
           <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center font-black text-sm border border-white/10">S</div>
                <span className="font-bold text-slate-500">Cafe OSS 2026. Made with Precision.</span>
              </div>
              <div className="flex gap-8 text-sm font-semibold text-slate-500">
                <a href="#" className="hover:text-white transition-colors">Status</a>
                <a href="#" className="hover:text-white transition-colors">Docs</a>
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
              </div>
           </div>
        </footer>
      </main>
    </div>
  );
}
