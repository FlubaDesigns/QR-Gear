# FD Admin Module Integration Guide

## 4 New Modules Ready to Add

### 1. DeployModule
**File:** `DeployModule.tsx`
**Location:** `client/src/components/admin/`
**What it does:** One-button deploy dashboard for all 7 platforms

**Integration:**
```jsx
import DeployModule from '@/components/admin/DeployModule';

// Add to admin router:
<Route path="/admin/deploy" element={<DeployModule />} />

// Add to admin sidebar:
<NavItem icon={<RefreshCw />} label="Deploy" href="/admin/deploy" />
```

---

### 2. BrainOrchestrator
**File:** `BrainOrchestrator.tsx`
**Location:** `client/src/components/admin/`
**What it does:** Multi-AI courtroom with Support/Oppose/Neutral stances

**Integration:**
```jsx
import BrainOrchestrator from '@/components/admin/BrainOrchestrator';

// Add to admin router:
<Route path="/admin/brain" element={<BrainOrchestrator />} />

// Add to admin sidebar:
<NavItem icon={<Users />} label="Brain" href="/admin/brain" />
```

**Features:**
- Add/remove AI agents
- Assign stances (Support/Oppose/Neutral)
- Collaborative or adversarial mode
- Reasoning depth control (Quick/Standard/Deep/Maximum)

---

### 3. ConscorceModule
**File:** `ConscorceModule.tsx`
**Location:** `client/src/components/admin/`
**What it does:** AI governance and policy enforcement

**Integration:**
```jsx
import ConscorceModule from '@/components/admin/ConscorceModule';

// Add to admin router:
<Route path="/admin/conscience" element={<ConscorceModule />} />

// Add to admin sidebar:
<NavItem icon={<Shield />} label="Governance" href="/admin/conscience" />
```

**Features:**
- System policies (Content Safety, Privacy, Bias Detection, Hallucination Check)
- Custom rules via Subconscience
- Risk scoring
- Enable/disable toggles

---

### 4. ReusableListingEngine
**File:** `ReusableListingEngine.tsx`
**Location:** `client/src/components/admin/`
**What it does:** Create once, deploy everywhere

**Integration:**
```jsx
import ReusableListingEngine from '@/components/admin/ReusableListingEngine';

// Add to admin router:
<Route path="/admin/listings" element={<ReusableListingEngine />} />

// Add to admin sidebar:
<NavItem icon={<Globe />} label="Listings" href="/admin/listings" />
```

**Features:**
- Create parent listing once
- Select platforms (QR Gear, Kingdom Connects, etc.)
- AI auto-adapts per platform
- Deploy to all platforms in one click

---

## Step-by-Step Integration

### Step 1: Copy Files
1. Download all 4 `.tsx` files
2. Copy to `client/src/components/admin/` in your Replit

### Step 2: Update Admin Router
In your `client/src/pages/Admin.tsx` or admin routing file:

```jsx
import DeployModule from '@/components/admin/DeployModule';
import BrainOrchestrator from '@/components/admin/BrainOrchestrator';
import ConscorceModule from '@/components/admin/ConscorceModule';
import ReusableListingEngine from '@/components/admin/ReusableListingEngine';

export function AdminPage() {
  return (
    <Routes>
      {/* Existing routes */}
      
      {/* New routes */}
      <Route path="deploy" element={<DeployModule />} />
      <Route path="brain" element={<BrainOrchestrator />} />
      <Route path="conscience" element={<ConscorceModule />} />
      <Route path="listings" element={<ReusableListingEngine />} />
    </Routes>
  );
}
```

### Step 3: Update Sidebar Navigation
Find your admin sidebar component (likely in `components/admin/Sidebar.tsx` or similar):

```jsx
<NavItem icon={<RefreshCw />} label="Deploy" href="/admin/deploy" />
<NavItem icon={<Users />} label="Brain" href="/admin/brain" />
<NavItem icon={<Shield />} label="Governance" href="/admin/conscience" />
<NavItem icon={<Globe />} label="Listings" href="/admin/listings" />
```

### Step 4: Import Icons
All components use lucide-react icons. Make sure these are imported:

```jsx
import { 
  RefreshCw, Users, Shield, Globe, 
  Play, Zap, Plus, Trash2, Lock,
  Settings, Send, CheckCircle, AlertTriangle,
  ToggleLeft, ToggleRight, AlertCircle, Clock
} from 'lucide-react';
```

### Step 5: Test in Replit
1. Push changes to Replit
2. Navigate to `/admin/deploy`, `/admin/brain`, `/admin/conscience`, `/admin/listings`
3. Test each module

---

## Component Details

### DeployModule
- **Platforms:** All 7 (Fluba Web, QR Gear, Kingdom Connects, Pollsit, AfterSignal, Brain, Conscience)
- **Status tracking:** idle, building, deploying, success, failed
- **Logs:** Real-time deployment logs per platform
- **Build time:** Shows deployment duration

### BrainOrchestrator
- **Modes:** Collaborative (no opposing sides) or Adversarial (balanced Support/Oppose)
- **Providers:** Claude, GPT, Grok, Gemini, Custom
- **Stances:** Support, Oppose, Neutral
- **Effort levels:** Quick, Standard, Deep, Maximum
- **Balance validation:** Prevents invalid configurations

### ConscorceModule
- **System Policies:** 4 hard rules (Content Safety, Privacy, Bias, Hallucination)
- **Custom Rules:** Add unlimited Subconscience rules
- **Risk Scoring:** 0-100 scale
- **Actions:** Allow, Review, Block
- **Toggles:** Conscience and Subconscience ON/OFF

### ReusableListingEngine
- **Platforms:** QR Gear, Kingdom Connects, Pollsit, AfterSignal, Fluba Marketplace
- **Parent Listing:** Single source of truth
- **AI Adaptation:** Auto-customize per platform
- **Deployment:** One-click deploy to all surfaces
- **Stats:** Active platform count, adaptation count

---

## Styling

All components use FD brand colors:
- **Primary:** `#00C853` (Bright green)
- **Dark:** `#070D07` (Deep dark)
- **Silver-green:** `#7AB87A` (Accent)
- **Light:** `#EEF7EE` (Text)

Uses shadcn/ui `Card`, `CardContent`, `CardHeader`, `CardTitle` components (already in your project).

---

## What's Next

Once integrated:
1. ✅ DeployModule → Replace manual deployments
2. ✅ BrainOrchestrator → Multi-AI reasoning control
3. ✅ ConscorceModule → Governance enforcement
4. ✅ ReusableListingEngine → Multi-platform distribution

All 4 working together = **Complete FD ecosystem in admin panel**

---

## Questions?

Check your FD Replit for existing admin module patterns:
- `TodayModule.tsx`
- `BrainInboxModule.tsx`
- `SystemModule.tsx`

These follow the same Card/CardContent/CardHeader structure.

**Deploy now and let me know when you hit issues.**
