/** Legacy embeds are retired; Partner API integrations have their own contract. */
export default function Widget() {
  return (
    <div className="row py-6 space-y-3" role="status">
      <h1 className="text-lg font-semibold">Legacy widget retired</h1>
      <p>This embed is no longer supported. Ask the site owner to update it through QR Gear’s Partner integrations.</p>
      <a className="underline" href="/">Visit QR Gear</a>
    </div>
  );
}
