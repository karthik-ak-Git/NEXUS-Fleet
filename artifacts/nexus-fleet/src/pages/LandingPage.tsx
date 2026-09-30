import { useLocation } from "wouter";
import { Bot, Cpu, Radio, ShieldCheck, ArrowRight, Layers, Zap, CheckCircle2, GitPullRequest, Activity } from "lucide-react";

export function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#111816] text-[#e3e8e5] font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-[#283834] bg-[#17221f]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#2e8b75] flex items-center justify-center font-bold text-white text-xl shadow-lg">
            N
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-wide text-white">NEXUS-Fleet</h1>
            <span className="text-xs text-[#8aa39b] font-mono">SIH26123 · Distributed AMR Platform</span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm font-medium">
          <button onClick={() => setLocation("/")} className="text-[#3db89a] border-b-2 border-[#3db89a] pb-1">
            Overview
          </button>
          <button onClick={() => setLocation("/docs")} className="text-[#9cb5ac] hover:text-white transition-colors">
            Documentation
          </button>
          <button
            onClick={() => setLocation("/console")}
            className="bg-[#2e8b75] hover:bg-[#38a38a] text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-all shadow-md hover:shadow-emerald-900/40"
          >
            <span>Launch 3D Fleet Console</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center space-x-2 bg-[#1f302b] border border-[#2e8b75]/40 text-[#42d4b0] px-4 py-1.5 rounded-full text-xs font-mono mb-6">
          <Zap size={14} />
          <span>Smart India Hackathon 2026 Problem Statement SIH26123</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
          Edge-AI Based Distributed Fleet Coordination for <span className="text-[#3db89a]">Autonomous Mobile Robots</span>
        </h1>

        <p className="max-w-3xl mx-auto text-lg text-[#9cb5ac] mb-10 leading-relaxed">
          Transforming warehouse fulfillment through <strong>decentralized robot autonomy</strong>. Every AMR independently evaluates orders, communicates over P2P radio, negotiates right-of-way, dodges collisions, and picks grocery packages with forklift precision without relying on a central bottleneck controller.
        </p>

        <div className="flex justify-center items-center space-x-4">
          <button
            onClick={() => setLocation("/console")}
            className="bg-[#2e8b75] hover:bg-[#38a38a] text-white text-base font-semibold px-8 py-3.5 rounded-xl shadow-xl hover:shadow-emerald-900/50 flex items-center space-x-3 transition-all"
          >
            <Bot size={20} />
            <span>Open Live 3D Digital Twin</span>
          </button>
          <button
            onClick={() => setLocation("/docs")}
            className="border border-[#2d423c] hover:bg-[#1a2824] text-[#a4beb5] hover:text-white text-base font-medium px-6 py-3.5 rounded-xl transition-all"
          >
            Read System Architecture
          </button>
        </div>
      </section>

      {/* How the Coordination System Works (Matching Uploaded Image Step Workflow) */}
      <section className="bg-[#17221f] border-y border-[#283834] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">How the Coordination System Works</h2>
            <p className="text-[#8aa39b]">Decentralized 6-step workflow driving autonomous AMR fulfillment</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { step: "1", title: "Task Arrives", desc: "Order dispatched to local radio mesh", color: "border-blue-500/40 text-blue-400" },
              { step: "2", title: "Robots Decide", desc: "Agents compute ETA & battery cost bids", color: "border-emerald-500/40 text-emerald-400" },
              { step: "3", title: "Best Selected", desc: "Lowest-cost agent wins order auction", color: "border-purple-500/40 text-purple-400" },
              { step: "4", title: "Coordinate", desc: "Share intent & reserve path leases", color: "border-amber-500/40 text-amber-400" },
              { step: "5", title: "Handle Changes", desc: "P2P right-of-way yield & dodge peer", color: "border-rose-500/40 text-rose-400" },
              { step: "6", title: "Task Completed", desc: "Forklift arm picks item to counter", color: "border-teal-500/40 text-teal-400" },
            ].map((item) => (
              <div key={item.step} className={`bg-[#111816] p-5 rounded-xl border ${item.color} flex flex-col justify-between`}>
                <div>
                  <div className="w-8 h-8 rounded-full bg-[#1c2e29] font-bold text-sm flex items-center justify-center mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-white text-base mb-1">{item.title}</h3>
                  <p className="text-xs text-[#829b92]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Approach Cards (Matching Technical Diagram Image) */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Technical Approach & System Stack</h2>
          <p className="text-[#8aa39b]">Production-grade architecture designed for real-time edge fulfillment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 text-purple-400 flex items-center justify-center mb-4">
              <Bot size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">React 19 + Three.js 3D Twin</h3>
            <p className="text-sm text-[#8aa39b]">
              60 FPS WebGL 3D canvas viewport rendering High-Reach Cart AMRs, straight vertical mast rods, sliding lift carriages, and forklift picking arm extension animations.
            </p>
          </div>

          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-900/30 text-blue-400 flex items-center justify-center mb-4">
              <Cpu size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Python + FastAPI Engine</h3>
            <p className="text-sm text-[#8aa39b]">
              High-performance backend running Python 3.13, Pydantic schemas, A* graph search path planning, and asyncio simulation loop.
            </p>
          </div>

          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-900/30 text-emerald-400 flex items-center justify-center mb-4">
              <Radio size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Edge AI & P2P Radio Mesh</h3>
            <p className="text-sm text-[#8aa39b]">
              Decentralized robot-to-robot intent exchange. AMRs broadcast heartbeats, negotiate right-of-way, and reserve spatial leases over P2P radio.
            </p>
          </div>

          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-900/30 text-amber-400 flex items-center justify-center mb-4">
              <Activity size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">WebSocket Live Telemetry</h3>
            <p className="text-sm text-[#8aa39b]">
              10 Hz streaming state engine (`/ws/fleet`) pushing snapshot updates, conflict resolution logs, and battery metrics to the visual dashboard.
            </p>
          </div>

          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-rose-900/30 text-rose-400 flex items-center justify-center mb-4">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Deadlock Cycle Recovery</h3>
            <p className="text-sm text-[#8aa39b]">
              Wait-for dependency graph cycle detection. Automatically selects the lowest priority agent to yield, break circular waits, and replan routes.
            </p>
          </div>

          <div className="bg-[#17221f] p-6 rounded-2xl border border-[#283834] hover:border-[#3db89a]/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-teal-900/30 text-teal-400 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Gemini AI Explanation Layer</h3>
            <p className="text-sm text-[#8aa39b]">
              Structured natural-language telemetry explanations powered by Google Gemini 2.5 Flash SDK with server-side environment key protection.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#283834] bg-[#0c1210] py-8 text-center text-xs text-[#627a72]">
        <p>NEXUS-Fleet Autonomous AMR Coordination Engine · SIH 2026 Problem Statement SIH26123</p>
      </footer>
    </div>
  );
}
