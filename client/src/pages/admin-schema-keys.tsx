import AdminShell from "@/components/AdminShell";
import { SIZE_TYPES, LENGTH_TYPES, COLOR_CODE_MAP, PARENT_CATEGORY_LABELS } from "@shared/qrgCodes";
import {
  GRF_ASSET_CLASSES,
  GRF_MEDIA_TYPES,
  GRF_CHANNELS,
  GRF_PURPOSES_BY_CHANNEL,
  GRF_FORMATS,
} from "@shared/graphicCodes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border pb-8 last:border-b-0">
      <div>
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FormatBar({ label, parts }: { label: string; parts: { seg: string; desc: string; mono?: boolean }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-stretch rounded-md overflow-hidden border border-border w-fit min-w-full sm:min-w-0">
          {parts.map((p, i) => (
            <div key={i} className="flex flex-col border-r border-border last:border-r-0 shrink-0">
              <div className={`px-2.5 py-1.5 bg-muted text-xs font-bold text-center whitespace-nowrap ${p.mono ? "font-mono" : ""}`}>
                {p.seg}
              </div>
              <div className="px-2.5 py-1.5 text-xs text-muted-foreground text-center leading-tight w-[90px] sm:w-[110px]">
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KeyTable({ rows, cols }: { rows: string[][]; cols: string[] }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-md border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {cols.map((c) => (
              <th key={c} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 px-3 align-top ${j === 0 ? "font-mono font-semibold text-foreground whitespace-nowrap" : "text-muted-foreground text-xs sm:text-sm"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodePill({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-block bg-muted text-foreground font-mono text-xs sm:text-sm px-2 py-0.5 rounded-md break-all">
      {children}
    </code>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</p>
  );
}

// ─── Derived data from shared constants ───────────────────────────────────────

const COLOR_ROWS = (() => {
  const seen = new Map<string, string>();
  for (const [name, code] of Object.entries(COLOR_CODE_MAP)) {
    if (!seen.has(code)) seen.set(code, name);
  }
  return Array.from(seen.entries())
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([code, name]) => [code, name]);
})();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSchemaKeys() {
  return (
    <AdminShell title="Schema Keys" subtitle="Reference for all QRG internal code schemas">
      <div className="max-w-4xl mx-auto space-y-8 pb-16 px-4 sm:px-0">

        {/* ── QRG ──────────────────────────────────────────────────────────── */}
        <Section
          title="QRG — Physical Item Identity"
          subtitle="Encodes what a physical product is and who it belongs to. Used on barcodes and in tracking only — never in URLs."
        >
          <FormatBar
            label="Full code format"
            parts={[
              { seg: "QRG", desc: "Prefix", mono: true },
              { seg: "STNNN", desc: "Blank ID (super · type · item)", mono: true },
              { seg: "C", desc: "Context letter", mono: true },
              { seg: "NNNNNN", desc: "Instance number", mono: true },
              { seg: "T", desc: "Size type", mono: true },
              { seg: "SS", desc: "Size within type", mono: true },
              { seg: "LL", desc: "Length (00 if none)", mono: true },
              { seg: "CC", desc: "Color", mono: true },
            ]}
          />

          <div className="space-y-1">
            <Label>Example</Label>
            <CodePill>QRG-11101-I-000001-1050001</CodePill>
            <p className="text-xs text-muted-foreground mt-1">
              Blank 11101 · Internal · instance #1 · Adult Alpha (T=1) · L (SS=05) · No length (LL=00) · Black (CC=01)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>S — Super-category</Label>
              <KeyTable
                cols={["Digit", "Category"]}
                rows={Object.entries(PARENT_CATEGORY_LABELS).map(([k, v]) => [k, v])}
              />
            </div>
            <div className="space-y-2">
              <Label>C — Context letter</Label>
              <KeyTable
                cols={["Letter", "Meaning"]}
                rows={[
                  ["I", "Internal — admin-created"],
                  ["M", "Member — user-created"],
                  ["E", "External — API / partner"],
                  ["O", "Owner — post-purchase"],
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Doc ID format (Firestore)</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <CodePill>qrg_STNNN</CodePill>
              <span className="text-xs text-muted-foreground">e.g.</span>
              <CodePill>qrg_11101</CodePill>
            </div>
            <p className="text-xs text-muted-foreground">
              Always 5 digits (STNNN). Legacy 4-digit and 3-digit IDs are invalid.
            </p>
          </div>
        </Section>

        {/* ── Size codes ───────────────────────────────────────────────────── */}
        <Section
          title="QRG Size Codes (T + SS)"
          subtitle="T is a single type digit; SS is the 2-digit position within that type. Together they form the first 3 digits of TSSLLCC. Global and fixed — never renumber."
        >
          <div className="space-y-2">
            <Label>T — Size type digit</Label>
            <KeyTable
              cols={["T", "Type", "Description"]}
              rows={Object.entries(SIZE_TYPES).map(([t, v]) => [t, v.label, v.description])}
            />
          </div>

          {Object.entries(SIZE_TYPES).filter(([t]) => t !== '0').map(([t, type]) => (
            <div key={t} className="space-y-2">
              <Label>T={t} — {type.label} (SS codes)</Label>
              <KeyTable
                cols={["SS", "Size"]}
                rows={Object.entries(type.codes).map(([ss, label]) => [ss, label])}
              />
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            T=0 SS=00 → One Size / unknown. Use "Youth S" / "Kids S" etc. to disambiguate children alpha from adult alpha.
            Not all products support all sizes.
          </p>
        </Section>

        {/* ── Length codes ─────────────────────────────────────────────────── */}
        <Section
          title="QRG Length Codes (LL)"
          subtitle="Two-digit length code — only populated when T=2 (Adult Numeric / waist). All other size types use LL=00."
        >
          <div className="space-y-2">
            <Label>First L — Length type digit</Label>
            <KeyTable
              cols={["L1", "Type", "Description"]}
              rows={Object.entries(LENGTH_TYPES).map(([l, v]) => [l, v.label, v.description])}
            />
          </div>

          {Object.entries(LENGTH_TYPES).filter(([l]) => l !== '0').map(([l, type]) => (
            <div key={l} className="space-y-2">
              <Label>L1={l} — {type.label} (LL codes)</Label>
              <KeyTable
                cols={["LL", "Length"]}
                rows={Object.entries(type.codes).map(([ll, label]) => [ll, label])}
              />
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            LL=00 = no length (default for all non-waist sizes). Length codes are only valid for T=2 (Adult Numeric / waist).
          </p>
        </Section>

        {/* ── Color codes ──────────────────────────────────────────────────── */}
        <Section
          title="QRG Color Codes (CC)"
          subtitle='Two-digit color code — last 2 digits of TSSLLCC. Aliases (e.g. "Gray" / "Grey") share the same code.'
        >
          <KeyTable cols={["Code", "Canonical color"]} rows={COLOR_ROWS} />
          <p className="text-xs text-muted-foreground">00 = unknown. Codes 54–98 reserved for future colors.</p>
        </Section>

        {/* ── GRF ──────────────────────────────────────────────────────────── */}
        <Section
          title="GRF — Graphic Reference Format"
          subtitle="Five-digit code identifying every image, video, and document asset."
        >
          <FormatBar
            label="ID format"
            parts={[
              { seg: "GRF", desc: "Prefix", mono: true },
              { seg: "D1", desc: "Asset class", mono: true },
              { seg: "D2", desc: "Media type", mono: true },
              { seg: "D3", desc: "Channel", mono: true },
              { seg: "D4", desc: "Purpose", mono: true },
              { seg: "D5", desc: "Format", mono: true },
              { seg: "NNNNNN", desc: "Sequence", mono: true },
            ]}
          />

          <div className="space-y-1">
            <Label>Examples</Label>
            <div className="flex flex-wrap gap-2">
              <CodePill>GRF-21111-000001</CodePill>
              <CodePill>GRF-11421-000001</CodePill>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              First: output · image · print · qr_composite · PNG<br />
              Second: input · image · assets · cropped · PNG
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>D1 — Asset class</Label>
              <KeyTable
                cols={["D1", "Label", "Meaning"]}
                rows={Object.entries(GRF_ASSET_CLASSES).map(([k, v]) => [k, v.label, v.description])}
              />
            </div>
            <div className="space-y-2">
              <Label>D2 — Media type</Label>
              <KeyTable
                cols={["D2", "Type"]}
                rows={Object.entries(GRF_MEDIA_TYPES).map(([k, v]) => [k, v])}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>D3 — Channel</Label>
            <KeyTable
              cols={["D3", "Label", "Meaning"]}
              rows={Object.entries(GRF_CHANNELS).map(([k, v]) => [k, v.label, v.description])}
            />
          </div>

          <div className="space-y-2">
            <Label>D4 — Purpose (varies by D3)</Label>
            <div className="space-y-3">
              {(Object.entries(GRF_PURPOSES_BY_CHANNEL) as [string, Record<string, { label: string; description: string }>][]).map(([channel, purposes]) => (
                <div key={channel} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    D3 = <span className="font-mono font-semibold">{channel}</span>{" "}
                    ({GRF_CHANNELS[channel as keyof typeof GRF_CHANNELS]?.label})
                  </p>
                  <KeyTable
                    cols={["D4", "Purpose", "Description"]}
                    rows={Object.entries(purposes).map(([k, v]) => [k, v.label, v.description])}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>D5 — Format (varies by D2)</Label>
            <div className="space-y-3">
              {(Object.entries(GRF_FORMATS) as [string, Record<string, { label: string; mime: string }>][]).map(([mediaType, formats]) => (
                <div key={mediaType} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    D2 = <span className="font-mono font-semibold">{mediaType}</span>{" "}
                    ({GRF_MEDIA_TYPES[mediaType as keyof typeof GRF_MEDIA_TYPES]})
                  </p>
                  <KeyTable
                    cols={["D5", "Format", "MIME"]}
                    rows={Object.entries(formats).map(([k, v]) => [k, v.label, v.mime])}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Storage path</Label>
            <CodePill>grf/{"<GRF-ID>"}{"/<filename>.<ext>"}</CodePill>
            <p className="text-xs text-muted-foreground">
              e.g. <code className="font-mono">grf/GRF-21211-000001/glamor.png</code>
            </p>
          </div>
        </Section>

        {/* ── ASM ──────────────────────────────────────────────────────────── */}
        <Section
          title="ASM — Assembly IDs"
          subtitle="Sequential IDs that tie graphic and text slots into one complete product assembly."
        >
          <FormatBar
            label="ID format"
            parts={[
              { seg: "ASM", desc: "Prefix", mono: true },
              { seg: "NNNNNN", desc: "Global sequence", mono: true },
            ]}
          />

          <div className="space-y-1">
            <Label>Example</Label>
            <CodePill>ASM-000001</CodePill>
            <p className="text-xs text-muted-foreground mt-1">
              Counter: <code className="font-mono">asm_counters/global {"{ count: N }"}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Slot types</Label>
            <KeyTable
              cols={["Type", "Carries", "Required fields"]}
              rows={[
                ["txt", "Plain text", "value"],
                ["img", "Image asset (GRF)", "grfId"],
                ["qrc", "QR code graphic (GRF)", "grfId"],
                ["act", "Action / URL", "value"],
                ["vid", "Video asset", "grfId or value"],
                ["doc", "Document asset", "grfId or value"],
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Each slot has a 2-digit <code className="font-mono">seq</code> ("01"–"99"). Unique per assembly.
            </p>
          </div>
        </Section>

        {/* ── VVS ──────────────────────────────────────────────────────────── */}
        <Section
          title="VVS — Viewer / View / Shape / Skin"
          subtitle="Three-digit UI architecture code. All repeating admin data surfaces must follow VVS."
        >
          <FormatBar
            label="Three-digit code"
            parts={[
              { seg: "[Viewer]", desc: "Pane structure", mono: true },
              { seg: "[View]", desc: "Scroll / layout", mono: true },
              { seg: "[Shape]", desc: "Popup layer", mono: true },
            ]}
          />

          <div className="space-y-1">
            <Label>Example</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <CodePill>1·1·1</CodePill>
              <span className="text-xs text-muted-foreground">= Single pane · vertical scroll · popup modal</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Viewer — digit 1</Label>
              <KeyTable
                cols={["Code", "Component"]}
                rows={[
                  ["1", "SinglePaneViewer"],
                  ["2", "TwoPaneViewer"],
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>View — digit 2</Label>
              <KeyTable
                cols={["Code", "Component"]}
                rows={[
                  ["0", "SingleView"],
                  ["1", "ScrollGridView"],
                  ["2", "ScrollHorizontalView"],
                  ["3", "— (reserved)"],
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Shape — digit 3</Label>
              <KeyTable
                cols={["Code", "Container"]}
                rows={[
                  ["0", "— (flat, no popup)"],
                  ["1", "ModalView"],
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Real examples</Label>
            <KeyTable
              cols={["Code", "Surface", "Shape"]}
              rows={[
                ["1·1·1", "Source Images tab", "ModalView + SourceDetailShape"],
                ["1·1·0", "Backgrounds tab", "Flat — none"],
                ["2·1·0", "Product builder", "Flat — none"],
                ["1·2·1", "Graphics tab", "AdminGraphicShape"],
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>SkinItem contract</Label>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="bg-muted rounded-md p-3 sm:p-4 font-mono text-xs leading-relaxed min-w-[340px]">
                <pre>{`interface SkinItem {
  id:            string;
  name:          string;
  primaryImage?: string | null;
  dimensions?:   string | null;
  metadata?: {
    raw?:              unknown;
    grfId?:            string;
    mimeType?:         string;
    originalFilename?: string;
    channel?:          string;
    purpose?:          string;
    sourceGrfId?:      string;
    [key: string]:     unknown;
  };
}`}</pre>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <code className="font-mono">metadata.raw</code> holds the full original object. Only Skins and Shapes read it — Viewer and View never touch it.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Naming conventions</Label>
            <KeyTable
              cols={["Layer", "Pattern", "Example"]}
              rows={[
                ["Viewer", "[Name]Viewer.tsx", "SkinHorizontalViewer.tsx"],
                ["View", "Scroll*View.tsx", "ScrollGridView.tsx"],
                ["Shape", "[Type]Shape.tsx in shapes/", "AdminGraphicShape.tsx"],
                ["Skin", "[Type]Skin.tsx in skins/", "AdminGraphicCardSkin.tsx"],
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Violations to avoid</Label>
            <KeyTable
              cols={["Violation", "Rule"]}
              rows={[
                ["Skin", "Never render raw cards — always use a Skin component"],
                ["Shape", "Never put popup content inside a Skin file"],
                ["Style", "No hover-elevate on elements with overflow-hidden"],
                ["Style", "No hover:bg-* on Buttons or Badges"],
                ["Style", "No h-* set manually on a Button"],
                ["Contract", "Never pass raw API objects into a View — map to SkinItem"],
              ]}
            />
          </div>
        </Section>

        {/* ── Blank key formats ─────────────────────────────────────────────── */}
        <Section
          title="Blank Key Formats"
          subtitle="Only qrg_STNNN is canonical — provider keys are lookup/reference only, never persisted."
        >
          <KeyTable
            cols={["Format", "Example", "When used"]}
            rows={[
              ["qrg_STNNN", "qrg_11101", "Canonical Firestore doc ID — always persist this"],
              ["py_NNN", "py_12345", "Printify ref key — lookup only"],
              ["pf:NNN", "pf:67890", "Printful ref key — lookup only"],
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Use <code className="font-mono">resolveCatalogBlankId()</code> server-side to convert any provider key → <code className="font-mono">qrg_STNNN</code> before any catalog write.
          </p>
        </Section>

      </div>
    </AdminShell>
  );
}
