import logoSvg from "@/assets/logo.svg";

export default function LogoPreview() {
  return (
    <div className="logo-preview-page">
      <img src={logoSvg} alt="QR Gear Logo" className="logo-preview-image" />
    </div>
  );
}