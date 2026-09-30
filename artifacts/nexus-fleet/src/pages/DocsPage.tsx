import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Bot, Cpu, Radio, ShieldCheck, FileText, Server, Code } from "lucide-react";

export function DocsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "loop" | "protocol" | "coordination" | "api">("overview");

  return (
    <div className="min-h-screen bg-[#111816] text-[#e3e8e5] font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-[#283834] bg-[#17221f]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => setLocation("/")} className="text-[#8aa39b] hover:text-white p-1 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#2e8b75] flex items-center justify-center font-bold text-white text-base">
            N
          </div>
          <div>
            <h1 className="font-bold text-base leading-none text-white">NEXUS-Fleet Documentation</h1>
            <span className="text-xs text-[#8aa39b] font-mono">SIH26123 System Architecture</span>
          </div>
        </div>

        <button
          onClick={() => setLocation("/console")}
          className="bg-[#2e8b75] hover:bg-[#38a38a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        >
          Launch Live 3D Console
        </button>
      </nav>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-8">
        {/* Sidebar Nav */}
        <aside className="w-64 shrink-0 space-y-1">
          {[
            { id: "overview", label: "System Overview", icon: BookOpen },
            { id: "loop", label: "Robot Autonomy Loop", icon: Bot },
            { id: "protocol", label: "P2P Radio Protocol", icon: Radio },
            { id: "coordination", label: "Negotiation & Deadlock", icon: ShieldCheck },
            { id: "api", label: "REST & WS API Reference", icon: Server },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? "bg-[#2e8b75] text-white font-semibold shadow-md"
                    : "text-[#8aa39b] hover:bg-[#192723] hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Panel */}
        <main className="flex-1 bg-[#17221f] border border-[#283834] rounded-2xl p-8 leading-relaxed">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">NEXUS-Fleet System Overview</h2>
              <p className="text-[#a4beb5]">
                NEXUS-Fleet (SIH Problem Statement <strong>SIH26123</strong>) is an Edge-AI Based Distributed Fleet Coordination Platform for Autonomous Mobile Robots (AMRs) in Smart Warehouses.
              </p>

              <div className="bg-[#111816] p-6 rounded-xl border border-[#283834] space-y-4">
                <h3 className="font-semibold text-white text-lg">Core Mandates</h3>
                <ul className="list-disc list-inside text-sm text-[#8aa39b] space-y-2">
                  <li><strong>The Robot is the Agent:</strong> Control decisions (bidding, routing, right-of-way negotiation, collision avoidance, charging) are executed by individual robot state machines.</li>
                  <li><strong>Decentralized Order Bids:</strong> Orders are auctioned to the fleet. Agents compute multi-factor costs (distance, battery, workload) and bid autonomously.</li>
                  <li><strong>Forklift Package Retrieval:</strong> AMRs navigate to randomly assigned grocery shelf locations, extend forklift gripper arms, retrieve packages, and transport them to the packing counter.</li>
                  <li><strong>Smart P2P Dodging:</strong> Robots exchange intent over P2P radio. Upon encountering peer conflicts, lower-priority robots yield and dodge smoothly without colliding.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "loop" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Robot Agent 10-Step Execution Loop</h2>
              <p className="text-[#a4beb5]">Every 100ms tick, each `RobotAgent` instance runs the following deterministic loop:</p>

              <ol className="space-y-3 font-mono text-sm">
                {[
                  "1. OBSERVE — Read inbox radio messages (HEARTBEAT, STATE_UPDATE, EDGE_BLOCKED).",
                  "2. UPDATE WORLD MODEL — Refresh cached peer positions and priority scores.",
                  "3. PREDICT — Evaluate upcoming intersection/corridor traversals against peer ETAs.",
                  "4. PLAN — Compute A* path factoring distance, congestion, risk, and active leases.",
                  "5. COMMUNICATE — Broadcast local telemetry, battery, priority, and route intent.",
                  "6. NEGOTIATE — Execute priority-based yield or proceed decision upon conflict.",
                  "7. RESERVE — Acquire time-bounded node and edge leases.",
                  "8. ACT — Advance kinematic position along target edge.",
                  "9. VERIFY — Check local 0.9m obstacle safety stopping envelope.",
                  "10. RECOVER — Reroute if deadlock wait-for cycle or physical blockage occurs."
                ].map((step, idx) => (
                  <li key={idx} className="bg-[#111816] p-3 rounded-lg border border-[#233530] text-[#7ecab6]">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {activeTab === "protocol" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Peer-to-Peer Radio Protocol</h2>
              <p className="text-[#a4beb5]">Ad-hoc radio mesh packet contracts passed between AMRs:</p>

              <div className="bg-[#111816] p-5 rounded-xl border border-[#233530]">
                <pre className="text-xs font-mono text-[#52d6b6] overflow-x-auto">
{`{
  "sender": "AMR-01",
  "target": "*",
  "timestamp": 14.2,
  "type": "STATE_UPDATE",
  "payload": {
    "node": "N-2-1",
    "nextNode": "N-2-2",
    "nextEta": 2.4,
    "taskPriority": 0.92,
    "status": "MOVING",
    "intent": "PICK",
    "battery": 87.0
  },
  "ttl": 4.0
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "coordination" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Negotiation & Deadlock Cycle Recovery</h2>
              <p className="text-[#a4beb5]">Right-of-way priority score formula:</p>
              <div className="bg-[#111816] p-4 rounded-xl font-mono text-sm text-[#42d4b0] border border-[#233530]">
                Priority = TaskPriority + min(0.2, WaitTime * 0.01) + max(0, 45 - Battery) * 0.002
              </div>
              <p className="text-sm text-[#8aa39b]">
                When circular wait dependencies occur (e.g. AMR-01 → AMR-02 → AMR-03 → AMR-01), the engine detects the wait-for graph cycle via DFS and instructs the lowest priority agent to release its lease and execute a local alternative route.
              </p>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">REST & WebSocket API Endpoints</h2>
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-[#111816] p-3 rounded-lg border border-[#233530] text-[#3db89a]">
                  GET http://localhost:8000/api/health — Health check
                </div>
                <div className="bg-[#111816] p-3 rounded-lg border border-[#233530] text-[#3db89a]">
                  GET http://localhost:8000/api/fleet — Full fleet snapshot
                </div>
                <div className="bg-[#111816] p-3 rounded-lg border border-[#233530] text-[#3db89a]">
                  POST http://localhost:8000/api/tasks — Dispatch grocery order task
                </div>
                <div className="bg-[#111816] p-3 rounded-lg border border-[#233530] text-[#3db89a]">
                  WS ws://localhost:8000/ws/fleet — 10 Hz real-time telemetry stream
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
