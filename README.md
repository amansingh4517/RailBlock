# 🚅 RailBlock AI — AI-Powered Automatic Block Planning System

> **Smart India Hackathon (SIH) 2026**  
> **Problem Statement ID:** 26027  
> **Title:** AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways  
> **Organization:** Ministry of Railways, Government of India  

---

## 📌 Executive Summary

Railway maintenance for fixed infrastructure across **Engineering (P-Way)**, **Signal & Telecommunication (S&T)**, and **Traction Distribution (TRD - 25kV OHE)** departments is currently requested independently via BDMS and planned manually in silos. This leads to inefficient block utilization, poor inter-departmental coordination, and excessive train detentions.

**RailBlock AI** solves this by unifying maintenance demands from **TMS**, **SMMS**, and **TDMS** into an intelligent **Shadow-Possession Multi-Objective Solver Engine**. It automatically clusters maintenance activities, minimizes total line possession windows, optimizes timetable detention, and enforces Indian Railways safety headway rules.

---

## 🚀 Key Extended Features

### 1. 🗺️ Interactive GIS Corridor Map (`NDLS – UMB 199 Km`)
- **Visual Station Track Corridors:** Live SVG corridor map covering New Delhi (NDLS) to Ambala Cantt (UMB) (Km 0 to Km 199).
- **Active Block Highlights:** Color-coded zones for Engineering (Amber), S&T (Cyan), and TRD (Emerald).
- **Caution Orders & Telemetry:** Real-time Temporary Speed Restriction (TSR) markers and live animated train position telemetry.

### 2. ⚡ Emergency Defect & Overrun Re-Optimization Simulator
- **Dynamic Disruption Injection:** Simulates emergency rail fractures (e.g. at Panipat PNP, Km 91.4) or 30–60 minute maintenance overruns.
- **Rolling-Horizon CP-SAT Replanning:** Demonstrates dynamic AI re-optimization while preserving locked past commitments and holding downstream freight traffic safely.

### 3. 🛡️ Role-Based Approval & Governance Workflow
- **IR Operational Hierarchy:** Structured workflow progression:  
  `DRAFT` $\rightarrow$ `DEPT_APPROVED` $\rightarrow$ `SR_DOM_APPROVED` $\rightarrow$ `PUBLISHED_TO_COA`.
- **Role-Aware Workspaces:** Dedicated views and action controls for Chief Section Controllers (DOM/Sr.DOM), P-Way Engineers, S&T Engineers, and TRD Officers.

### 4. 📊 Analytics & Asset Availability KPI Dashboard
- **Real-Time KPIs:** Tracks Downtime Hours Saved (via Shadow Bundling), Asset Availability Index, Multi-Dept Co-Possession Rate, and High-Priority Task Coverage.
- **Detention Reduction:** Quantifies train detention savings compared to uncoordinated departmental bids.

### 5. ⚙️ CP-SAT / Heuristic Solver Engine Switcher
- **Dual Solver Architecture:**
  - **OR-Tools CP-SAT Solver:** Multi-objective exact optimization solver.
  - **Greedy Shadow Bundling Heuristic:** High-speed real-time clustering engine.

### 6. 📋 Integrated Request Action Drawer
- Direct inspection of TMS/SMMS/TDMS maintenance requisitions, safety hazard ratings, priority scores, and assigned possession block details.

---

## 🛠️ Technology Stack

- **Frontend & UI Framework:** React 19, TanStack Start, TanStack Router
- **State Management:** Zustand
- **Styling:** Tailwind CSS v4, Lucide React Icons
- **Optimization & Logic:** Constraint Satisfaction Engine (CP-SAT & Shadow Bundling Heuristic)
- **Data Ingestion:** In-memory PGLite / Postgres schema with type-safe Kysely integration
- **Type Safety & Build:** TypeScript, Vite

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/amansingh4517/RailBlock.git
   cd RailBlock
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at **`http://localhost:8080/`**.

4. **Verify TypeScript compilation:**
   ```bash
   npm run typecheck
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📁 Repository Structure

```text
SIH2026/
├── src/
│   ├── components/
│   │   ├── control/         # Action Center, Emergency Simulator, Asset KPIs, Governance
│   │   ├── corridor/        # GIS Track Corridor Map & Ribbon
│   │   ├── layout/          # Shell navigation, Role-aware header, Responsive drawer
│   │   └── plan/            # Gantt view, Block details
│   ├── lib/
│   │   ├── rail/            # Data models, solver engines, store, KPI calculators
│   ├── routes/              # TanStack router endpoints (/control, /workspace/*, /admin, /access)
├── scripts/                 # App environment wrappers & build tools
├── README.md                # System documentation
└── package.json
```

---

## 🏆 SIH 2026 Problem Statement Alignment

| Problem Requirement | RailBlock AI Solution |
| :--- | :--- |
| **Multi-Dept Block Integration** | Co-possession shadow bundling algorithm combines ENGG, S&T, and TRD demands. |
| **Asset Availability Optimization** | Increases track availability index by clustering windows into non-peak hours. |
| **Train Operation Protection** | Enforces safety headway, passenger train priority, and TSR caution limits. |
| **COA / BDMS Interoperability** | Standardized data interfaces for seamless publication to Control Office Application. |

---

Developed with ❤️ for **Indian Railways & Smart India Hackathon 2026**.
