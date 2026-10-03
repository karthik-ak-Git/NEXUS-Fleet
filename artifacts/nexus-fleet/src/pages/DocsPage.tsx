import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Bot, Cpu, Radio, ShieldCheck, FileText, Server, Code, Award, ExternalLink, Activity, Terminal, Boxes } from "lucide-react";

export function DocsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "problem" | "hardware" | "research" | "loop" | "protocol" | "coordination" | "api">("overview");

  return (
    <div className="min-h-screen bg-[#111816] text-[#e3e8e5] font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-[#283834] bg-[#17221f]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => setLocation("/")} className="text-[#8aa39b] hover:text-white p-1 transition-colors cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#2e8b75] flex items-center justify-center font-bold text-white text-base">
            N
          </div>
          <div>
            <h1 className="font-bold text-base leading-none text-white">NEXUS-Fleet Documentation & System Architecture</h1>
            <span className="text-xs text-[#3db89a] font-mono">SIH26123 · SPARK-08 · Bharat Electronics Limited</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="https://github.com/karthik-ak-Git/NEXUS-Fleet"
            target="_blank"
            rel="noreferrer"
            className="border border-[#283834] hover:bg-[#1f2c28] text-[#8aa39b] hover:text-white px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all"
          >
            <span>GitHub Repository</span>
            <ExternalLink size={14} />
          </a>
          <button
            onClick={() => setLocation("/console")}
            className="bg-[#2e8b75] hover:bg-[#38a38a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer"
          >
            Launch Live 3D Digital Twin
          </button>
        </div>
      </nav>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar Nav */}
        <aside className="w-64 shrink-0 space-y-1">
          {[
            { id: "overview", label: "SIH 2026 Overview", icon: BookOpen },
            { id: "problem", label: "Problem Statement", icon: Award },
            { id: "hardware", label: "Edge-AI Hardware & ROS2", icon: Cpu },
            { id: "research", label: "Research & Citations", icon: FileText },
            { id: "loop", label: "Robot Agent Loop", icon: Bot },
            { id: "protocol", label: "P2P Wireless Protocol", icon: Radio },
            { id: "coordination", label: "Conflict & Deadlock", icon: ShieldCheck },
            { id: "api", label: "REST & WS API Engine", icon: Server },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${
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
        <main className="flex-1 bg-[#17221f] border border-[#283834] rounded-2xl p-8 leading-relaxed shadow-xl">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#283834] pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">NEXUS-Fleet System Overview</h2>
                  <p className="text-xs font-mono text-[#3db89a] mt-1">Smart India Hackathon 2026 · Problem Statement SIH26123</p>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-full font-mono font-bold">
                  Team SPARK-08
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <div className="text-xs text-[#8aa39b]">Problem Statement ID</div>
                  <div className="text-lg font-bold text-white font-mono">SIH26123</div>
                </div>
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <div className="text-xs text-[#8aa39b]">Organization / Nodal Agency</div>
                  <div className="text-lg font-bold text-white">Bharat Electronics Limited</div>
                </div>
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <div className="text-xs text-[#8aa39b]">Theme & Category</div>
                  <div className="text-lg font-bold text-white">Smart Automation (Software)</div>
                </div>
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <div className="text-xs text-[#8aa39b]">Team Details</div>
                  <div className="text-lg font-bold text-white">SPARK-08 (Team ID: 143472)</div>
                </div>
              </div>

              <p className="text-[#a4beb5] leading-relaxed">
                NEXUS-Fleet transforms Autonomous Mobile Robots (AMRs) into decentralized Edge-AI agents capable of real-time peer-to-peer task bidding, corridor reservation, dynamic conflict negotiation, and silent low-battery charger docking without relying on a centralized cloud orchestrator.
              </p>

              {/* End-to-End Grocery Fulfillment Lifecycle Workflow */}
              <div className="bg-[#111816] p-6 rounded-xl border border-[#283834] space-y-4">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                  <Boxes className="text-[#3db89a]" size={20} />
                  <span>End-to-End Grocery Order Fulfillment Workflow</span>
                </h3>
                <p className="text-[#a4beb5] text-sm leading-relaxed">
                  How NEXUS-Fleet executes deterministic order-to-delivery cycles with optimal AMR allocation:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                  <div className="bg-[#17221f] p-3 rounded-lg border border-[#283834] text-xs">
                    <span className="text-[10px] font-mono text-[#3db89a] font-bold">STAGE 1</span>
                    <h4 className="font-bold text-white mt-1">Order Placement</h4>
                    <p className="text-[#8aa39b] mt-1 text-[11px]">Food item selected from 6 catalog SKUs (Apples, Milk, Bread, Oil, Coffee, Chocolate). Only active orders trigger AMR auctions.</p>
                  </div>
                  <div className="bg-[#17221f] p-3 rounded-lg border border-[#283834] text-xs">
                    <span className="text-[10px] font-mono text-[#3db89a] font-bold">STAGE 2</span>
                    <h4 className="font-bold text-white mt-1">Best AMR Auction</h4>
                    <p className="text-[#8aa39b] mt-1 text-[11px]">Idle AMRs compute bids based on dock distance &amp; battery. Lowest-cost robot wins; unassigned AMRs stay docked at home chargers.</p>
                  </div>
                  <div className="bg-[#17221f] p-3 rounded-lg border border-[#283834] text-xs">
                    <span className="text-[10px] font-mono text-[#3db89a] font-bold">STAGE 3</span>
                    <h4 className="font-bold text-white mt-1">Shelf Item Pick</h4>
                    <p className="text-[#8aa39b] mt-1 text-[11px]">Winning AMR navigates to rack node (e.g. N-1-1), loads food crate, and sets destination to Pack Counter (N-2-8).</p>
                  </div>
                  <div className="bg-[#17221f] p-3 rounded-lg border border-[#283834] text-xs">
                    <span className="text-[10px] font-mono text-[#3db89a] font-bold">STAGE 4</span>
                    <h4 className="font-bold text-white mt-1">Counter Acceptance</h4>
                    <p className="text-[#8aa39b] mt-1 text-[11px]">Pack Counter (PACK-02) executes instant handshake, marks task COMPLETED, and releases node reservation for queued AMRs.</p>
                  </div>
                  <div className="bg-[#17221f] p-3 rounded-lg border border-[#283834] text-xs">
                    <span className="text-[10px] font-mono text-[#3db89a] font-bold">STAGE 5</span>
                    <h4 className="font-bold text-white mt-1">Perimeter Dock Return</h4>
                    <p className="text-[#8aa39b] mt-1 text-[11px]">AMR routes via perimeter loop (avoiding incoming queue on row 2), docks at assigned charger, and enters CHARGING state.</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111816] p-6 rounded-xl border border-[#283834] space-y-4">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                  <Activity className="text-[#3db89a]" size={20} />
                  <span>Key Architectural Innovations</span>
                </h3>
                <ul className="list-disc list-inside text-sm text-[#8aa39b] space-y-2">
                  <li><strong>Robot-as-an-Agent:</strong> Decoupled onboard state machine running local A* pathfinding and priority bidding.</li>
                  <li><strong>Spatio-Temporal Reservations:</strong> Time-bounded corridor leases prevent intersection lockups.</li>
                  <li><strong>Explainable Autonomy:</strong> Every yield, reroute, and task assignment generates structured event ledger telemetry.</li>
                  <li><strong>Automatic Low-Battery Return:</strong> AMRs automatically suspend tasks and navigate to dedicated charging slots (C-01 .. C-05).</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "problem" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">SIH26123 Official Problem Statement</h2>
              <div className="bg-[#111816] p-6 rounded-xl border border-[#283834] space-y-4">
                <h3 className="text-xl font-bold text-white">Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart Warehouses</h3>
                <p className="text-[#a4beb5] text-sm leading-relaxed">
                  In modern smart fulfillment centers, traditional centralized fleet management systems create single-point-of-failure bottlenecks, high communication latency, and severe choke-point collisions when scaling beyond a few mobile robots. 
                </p>
                <p className="text-[#a4beb5] text-sm leading-relaxed">
                  <strong>The Solution:</strong> NEXUS-Fleet delivers an edge-native distributed coordination platform where AMRs exchange pose and intent over local P2P radio mesh networks, dynamically resolving path overlaps, predicting collisions, and executing task allocations with zero cloud latency.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <span className="text-[#3db89a] font-bold">ACTIVE FLEET</span>
                  <p className="text-white text-sm">5 Active AMRs (AMR-01 .. AMR-05)</p>
                </div>
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <span className="text-[#3db89a] font-bold">CHARGING SLOTS</span>
                  <p className="text-white text-sm">5 Workstation Slots (C-01 .. C-05)</p>
                </div>
                <div className="bg-[#111816] p-4 rounded-xl border border-[#283834] space-y-1">
                  <span className="text-[#3db89a] font-bold">STORAGE GRID</span>
                  <p className="text-white text-sm">48 Shelves & 4 Pack Counters</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "hardware" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Edge-AI Hardware Deployment Specifications</h2>
              <p className="text-[#a4beb5]">Production hardware specifications for physical AMR edge computer integration:</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111816] p-5 rounded-xl border border-[#283834] space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Cpu className="text-[#3db89a]" size={20} />
                    <span>Primary Edge Computer</span>
                  </div>
                  <ul className="text-xs text-[#8aa39b] space-y-1.5 list-disc list-inside">
                    <li>NVIDIA Jetson Orin Nano / Raspberry Pi 5 (8GB)</li>
                    <li>Ubuntu 22.04 LTS (Real-Time Kernel Patch PREEMPT_RT)</li>
                    <li>2x CAN-FD Interfaces for Motor Controller telemetry</li>
                    <li>RPLIDAR S2 / 2D LiDAR LiDAR safety scanner</li>
                  </ul>
                </div>

                <div className="bg-[#111816] p-5 rounded-xl border border-[#283834] space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Radio className="text-[#3db89a]" size={20} />
                    <span>Communication & Middleware</span>
                  </div>
                  <ul className="text-xs text-[#8aa39b] space-y-1.5 list-disc list-inside">
                    <li>ROS2 Humble Hawksbill / Zenoh DDS Bridge</li>
                    <li>Ad-hoc Wi-Fi 6 / 802.11ax P2P Peer Mesh</li>
                    <li>ISO 3691-4 Industrial Safety Envelope (0.9m emergency halt)</li>
                    <li>Sub-20ms P2P message delivery latency</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "research" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">SIH 2026 Research & Literature Mapping</h2>
              <div className="space-y-4">
                {[
                  {
                    title: "1. DC-MRTA — Decentralized Multi-Robot Task Allocation and Navigation in Complex Environments",
                    authors: "A. Agrawal et al., IEEE/RSJ IROS 2022",
                    doi: "DOI: 10.1109/IROS47612.2022.9981353",
                    url: "https://ieeexplore.ieee.org/document/9981353",
                    desc: "Combines decentralized task allocation with ORCA-based navigation for warehouse robots."
                  },
                  {
                    title: "2. RTAW — Reinforcement Learning Method for Multi-Robot Task Allocation in Warehouse Environments",
                    authors: "IEEE ICRA 2023",
                    doi: "DOI: 10.1109/ICRA48891.2023.10161310",
                    url: "https://ieeexplore.ieee.org/document/10161310",
                    desc: "Studies multi-robot task allocation in warehouse environments and reports large-scale simulation results."
                  },
                  {
                    title: "3. A Multi-robot Task Allocation and Path Planning Method for Warehouse System",
                    authors: "IEEE Conference Publication 2023",
                    doi: "IEEE Xplore",
                    url: "https://ieeexplore.ieee.org/document/9549796",
                    desc: "Joint multi-robot task allocation and path planning for warehouse logistics systems."
                  },
                  {
                    title: "4. Decentralized Task Allocation for Redundant Multi-Robot Systems: Iterative Consensus",
                    authors: "IEEE ICCA 2024",
                    doi: "DOI: 10.1109/ICCA.2024.10591823",
                    url: "https://ieeexplore.ieee.org/document/10591823",
                    desc: "Uses local information for decentralized task allocation and considers fault resilience."
                  }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#111816] p-5 rounded-xl border border-[#283834] space-y-2">
                    <h3 className="font-bold text-white text-base">{item.title}</h3>
                    <p className="text-xs text-[#8aa39b]">{item.authors} · <span className="font-mono text-[#3db89a]">{item.doi}</span></p>
                    <p className="text-sm text-[#a4beb5]">{item.desc}</p>
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#3db89a] hover:underline font-mono pt-1">
                      <span>View IEEE Document</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "loop" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Robot Agent 10-Step Deterministic Execution Loop</h2>
              <p className="text-[#a4beb5]">Every 100ms tick, each `RobotAgent` instance runs the following deterministic state machine loop:</p>

              <ol className="space-y-3 font-mono text-sm">
                {[
                  "1. OBSERVE — Read inbox radio messages (HEARTBEAT, STATE_UPDATE, EDGE_BLOCKED).",
                  "2. UPDATE WORLD MODEL — Refresh cached peer positions, battery levels, and priority scores.",
                  "3. PREDICT — Evaluate upcoming intersection/corridor traversals against peer ETAs.",
                  "4. PLAN — Compute A* path factoring distance, congestion, risk, and active leases.",
                  "5. COMMUNICATE — Broadcast local telemetry, battery, priority, and route intent to peers.",
                  "6. NEGOTIATE — Execute priority-based yield or proceed decision upon path conflict.",
                  "7. RESERVE — Acquire time-bounded node and edge corridor leases.",
                  "8. ACT — Advance kinematic position along target edge towards destination.",
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
              <h2 className="text-2xl font-bold text-white border-b border-[#283834] pb-4">Peer-to-Peer Radio Protocol Packet Schema</h2>
              <p className="text-[#a4beb5]">Ad-hoc radio mesh packet contracts passed between AMRs over Zenoh / ROS2 DDS:</p>

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
    "intent": "PICKUP",
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
              <p className="text-[#a4beb5]">Right-of-way priority score evaluation formula:</p>
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
