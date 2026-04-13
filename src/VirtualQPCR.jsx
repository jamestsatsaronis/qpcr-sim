import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Data ───────────────────────────────────────────
const PRIMERS = [
  {
    id: 1, label: "Primer Set 1", specificity: "specific", dimer: false,
    ampBp: 104, tm: 84,
    fwd: { tm: 60.2, gc: 55, len: 20, dimer: "No", clamp: 1, run: 3 },
    rev: { tm: 63.5, gc: 60, len: 20, dimer: "No", clamp: 1, run: 2 },
    desc: "Binds specifically to your gene of interest with good primer properties."
  },
  {
    id: 2, label: "Primer Set 2", specificity: "nonspecific", dimer: false,
    ampBp: 183, tm: 83,
    fwd: { tm: 59.8, gc: 50, len: 21, dimer: "No", clamp: 1, run: 3 },
    rev: { tm: 61.2, gc: 52, len: 20, dimer: "No", clamp: 1, run: 4 },
    desc: "Predicted to have some very low level off-target binding."
  },
  {
    id: 3, label: "Primer Set 3", specificity: "specific", dimer: true,
    ampBp: 137, tm: 81,
    fwd: { tm: 62.1, gc: 58, len: 19, dimer: "Yes", clamp: 2, run: 2 },
    rev: { tm: 60.8, gc: 55, len: 20, dimer: "Yes", clamp: 1, run: 3 },
    desc: "Binds specifically but the primers are predicted to form primer dimers."
  },
  {
    id: 4, label: "Primer Set 4", specificity: "specific", dimer: false,
    ampBp: 472, tm: 93,
    fwd: { tm: 64.3, gc: 62, len: 22, dimer: "No", clamp: 2, run: 2 },
    rev: { tm: 63.1, gc: 58, len: 21, dimer: "No", clamp: 1, run: 3 },
    desc: "Binds specifically but produces a very large amplicon (472 bp)."
  },
];

// ─── Math helpers ───────────────────────────────────
function sigmoid(x, L, k, x0) {
  return L / (1 + Math.exp(-k * (x - x0)));
}
function gaussian(x, A, mu, s) {
  return A * Math.exp(-((x - mu) ** 2) / (2 * s * s));
}

function makeAmpData(c1, c2, e1, e2, P) {
  const d = [];
  for (let c = 0; c <= 45; c += 0.5) {
    const n = () => (Math.random() - 0.5) * 0.015 * P;
    const bg = () => Math.abs(Math.random() * 0.002);
    d.push({
      cycle: c,
      hk: Math.max(0.001, c1 > 0 ? sigmoid(c, P * e1, 0.55 * e1, c1) + n() : bg()),
      goi: Math.max(0.001, c2 > 0 ? sigmoid(c, P * e2, 0.5 * e2, c2) + n() : bg()),
      hkDil: Math.max(0.001, c1 > 0 ? sigmoid(c, P * e1 * 0.85, 0.5 * e1, c1 + 3) + n() : bg()),
      goiDil: Math.max(0.001, c2 > 0 ? sigmoid(c, P * e2 * 0.85, 0.45 * e2, c2 + 3) + n() : bg()),
    });
  }
  return d;
}

// Melt data now generates SEPARATE hk and goi traces
function makeMeltData(hkPeaks, goiPeaks) {
  const d = [];
  for (let t = 60; t <= 100; t += 0.25) {
    let hk = 0, goi = 0;
    for (const p of hkPeaks) hk += gaussian(t, p.a, p.mu, p.s);
    for (const p of goiPeaks) goi += gaussian(t, p.a, p.mu, p.s);
    d.push({
      temp: t,
      hk: Math.max(0, hk + (Math.random() - 0.5) * 0.1),
      goi: Math.max(0, goi + (Math.random() - 0.5) * 0.1),
    });
  }
  return d;
}

// Single-trace melt for primer amplicon preview
function makeSingleMelt(peaks) {
  const d = [];
  for (let t = 60; t <= 100; t += 0.25) {
    let v = 0;
    for (const p of peaks) v += gaussian(t, p.a, p.mu, p.s);
    d.push({ temp: t, dFdT: Math.max(0, v + (Math.random() - 0.5) * 0.1) });
  }
  return d;
}

// ─── Shared style constants for accessibility ───────
const TICK = { fill: "#d0d8e0", fontSize: 15 };
const AXIS_LABEL_STYLE = { fill: "#d0d8e0", fontSize: 15 };
const CHART_MARGIN = { top: 10, right: 24, bottom: 28, left: 10 };
const TT_STYLE = { background: "#1a2233", border: "1px solid #556", borderRadius: 8, fontSize: 15, color: "#f0f4f8" };

// ─── UI Components ──────────────────────────────────

function InfoTip({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Info about ${title}`}
        style={{
          background: "#3388cc", color: "#fff", border: "none",
          borderRadius: "50%", width: 30, height: 30, fontSize: 17,
          cursor: "pointer", fontWeight: 700, marginLeft: 8,
          lineHeight: "30px", textAlign: "center", fontFamily: "serif",
        }}
      >
        i
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: 36, left: "50%",
          transform: "translateX(-50%)", width: 380,
          background: "#1a2233", color: "#f0f4f8",
          padding: "18px 20px", borderRadius: 12, fontSize: 16,
          lineHeight: 1.6, zIndex: 999,
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#3388cc", fontSize: 18 }}>
            {title}
          </div>
          {children}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close info"
            style={{
              position: "absolute", top: 8, right: 10,
              background: "none", border: "none",
              color: "#bcc8d4", cursor: "pointer", fontSize: 20,
            }}
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}

function Btn({ children, onClick, variant, disabled }) {
  const isPrimary = variant !== "secondary";
  const s = isPrimary
    ? { background: "#3388cc", color: "#fff", border: "none", boxShadow: "0 2px 10px rgba(50,130,200,0.3)" }
    : { background: "transparent", color: "#3388cc", border: "2px solid #3388cc" };
  return (
    <button
      disabled={disabled} onClick={onClick}
      style={{
        ...s, padding: "14px 28px", borderRadius: 10, fontSize: 18,
        cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600,
        transition: "all .2s", opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit", lineHeight: 1.3,
      }}
    >
      {children}
    </button>
  );
}

function Card({ title, info, children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 14,
      padding: "24px 28px", border: "1px solid rgba(255,255,255,0.07)",
      marginBottom: 20,
    }}>
      {title && (
        <h3 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 600, color: "#eef2f6" }}>
          {title}
          {info && <InfoTip title={title}>{info}</InfoTip>}
        </h3>
      )}
      {children}
    </div>
  );
}

function ProgressBar({ idx }) {
  const stg = ["Primers", "RNA Isolation", "QC", "cDNA / qPCR", "Results"];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
      {stg.map((s, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            height: 7, borderRadius: 4, marginBottom: 6,
            background: i <= idx ? "#3388cc" : "rgba(255,255,255,0.1)",
            transition: "background 0.4s",
          }} />
          <div style={{
            fontSize: 14, color: i <= idx ? "#55aaee" : "#7888a0",
            fontWeight: i === idx ? 700 : 400,
          }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ days, cost }) {
  return (
    <div style={{
      display: "flex", gap: 24, justifyContent: "center",
      padding: "12px 28px", background: "rgba(255,255,255,0.03)",
      borderRadius: 10, marginBottom: 20,
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#a8b4c0", textTransform: "uppercase", letterSpacing: 1 }}>Time</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: days > 14 ? "#e85" : "#8cf" }}>
          {days.toFixed(1)} <span style={{ fontSize: 16, fontWeight: 400 }}>days</span>
        </div>
      </div>
      <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#a8b4c0", textTransform: "uppercase", letterSpacing: 1 }}>Cost</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: cost > 1000 ? "#e85" : "#8cf" }}>${cost}</div>
      </div>
    </div>
  );
}

function PrimerTable({ primer }) {
  const th = {
    padding: "8px 12px", background: "rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    fontSize: 16, fontWeight: 600, textAlign: "left",
  };
  const td = {
    padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 16,
  };
  const rows = [
    ["Length (bp)", primer.fwd.len, primer.rev.len],
    ["Tm (°C)", primer.fwd.tm, primer.rev.tm],
    ["GC%", primer.fwd.gc, primer.rev.gc],
    ["GC Clamp", primer.fwd.clamp, primer.rev.clamp],
    ["Run Length (bp)", primer.fwd.run, primer.rev.run],
    ["Primer Dimer", primer.fwd.dimer, primer.rev.dimer],
    ["Secondary Structure", "None", "None"],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
      <thead>
        <tr><th style={th}>Property</th><th style={th}>Forward</th><th style={th}>Reverse</th></tr>
      </thead>
      <tbody>
        {rows.map(([l, f, r]) => (
          <tr key={l}><td style={td}>{l}</td><td style={td}>{f}</td><td style={td}>{r}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── SVG Gel ────────────────────────────────────────
function GelSVG({ lanes, label }) {
  const lW = 54, gap = 72, w = 28 + lanes.length * gap, h = 400;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", margin: "0 auto" }}>
        <defs>
          <filter id="bandGlow">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="smearGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(120,255,120,0.4)" />
            <stop offset="100%" stopColor="rgba(120,255,120,0.02)" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={w} height={h} rx={10} fill="#080810" />
        {lanes.map((lane, i) => {
          const cx = 12 + gap / 2 + i * gap, lx = cx - lW / 2;
          return (
            <g key={i}>
              <rect x={lx} y={18} width={lW} height={7} rx={1} fill="#151520" stroke="#333" strokeWidth={0.5} />
              <text x={cx} y={h - 8} fill="#c8d0dc" fontSize={14} textAnchor="middle" fontFamily="sans-serif">
                {lane.label}
              </text>
              {lane.smear && (
                <rect x={lx + 5} y={38} width={lW - 10} height={240} rx={3}
                  fill="url(#smearGrad)" opacity={lane.smearOpacity || 0.7} />
              )}
              {(lane.bands || []).map((b, bi) => (
                <rect key={bi} x={lx + 3} y={32 + b.y * 260} width={lW - 6}
                  height={b.thick ? 14 : 8} rx={2}
                  fill={`rgba(140,255,140,${b.intensity})`} filter="url(#bandGlow)" />
              ))}
            </g>
          );
        })}
      </svg>
      {label && <div style={{ fontSize: 14, color: "#bcc8d4", marginTop: 8 }}>{label}</div>}
    </div>
  );
}

// ─── NanoDrop ───────────────────────────────────────
function NanoDropDisplay({ concentration, r280, r230 }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, #c0d0e0, #a0b0c0)", borderRadius: 16,
      padding: "22px 28px", maxWidth: 480, margin: "0 auto",
      fontFamily: "'Courier New', monospace",
      boxShadow: "0 6px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)",
      border: "2px solid #7a8a9a",
    }}>
      <div style={{ background: "#1a3050", color: "#5599cc", padding: "4px 12px", borderRadius: 5, fontSize: 14, marginBottom: 12 }}>
        BFW / Nucleic acid: RNA
      </div>
      <div style={{ fontSize: 14, color: "#8898b0" }}>Concentration nucleic acid</div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "#111", textAlign: "center", margin: "8px 0 12px" }}>
        {concentration.toFixed(1)} <span style={{ fontSize: 20 }}>ng/µL</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #889", paddingTop: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#8898b0" }}>A260/A280</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: r280 >= 1.8 && r280 <= 2.15 ? "#1a7a3a" : "#b33" }}>
            {r280.toFixed(3)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#8898b0" }}>A260/A230</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: r230 >= 1.8 ? "#1a7a3a" : "#b33" }}>
            {r230.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════
export default function VirtualQPCR() {
  const [step, setStep] = useState("intro");
  const [playerName, setPlayerName] = useState("");
  const [days, setDays] = useState(0);
  const [cost, setCost] = useState(0);
  const [logScale, setLogScale] = useState(false);
  const [viewPrimer, setViewPrimer] = useState(null);
  const [primerIdx, setPrimerIdx] = useState(0);
  const [hasDimer, setHasDimer] = useState(true);
  const [targetSpec, setTargetSpec] = useState("nonspecific");
  const [ampSize, setAmpSize] = useState(104);
  const [phaseSep, setPhaseSep] = useState(null);
  const [resuspension, setResuspension] = useState(null);
  const [puritySpec, setPuritySpec] = useState(1.0);
  const [purityPCR, setPurityPCR] = useState(1.0);
  const [yieldSpec, setYieldSpec] = useState(1.0);
  const [yieldPCR, setYieldPCR] = useState(1.0);
  const [degraded, setDegraded] = useState(false);
  const [reprecipitated, setReprecipitated] = useState(false);
  const [resultType, setResultType] = useState("good");
  const [isSuccess, setIsSuccess] = useState(false);

  const stageMap = {
    intro: 0, primer_check: 0, primer_search: 0, primer_amplicon: 0,
    phase_sep: 1, rna_resuspend: 1,
    nanodrop: 2, spectrum: 2, reprecipitate: 2, form_gel_q: 2, form_gel_result: 2,
    cdna_synth: 3,
    amp_plot: 4, melt_curve: 4, amp_gel_q: 4, amp_gel: 4, end: 4,
  };

  // ── Computed NanoDrop values ──
  const ndConc = useMemo(() => (phaseSep === "yield" ? 190 : 120) * yieldSpec * puritySpec, [phaseSep, yieldSpec, puritySpec]);
  const ndR280 = useMemo(() => { let r = 2.0; if (phaseSep === "yield") r -= 0.25; if (resuspension === "milliq") r -= 0.15; return Math.max(0.5, r * puritySpec); }, [phaseSep, resuspension, puritySpec]);
  const ndR230 = useMemo(() => { let r = 2.1; if (phaseSep === "yield") r -= 0.4; if (resuspension === "trisedta") r -= 0.3; if (resuspension === "milliq") r -= 0.2; return Math.max(0.5, r * puritySpec); }, [phaseSep, resuspension, puritySpec]);
  const spectrumType = useMemo(() => { if (ndConc < 10) return "blank"; const a = ndR280 < 1.7, b = ndR230 < 1.6; if (a && b) return "both"; if (a) return "high280"; if (b) return "high230"; return "good"; }, [ndConc, ndR280, ndR230]);

  const spectrumData = useMemo(() => {
    const pts = [];
    for (let wl = 220; wl <= 320; wl++) {
      let a = gaussian(wl, 0.8, 260, 15);
      a += gaussian(wl, (spectrumType === "high280" || spectrumType === "both") ? 0.5 : 0.25, 280, 10);
      a += gaussian(wl, (spectrumType === "high230" || spectrumType === "both") ? 0.6 : 0.15, 230, 12);
      if (spectrumType === "blank") a = Math.abs((Math.random() - 0.5) * 0.02);
      pts.push({ wl, abs: Math.max(0, a) });
    }
    return pts;
  }, [spectrumType]);

  // ── Amplification data ──
  const ampData = useMemo(() => {
    switch (resultType) {
      case "good": return makeAmpData(18, 22, 1.0, 0.95, 1.0);
      case "noamp": case "hkonly": return makeAmpData(18, 0, 1.0, 0, 1.0);
      case "primerdimer": return makeAmpData(18, 12, 1.0, 0.3, 0.8);
      case "nonspec": return makeAmpData(18, 20, 1.0, 0.7, 0.9);
      default: return makeAmpData(18, 22, 1.0, 0.95, 1.0);
    }
  }, [resultType]);

  // ── Melt data — separate HK (blue) and GOI (red) traces ──
  const meltData = useMemo(() => {
    const hkPeaks = [{ a: 18, mu: 82, s: 1.3 }]; // HK always at ~82°C
    let goiPeaks;
    switch (resultType) {
      case "good":        goiPeaks = [{ a: 17, mu: 85, s: 1.2 }]; break;
      case "noamp":
      case "hkonly":      goiPeaks = []; break; // no GOI product
      case "primerdimer": goiPeaks = [{ a: 12, mu: 72, s: 2.0 }]; break; // dimer peak
      case "nonspec":     goiPeaks = [{ a: 8, mu: 78, s: 2.5 }, { a: 6, mu: 90, s: 1.5 }]; break;
      default:            goiPeaks = [];
    }
    return makeMeltData(hkPeaks, goiPeaks);
  }, [resultType]);

  // ── Gel data ──
  const formGelLanes = useMemo(() => {
    const ladder = {
      label: "Ladder",
      bands: [
        { y: 0.05, intensity: 0.4 }, { y: 0.15, intensity: 0.45 },
        { y: 0.25, intensity: 0.35 }, { y: 0.30, intensity: 0.35 },
        { y: 0.36, intensity: 0.35 }, { y: 0.46, intensity: 0.3 },
        { y: 0.56, intensity: 0.3 }, { y: 0.76, intensity: 0.25 },
      ],
    };
    const hi = phaseSep === "yield", intact = !degraded;
    let sample;
    if (intact && hi) sample = { label: "RNA", bands: [{ y: 0.15, intensity: 0.95, thick: true }, { y: 0.30, intensity: 0.55 }] };
    else if (intact) sample = { label: "RNA", bands: [{ y: 0.15, intensity: 0.4, thick: true }, { y: 0.30, intensity: 0.25 }] };
    else if (hi) sample = { label: "RNA", smear: true, smearOpacity: 0.7, bands: [] };
    else sample = { label: "RNA", smear: true, smearOpacity: 0.35, bands: [] };
    return [ladder, sample];
  }, [degraded, phaseSep]);

  const ampGelLanes = useMemo(() => {
    const hk = { label: "HK", bands: [{ y: 0.5, intensity: 0.8 }] };
    switch (resultType) {
      case "good": return [hk, { label: "GOI", bands: [{ y: 0.52, intensity: 0.7 }] }];
      case "noamp": case "hkonly": return [hk, { label: "GOI", bands: [] }];
      case "primerdimer": return [hk, { label: "GOI", bands: [{ y: 0.85, intensity: 0.35 }] }];
      case "nonspec": return [hk, { label: "GOI", smear: true, smearOpacity: 0.4, bands: [] }];
      default: return [hk, { label: "GOI", bands: [] }];
    }
  }, [resultType]);

  // ── Handlers ──
  const handlePrimerCheck = (c) => {
    if (c === "order") {
      // Order the paper's primers without checking — risky
      setHasDimer(true); setTargetSpec("nonspecific"); setAmpSize(104); setStep("phase_sep");
    } else {
      // Start searching — show first alternative primer, costs 0.5 days
      setDays(d => d + 0.5);
      setPrimerIdx(0);
      setViewPrimer(PRIMERS[0]);
      setStep("primer_search");
    }
  };
  const nextPrimer = () => {
    const next = primerIdx + 1;
    if (next >= PRIMERS.length) {
      // Seen all primers — must pick from the last one or go back
      return;
    }
    setDays(d => d + 0.5);
    setPrimerIdx(next);
    setViewPrimer(PRIMERS[next]);
  };
  const selectPrimer = (p) => { setHasDimer(p.dimer); setTargetSpec(p.specificity); setAmpSize(p.ampBp); setStep("phase_sep"); };
  const handlePhaseSep = (c) => { setPhaseSep(c); if (c === "purity") { setPuritySpec(0.95); setPurityPCR(0.95); setYieldSpec(0.6); } else { setPuritySpec(0.7); setPurityPCR(0.65); setYieldSpec(0.95); } setStep("rna_resuspend"); };
  const handleResuspend = (c) => { setResuspension(c); if (c === "depc") { setDays(d => d + 0.5); setDegraded(false); } else if (c === "milliq") { setDegraded(true); } else { setPurityPCR(p => p * 0.6); setDegraded(false); } setYieldPCR(yieldSpec * puritySpec); setStep("nanodrop"); };
  const handleReprecipitate = (doIt) => { if (doIt) { setReprecipitated(true); setDays(d => d + 1); setPuritySpec(p => Math.min(1, p * 1.3)); setPurityPCR(p => Math.min(1, p * 1.2)); setYieldSpec(y => y * 0.8); setStep("nanodrop"); } else setStep("form_gel_q"); };
  const handleKit = (c) => {
    const ny = c === "new" ? yieldPCR : yieldPCR * 0.6;
    if (c === "new") { setDays(d => d + 10); setCost(cc => cc + 651); } else setYieldPCR(ny);
    const eP = hasDimer ? 0.3 : 1.0, eT = targetSpec === "specific" ? 1.0 : 0.5, eK = c === "new" ? 1.0 : 0.6;
    const eR = (c === "new" ? yieldPCR : ny) * purityPCR, tot = eP * eT * eK * eR;
    let rt = "noamp";
    if (tot >= 0.15) rt = "good";
    if (ampSize > 400 && tot < 0.4) rt = "hkonly";
    if (hasDimer && tot < 0.3) rt = "primerdimer";
    if (targetSpec === "nonspecific" && tot > 0.1) rt = "nonspec";
    if (tot < 0.05) rt = "noamp";
    setResultType(rt); setIsSuccess(rt === "good"); setStep("amp_plot");
  };
  const restart = () => { setStep("intro"); setDays(0); setCost(0); setPlayerName(""); setViewPrimer(null); setPrimerIdx(0); setHasDimer(true); setTargetSpec("nonspecific"); setAmpSize(104); setPhaseSep(null); setResuspension(null); setPuritySpec(1); setPurityPCR(1); setYieldSpec(1); setYieldPCR(1); setDegraded(false); setReprecipitated(false); setResultType("good"); setIsSuccess(false); setLogScale(false); };

  // Body text style
  const P = ({ children }) => <p style={{ color: "#d4dce6", lineHeight: 1.8, fontSize: 18, marginBottom: 20 }}>{children}</p>;

  // ── Render ──
  const renderStep = () => {
    switch (step) {
      case "intro":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 10 }}>🧬</div>
            <h1 style={{ fontSize: 36, fontWeight: 300, marginBottom: 12, letterSpacing: -0.5 }}>Virtual qPCR Flow</h1>
            <p style={{ color: "#c8d4e0", lineHeight: 1.8, maxWidth: 580, margin: "0 auto 28px", fontSize: 18 }}>
              Welcome to the lab! You've just attended a conference where a researcher showed microarray results revealing a gene that could revolutionise your field.
              <br /><br />
              Your competitors were at the talk too — one even asked about the data. You need to validate gene expression using qPCR, and fast!
            </p>
            <div style={{ maxWidth: 340, margin: "0 auto 24px" }}>
              <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Enter your name"
                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#eef2f6", fontSize: 18, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
            </div>
            <Btn onClick={() => setStep("primer_check")} disabled={!playerName.trim()}>Begin Experiment</Btn>
          </div>
        );

      case "primer_check":
        return (
          <Card title="Primer Selection" info={<span>Primers determine what gets amplified in your qPCR. Using unvalidated primers can lead to non-specific amplification, primer dimers, or complete failure. Investing time in validation upfront can save days of troubleshooting later.</span>}>
            <P>You find a paper that describes the measurement of this gene, listing the primer sequences used. You are in a hurry to get results. What do you do with this sequence?</P>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn variant="secondary" onClick={() => handlePrimerCheck("order")}>Order these primers! (0 days)</Btn>
              <Btn variant="secondary" onClick={() => handlePrimerCheck("search")}>Look for other primer options (0.5 days per primer set)</Btn>
            </div>
          </Card>
        );

      case "primer_search": {
        const p = PRIMERS[primerIdx];
        const isLast = primerIdx >= PRIMERS.length - 1;
        return (
          <Card
            title={`Primer Search — ${p.label}`}
            info={<span>When evaluating primers, consider: amplicon size (80–200 bp ideal for qPCR), primer Tm (aim for 58–62°C), GC content (40–60%), and check for primer dimers and off-target binding using tools like Primer-BLAST.</span>}
          >
            <div style={{ fontSize: 16, color: "#b0bcc8", marginBottom: 14 }}>
              Viewing primer set {primerIdx + 1} of {PRIMERS.length}
            </div>
            <P>{p.desc}</P>
            <PrimerTable primer={p} />
            <div style={{ marginTop: 14, fontSize: 15, color: "#d4dce6" }}>
              Amplicon: <strong>{p.ampBp} bp</strong> · Predicted Tm: <strong>~{p.tm}°C</strong>
            </div>
            {p.ampBp > 300 && (
              <div style={{ background: "rgba(255,150,50,0.1)", border: "1px solid rgba(255,150,50,0.3)", borderRadius: 10, padding: "12px 16px", margin: "12px 0", fontSize: 16, color: "#f0c070" }}>
                ⚠ Very large amplicon for qPCR — amplification efficiency will be reduced.
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              <Btn onClick={() => selectPrimer(p)}>Order these primers</Btn>
              <Btn variant="secondary" onClick={() => { setViewPrimer(p); setStep("primer_amplicon"); }}>View amplicon details</Btn>
              {!isLast && (
                <Btn variant="secondary" onClick={nextPrimer}>
                  Keep looking (+0.5 days)
                </Btn>
              )}
              {isLast && (
                <div style={{ width: "100%", fontSize: 16, color: "#e0d4b0", marginTop: 4 }}>
                  You have searched long enough — choose one of the primer sets to proceed.
                </div>
              )}
            </div>
          </Card>
        );
      }

      case "primer_amplicon":
        if (!viewPrimer) return null;
        return (
          <Card title={`${viewPrimer.label} — Amplicon`} info={<span>The <strong>amplicon</strong> is the DNA produced by PCR. For qPCR, <strong>80–200 bp</strong> amplicons are ideal — they amplify efficiently and give sharp melt peaks. Amplicons &gt;300 bp amplify poorly and may fail while smaller housekeeping gene amplicons succeed.</span>}>
            <P>Amplicon: <strong>{viewPrimer.ampBp} bp</strong> · Predicted Tm: <strong>~{viewPrimer.tm}°C</strong></P>
            {viewPrimer.ampBp > 300 && (
              <div style={{ background: "rgba(255,150,50,0.1)", border: "1px solid rgba(255,150,50,0.3)", borderRadius: 10, padding: "12px 16px", margin: "0 0 12px", fontSize: 16, color: "#f0c070" }}>
                ⚠ Very large amplicon for qPCR — amplification efficiency will be reduced.
              </div>
            )}
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={makeSingleMelt([{ a: 18, mu: viewPrimer.tm, s: 1.5 }])} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="temp" tick={TICK} label={{ value: "Temperature (°C)", position: "insideBottom", offset: -8, ...AXIS_LABEL_STYLE }} />
                <YAxis tick={TICK} label={{ value: "-dF/dT", angle: -90, position: "insideLeft", ...AXIS_LABEL_STYLE }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Line type="monotone" dataKey="dFdT" name="Predicted" stroke="#ff6644" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <Btn onClick={() => selectPrimer(viewPrimer)}>Order these primers</Btn>
              <Btn variant="secondary" onClick={() => setStep("primer_search")}>Back to primer search</Btn>
            </div>
          </Card>
        );

      case "phase_sep":
        return (
          <Card title="Phase Separation" info={<span>During TRIzol RNA isolation, centrifugation separates into three layers: upper <strong>aqueous phase</strong> (RNA), middle <strong>interphase</strong> (DNA), lower <strong>organic phase</strong> (proteins/lipids). Taking only the clear aqueous gives purer RNA but lower yield. Taking too much risks contamination.</span>}>
            <P>You are at the phase separation step during RNA isolation. You are:</P>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn variant="secondary" onClick={() => handlePhaseSep("purity")}>Carefully take only the aqueous phase (high purity, lower yield)</Btn>
              <Btn variant="secondary" onClick={() => handlePhaseSep("yield")}>Take as much RNA as possible (high yield, lower purity)</Btn>
            </div>
          </Card>
        );

      case "rna_resuspend":
        return (
          <Card title="RNA Resuspension" info={<span><strong>DEPC water</strong>: Treated to inactivate RNases — gold standard (takes 0.5 days). <strong>MilliQ</strong>: May contain RNases that degrade your RNA. <strong>Tris-EDTA</strong>: EDTA chelates Mg²⁺ to inhibit RNases, but also inhibits cDNA synthesis enzymes downstream.</span>}>
            <P>What do you use to solubilise your RNA pellet?</P>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn variant="secondary" onClick={() => handleResuspend("depc")}>Freshly prepare DEPC-treated water (0.5 days)</Btn>
              <Btn variant="secondary" onClick={() => handleResuspend("milliq")}>Use MilliQ water from your bench (0 days)</Btn>
              <Btn variant="secondary" onClick={() => handleResuspend("trisedta")}>Use Tris-EDTA to inhibit RNases (0 days)</Btn>
            </div>
          </Card>
        );

      case "nanodrop":
        return (
          <Card title="NanoDrop Results" info={<span><strong>A260/A280 ≈ 2.0</strong> indicates pure RNA (lower values suggest protein contamination). <strong>A260/A230 ≈ 2.0–2.2</strong> indicates no organic contaminants. Concentration is calculated from A260.</span>}>
            <NanoDropDisplay concentration={ndConc} r280={ndR280} r230={ndR230} />
            <div style={{ display: "flex", gap: 12, marginTop: 18, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn variant="secondary" onClick={() => setStep("spectrum")}>View Spectrum</Btn>
              {!reprecipitated && <Btn variant="secondary" onClick={() => setStep("reprecipitate")}>Reprecipitate</Btn>}
              <Btn onClick={() => setStep("form_gel_q")}>Continue</Btn>
            </div>
          </Card>
        );

      case "spectrum":
        return (
          <Card title="UV Absorption Spectrum" info={<span>Good RNA: <strong>single peak at 260 nm</strong>. A shoulder at <strong>280 nm</strong> indicates protein. High absorbance at <strong>230 nm</strong> indicates organic contaminants.</span>}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={spectrumData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="wl" tick={TICK} label={{ value: "Wavelength (nm)", position: "insideBottom", offset: -8, ...AXIS_LABEL_STYLE }} />
                <YAxis tick={TICK} label={{ value: "Absorbance", angle: -90, position: "insideLeft", ...AXIS_LABEL_STYLE }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Line type="monotone" dataKey="abs" stroke="#4488ff" strokeWidth={3} dot={false} />
                <ReferenceLine x={260} stroke="rgba(255,136,68,0.4)" strokeDasharray="3 3" />
                <ReferenceLine x={280} stroke="rgba(136,255,136,0.4)" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <Btn variant="secondary" onClick={() => setStep("nanodrop")}>Back to NanoDrop</Btn>
            </div>
          </Card>
        );

      case "reprecipitate":
        return (
          <Card title="Reprecipitate RNA?" info={<span>Ethanol precipitation with salt selectively precipitates nucleic acids. Improves purity but loses ~20% RNA and adds 1 day.</span>}>
            <P>Reprecipitate with overnight salt/ethanol incubation to improve purity (1 day)?</P>
            <div style={{ display: "flex", gap: 12 }}>
              <Btn onClick={() => handleReprecipitate(true)}>Yes, reprecipitate (1 day)</Btn>
              <Btn variant="secondary" onClick={() => handleReprecipitate(false)}>No, continue</Btn>
            </div>
          </Card>
        );

      case "form_gel_q":
        return (
          <Card title="Formaldehyde Gel" info={<span>A denaturing formaldehyde agarose gel separates RNA by size. Intact RNA shows <strong>two sharp bands in one lane</strong>: 28S rRNA (upper, ~4.7 kb, brighter) and 18S rRNA (lower, ~1.9 kb). Degraded RNA appears as a smear.</span>}>
            <P>Run your RNA on a formaldehyde gel to check integrity (0.5 day)?</P>
            <div style={{ display: "flex", gap: 12 }}>
              <Btn onClick={() => { setDays(d => d + 0.5); setStep("form_gel_result"); }}>Yes, run gel (0.5 days)</Btn>
              <Btn variant="secondary" onClick={() => setStep("cdna_synth")}>Skip</Btn>
            </div>
          </Card>
        );

      case "form_gel_result":
        return (
          <Card title="Formaldehyde Gel Result" info={<span>Look for <strong>two bands in the RNA lane</strong>: the upper 28S band should be roughly <strong>twice the intensity</strong> of the lower 18S band. A smear towards the bottom indicates degradation. Faint bands indicate low yield.</span>}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <GelSVG lanes={formGelLanes} label="Formaldehyde agarose gel — Ladder | RNA sample" />
            </div>
            <div style={{ textAlign: "center" }}>
              <Btn onClick={() => setStep("cdna_synth")}>Proceed to cDNA Synthesis</Btn>
            </div>
          </Card>
        );

      case "cdna_synth":
        return (
          <Card title="cDNA Synthesis & qPCR Kits" info={<span><strong>Reverse transcriptase</strong> converts RNA to cDNA for qPCR. Old kits may have degraded enzyme with reduced activity. New kits ensure optimal efficiency but cost $651 and take 7–14 days to arrive.</span>}>
            <P>All you have in the freezer are old cDNA synthesis and qPCR kits. What do you do?</P>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn variant="secondary" onClick={() => handleKit("old")}>Use old kits — stored at −30°C (0 days, $0)</Btn>
              <Btn variant="secondary" onClick={() => handleKit("new")}>Order new kits and wait (7–14 days, $651)</Btn>
            </div>
          </Card>
        );

      case "amp_plot":
        return (
          <Card title="Amplification Plot" info={<span>Shows <strong>ΔRn vs Cycle</strong>. The <strong>Ct</strong> (threshold cycle) is where the curve crosses the threshold — lower Ct means more starting template. Blue = <strong>HK</strong> (housekeeping gene). Red = <strong>GOI</strong> (gene of interest). Dashed = 1:8 dilutions (should shift ~3 cycles right). Use <strong>log scale</strong> to see the exponential phase.</span>}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 8 }}>
              {["Linear", "Log"].map(l => (
                <button key={l} onClick={() => setLogScale(l === "Log")}
                  style={{ padding: "8px 20px", borderRadius: 6, border: "2px solid #3388cc", fontSize: 16, cursor: "pointer", fontWeight: 600, background: (l === "Log") === logScale ? "#3388cc" : "transparent", color: (l === "Log") === logScale ? "#fff" : "#3388cc" }}>{l}</button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={ampData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="cycle" tick={TICK} label={{ value: "Cycle", position: "insideBottom", offset: -8, ...AXIS_LABEL_STYLE }} />
                <YAxis scale={logScale ? "log" : "linear"} domain={logScale ? [0.001, "auto"] : [0, "auto"]} tick={TICK} label={{ value: "ΔRn", angle: -90, position: "insideLeft", ...AXIS_LABEL_STYLE }} allowDataOverflow />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 16, paddingTop: 8 }} />
                <Line type="monotone" dataKey="hk" name="HK (undiluted)" stroke="#4488ff" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="goi" name="GOI (undiluted)" stroke="#ff4444" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="hkDil" name="HK (1:8 dilution)" stroke="rgba(68,136,255,0.5)" strokeWidth={2.5} dot={false} strokeDasharray="6 4" />
                <Line type="monotone" dataKey="goiDil" name="GOI (1:8 dilution)" stroke="rgba(255,68,68,0.5)" strokeWidth={2.5} dot={false} strokeDasharray="6 4" />
                <ReferenceLine y={0.15} stroke="#ffaa33" strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 12, marginTop: 18, justifyContent: "center" }}>
              <Btn variant="secondary" onClick={() => setStep("melt_curve")}>View Melt Curve</Btn>
              <Btn onClick={() => setStep("amp_gel_q")}>Continue</Btn>
            </div>
          </Card>
        );

      case "melt_curve":
        return (
          <Card title="Melt Curve Analysis" info={<span>Plots <strong>−dF/dT vs temperature</strong>. Each peak represents a distinct PCR product melting. A <strong>single sharp peak</strong> per target means specific amplification. <strong>Multiple peaks</strong> indicate non-specific products. A <strong>low-temperature peak (65–75°C)</strong> usually indicates primer dimers. Blue = HK, Red = GOI.</span>}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={meltData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="temp" tick={TICK} label={{ value: "Temperature (°C)", position: "insideBottom", offset: -8, ...AXIS_LABEL_STYLE }} />
                <YAxis tick={TICK} label={{ value: "-dF/dT", angle: -90, position: "insideLeft", ...AXIS_LABEL_STYLE }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 16, paddingTop: 8 }} />
                <Line type="monotone" dataKey="hk" name="Housekeeping gene" stroke="#4488ff" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="goi" name="Gene of interest" stroke="#ff4444" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 12, marginTop: 18, justifyContent: "center" }}>
              <Btn variant="secondary" onClick={() => setStep("amp_plot")}>Back to Amp Plot</Btn>
              <Btn onClick={() => setStep("amp_gel_q")}>Continue</Btn>
            </div>
          </Card>
        );

      case "amp_gel_q":
        return (
          <Card title="Run Amplicon Gel?" info={<span>Running PCR products on an agarose gel confirms amplicon size and specificity. A single band at the expected size = specific amplification.</span>}>
            <P>Do you want to run your amplicons on an agarose gel (0.5 day)?</P>
            <div style={{ display: "flex", gap: 12 }}>
              <Btn onClick={() => { setDays(d => d + 0.5); setStep("amp_gel"); }}>Yes, run gel (0.5 days)</Btn>
              <Btn variant="secondary" onClick={() => setStep("end")}>Skip, view results</Btn>
            </div>
          </Card>
        );

      case "amp_gel":
        return (
          <Card title="Amplicon Gel" info={<span>Lane 1 = HK (housekeeping gene). Lane 2 = GOI (gene of interest). A <strong>single bright band</strong> = specific. <strong>No band</strong> = no amplification. A <strong>band near the bottom</strong> = primer dimers. <strong>Smearing</strong> = non-specific products.</span>}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <GelSVG lanes={ampGelLanes} label="Lane 1: HK · Lane 2: GOI" />
            </div>
            <div style={{ textAlign: "center" }}>
              <Btn onClick={() => setStep("end")}>View Final Results</Btn>
            </div>
          </Card>
        );

      case "end":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>{isSuccess ? "🎉" : "😞"}</div>
            <h2 style={{ fontSize: 32, fontWeight: 400, marginBottom: 14, color: isSuccess ? "#8c8" : "#e88" }}>
              {isSuccess ? "Experiment Successful!" : "Experiment Not Optimised"}
            </h2>
            <p style={{ color: "#d4dce6", lineHeight: 1.8, maxWidth: 580, margin: "0 auto 28px", fontSize: 18 }}>
              {isSuccess
                ? `Well done, ${playerName}! You successfully measured expression levels of your gene of interest. It took ${days.toFixed(1)} days and cost $${cost}. Good luck publishing before the competition!`
                : `Unfortunately, ${playerName}, the experiment needs more optimisation. ${days.toFixed(1)} days and $${cost} spent so far. Better luck next time.`}
            </p>
            <div style={{ display: "inline-block", padding: "20px 32px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 40 }}>
                <div>
                  <div style={{ fontSize: 15, color: "#b4c0cc" }}>TIME</div>
                  <div style={{ fontSize: 36, fontWeight: 300 }}>{days.toFixed(1)} <span style={{ fontSize: 17 }}>days</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 15, color: "#b4c0cc" }}>COST</div>
                  <div style={{ fontSize: 36, fontWeight: 300 }}>${cost}</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, color: "#b4c0cc" }}>RESULT</div>
                  <div style={{ fontSize: 36, fontWeight: 300, color: isSuccess ? "#8c8" : "#e88" }}>{isSuccess ? "✓" : "✗"}</div>
                </div>
              </div>
            </div>
            <div><Btn onClick={restart}>Try Again</Btn></div>
          </div>
        );

      default: return <div style={{ fontSize: 16 }}>Unknown step: {step}</div>;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#ccd4de", fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif", padding: "20px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {step !== "intro" && (
          <>
            <ProgressBar idx={stageMap[step] ?? 0} />
            <ScoreBar days={days} cost={cost} />
          </>
        )}
        {renderStep()}
        <div style={{ textAlign: "center", marginTop: 44, fontSize: 14, color: "#556" }}>
          Virtual qPCR Flow Simulation. Designed by Alice Huang, adapted by James Tsatsaronis
        </div>
      </div>
    </div>
  );
}
