import AdminShell from "@/components/AdminShell";
import { BLD_CONTEXTS, BLD_LAYOUTS, BLD_LAYOUTS_BY_CONTEXT, BLD_VEHICLES, BLD_MAX_INSTANCES, BLD_MAX_SEQUENCE, formatBldId } from "@shared/bldCodes";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SIZE_TYPES, LENGTH_TYPES, COLOR_CODE_MAP, PARENT_CATEGORY_LABELS } from "@shared/qrgCodes";
import {
  GRF_ASSET_CLASSES,
  GRF_MEDIA_TYPES,
  GRF_CHANNELS,
  GRF_PURPOSES_BY_CHANNEL,
  GRF_FORMATS,
  GRF_CROP_MIME_TYPE,
  originalGrfParams,
  croppedGrfParams,
  backgroundGrfParams,
  buildGrfId,
} from "@shared/GRF_engine";

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

        <Section title="BLD — Build Structure" subtitle="Reusable layout, ordered slots, and styling. Product identity, assets, and text are bound through Assembly.">
          <FormatBar label="ID format" parts={[
            { seg: "BLD", desc: "Prefix", mono: true },
            { seg: "S / U", desc: "Context", mono: true },
            { seg: "Z / P / I / V / D", desc: "Layout mode", mono: true },
            { seg: `0–${BLD_MAX_INSTANCES}`, desc: "Instance count", mono: true },
            { seg: `001–${BLD_MAX_SEQUENCE}`, desc: "Build sequence", mono: true },
          ]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KeyTable cols={["Context", "Meaning", "Layouts"]} rows={Object.entries(BLD_CONTEXTS).map(([code, label]) => [code, label, BLD_LAYOUTS_BY_CONTEXT[code as keyof typeof BLD_CONTEXTS].map(layout => `${layout}: ${BLD_LAYOUTS[layout]}`).join(', ')])} />
            <KeyTable cols={["Vehicle", "Meaning"]} rows={Object.entries(BLD_VEHICLES).map(([code, label]) => [code, label])} />
          </div>
          <CodePill>{formatBldId('S', 'Z', 3, 1)}</CodePill>
          <p className="text-xs text-muted-foreground">Slots run in order from 01. Palette QR slots specify horizontal and vertical positions. Action slots are optional and may define a CTA link. Each definition stores one instances array.</p>
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
            <Label>Library asset strings — Source Images crop operation</Label>
            <p className="text-xs text-muted-foreground">
              Each distinct crop gets its own GRF record. The source and background are reused. The background retains the source format; new crops use {GRF_CROP_MIME_TYPE}. Identical crop retries reuse the existing crop.
            </p>
            <KeyTable
              cols={["Asset", "GRF string", "D4", "D5", "Note"]}
              rows={['image/png', 'image/jpeg'].flatMap(sourceMime => [
                { label: 'Source', params: originalGrfParams(sourceMime), note: 'Raw upload, filename preserved' },
                { label: 'Cropped', params: croppedGrfParams(GRF_CROP_MIME_TYPE), note: 'Distinct saved crop; transparency preserved' },
                { label: 'Background', params: backgroundGrfParams(sourceMime), note: 'References the original file; retains its format' },
              ].map(({ label, params, note }) => [
                `${label} (${GRF_FORMATS[params.mediaType][params.format].label})`,
                buildGrfId({ ...params, sequence: 1 }),
                `${params.purpose} = ${GRF_PURPOSES_BY_CHANNEL[params.channel][params.purpose].label}`,
                `${params.format} = ${GRF_FORMATS[params.mediaType][params.format].label}`,
                note,
              ]))}
            />
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

        {/* ── VVSS ─────────────────────────────────────────────────────────── */}
        <Section
          title="VVSS — Viewer / View / Skin / Shape"
          subtitle="Four-layer UI architecture for all repeating admin data surfaces. The four-digit code encodes Viewer · View · Skin · Shape."
        >
          <FormatBar
            label="Four-digit surface code"
            parts={[
              { seg: "[Viewer]", desc: "Pane structure", mono: true },
              { seg: "[View]", desc: "Scroll / layout", mono: true },
              { seg: "[Skin]", desc: "Card component", mono: true },
              { seg: "[Shape]", desc: "Popup layer", mono: true },
            ]}
          />

          <div className="space-y-1">
            <Label>Example</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <CodePill>1·1·1·1</CodePill>
              <span className="text-xs text-muted-foreground">= Single pane · grid scroll · CardSkin · popup modal</span>
            </div>
          </div>

          {/* Four-layer summary table */}
          <div className="space-y-2">
            <Label>The four layers</Label>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-md border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Viewer", "View", "Skin", "Shape"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap w-1/4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">The outer container — defines how many panes the surface has.</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">The layout inside the pane — how items scroll or arrange.</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">The card component rendered for each item inside the View.</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">The popup/modal that opens when a Skin is selected.</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 align-top font-mono text-xs text-foreground">1 = SinglePaneViewer<br/>2 = TwoPaneViewer</td>
                    <td className="py-2 px-3 align-top font-mono text-xs text-foreground">0 = SingleView<br/>1 = ScrollGridView<br/>2 = ScrollHorizontalView</td>
                    <td className="py-2 px-3 align-top font-mono text-xs text-foreground">[Type]CardSkin<br/><span className="text-muted-foreground not-italic font-sans">e.g. SourceCardSkin,<br/>GraphicCardSkin</span></td>
                    <td className="py-2 px-3 align-top font-mono text-xs text-foreground">0 = none (flat)<br/>1 = ModalView<br/><span className="text-muted-foreground not-italic font-sans">content = [Type]Shape</span></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">viewers/</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">views/</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">skins/</td>
                    <td className="py-2 px-3 align-top text-xs text-muted-foreground">shapes/</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  ["1", "VScrollView"],
                  ["2", "HScrollView"],
                  ["3", "SlideView"],
                  ["4", "TableView"],
                  ["5", "FocusView"],
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Skin — digit 3</Label>
              <KeyTable
                cols={["Code", "Pattern"]}
                rows={[
                  ["1", "[Type]CardSkin"],
                  ["2", "[Type]RowSkin"],
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Shape — digit 4</Label>
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
            <Label>Surface registry</Label>
            <p className="text-xs text-muted-foreground">Live record of every page/tab and its four VVSS components. Updated as each surface is built or audited.</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-md border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Surface", "Code", "Viewer", "View", "Skin", "Shape", "Notes"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    {
                      surface: "Library › Source Images",
                      code: "1·1·1·1",
                      viewer: "SinglePaneViewer",
                      view: "VScrollView",
                      skin: "SourceCardSkin",
                      shape: "SourceDetailShape",
                      note: "",
                    },
                    {
                      surface: "Library › Backgrounds",
                      code: "1·1·1·0",
                      viewer: "SinglePaneViewer",
                      view: "ScrollGridView",
                      skin: "BackgroundCardSkin",
                      shape: "None",
                      note: "Flat cards; shared crop editor and archive confirmation",
                    },
                    {
                      surface: "Library › Cropped Images",
                      code: "1·1·1·0",
                      viewer: "SinglePaneViewer",
                      view: "ScrollGridView",
                      skin: "CroppedCardSkin",
                      shape: "None",
                      note: "Full-image previews; shared archive confirmation",
                    },
                    {
                      surface: "Library › Templates",
                      code: "1·1·1·1",
                      viewer: "SinglePaneViewer",
                      view: "ScrollGridView",
                      skin: "TemplateCardSkin",
                      shape: "TemplateShape + TemplateDetailSkin",
                      note: "Shared template display, deletion, and Products loading",
                    },
                    {
                      surface: "Library › Images",
                      code: "1·1·1·1",
                      viewer: "SinglePaneViewer",
                      view: "ScrollGridView",
                      skin: "AdminImageCardSkin",
                      shape: "AdminImageShape",
                      note: "Shared image browser for website and product assets",
                    },
                  ].map((row) => (
                    <tr key={row.surface} className={row.note ? "bg-amber-500/5" : ""}>
                      <td className="py-2 px-3 text-xs font-medium text-foreground whitespace-nowrap">{row.surface}</td>
                      <td className="py-2 px-3 font-mono text-xs text-foreground whitespace-nowrap">{row.code}</td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.viewer}</td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.view}</td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.skin}</td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.shape}</td>
                      <td className="py-2 px-3 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Accordion type="single" collapsible className="border border-border rounded-md">
            <AccordionItem value="source-breakdown" className="border-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                Source Images — layer breakdown
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-2">
                <p className="text-xs text-muted-foreground">What sits at each VVSS digit for <code className="font-mono">Library › Source Images</code>.</p>
                <KeyTable
                  cols={["Digit", "Layer", "Code", "Component", "File", "Calls", "Responsibility"]}
                  rows={[
                    ["1", "Viewer", "1", "SinglePaneViewer",              "viewers/SinglePaneViewer.tsx",           "—",                                                              "Full-width structural wrapper — no scroll, no data"],
                    ["2", "View",   "1", "VScrollView (ScrollGridView)",  "views/ScrollGridView.tsx",               "ui/scroll-area · lucide-react",                                  "Vertical scroll grid — lays out Skin cards, handles loading/empty"],
                    ["3", "Skin",   "1", "SourceCardSkin",                "skins/SourceImageSkin.tsx",                   "ui/card · ui/button · ui/badge · lucide-react · skins/types.ts · shapes/ModalView · shapes/SourceShape", "Card tile + owns popup open/close state + renders Shape internally"],
                    ["4", "Shape",  "1", "SourceDetailShape + ModalView", "shapes/SourceShape.tsx + ModalView.tsx", "ui/button · ui/badge · lucide-react · skins/types.ts",           "Detail content (image, metadata, actions) — no chrome, no state"],
                  ]}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

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
                ["Viewer", "[Name]Viewer.tsx in viewers/", "SinglePaneViewer.tsx"],
                ["View", "[Name]View.tsx in views/", "VScrollView.tsx"],
                ["Skin", "[Type]CardSkin or [Type]RowSkin in skins/", "SourceCardSkin.tsx"],
                ["Shape", "[Type]Shape.tsx in shapes/", "SourceDetailShape.tsx"],
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

        <div id="qr-dynamics">
          <Section title="QR Dynamics — Individual Item Experiences" subtitle="One physical copy, one permanent QRG identity, one stable QR URL.">
            <p className="text-sm text-muted-foreground">A design can be reused. Each purchased shirt, cup or hat gets its own server-allocated O-context number. Members use the shared engine with access limited to their own items and published content.</p>
            <KeyTable cols={["Reference", "Rule"]} rows={[
              ["QRG", "Allocated atomically by the existing server counter. I identifies the catalog source; M identifies the member build; every purchased copy gets a distinct O identity."],
              ["QR URL", "/qr/d/{instanceId} uses an opaque ID. The QRG number is never placed in the URL."],
              ["qr_dynamics_instances", "Binds ownerId, qrgBaseCode, packetId, orderId, orderItemId and unitIndex. Repeated fulfillment attempts reuse the saved item IDs."],
              ["Content", "Slots reference published productPackets. Canvas/Play supply content; Compose selects a sequence. Basic/Plus preserve their direct QR payloads."],
              ["Playback", "Automatic rotation uses the shared epoch resolver. Scan to reveal advances once per browser visit using browser storage."],
              ["Ownership", "Authenticated owners may edit their own sequence. Purchased content is retained as an explicit entitlement. Other members’ uploads and Admin inputs are unavailable."],
              ["Print output", "Quantity N produces N individual files and provider lines. Each hosted QR is decoded before and after replacement. Required inside labels remain included."],
              ["Assembly", "Reuse the existing BLD structure; register new QR/composite GRFs; bind the resulting files through Assembly. No second identity or layout system."],
              ["Claim", "A guest claim attaches the account to the existing purchased item, preserving its number and printed QR URL."],
              ["Hosting", "Use the saved 1-, 3- or 5-year term. Expired hosting returns an explicit unavailable response."],
            ]} />
            <p className="text-sm text-muted-foreground">October 10 audit: all 22 USA 250 catalog sources have distinct QRG identities and valid Packet → Assembly → BLD/GRF links. All 22 original QR payloads and 22 individually regenerated copies decoded successfully. This is an artwork and record audit; a paid provider order was not placed during verification.</p>
          </Section>
        </div>

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
