import usaFlagImage from "@assets/generated_images/USA_flag_badge_icon_fc33cf6d.png";

interface UsaFlagProps {
  className?: string;
}

export default function UsaFlag({ className = "w-6 h-4" }: UsaFlagProps) {
  return (
    <img
      src={usaFlagImage}
      alt="Made in USA"
      className={className}
      title="Made in America"
    />
  );
}
