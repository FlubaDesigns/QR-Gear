import corporateGathering from '@/assets/corporate-gathering.webp';
import smallBusiness from '@/assets/small-business.webp';
import weddingParty from '@/assets/wedding-party.webp';
import realEstate from '@/assets/real-estate.webp';
import guerrillaMarketing from '@/assets/guerrilla-marketing.webp';
import personalGifts from '@/assets/personal-gifts.webp';
import christmasGifts from '@/assets/christmas-gifts.webp';
import memorialMemories from '@/assets/memorial-memories.webp';
import familyReunion from '@/assets/family-reunion.webp';
import familyVideo from '@/assets/family-video.webp';
import creativeStudio from '@/assets/creative-studio.webp';
import liveMusic from '@/assets/live-music.webp';
import officeMug from '@/assets/office-mug.webp';
import everydayBelongings from '@/assets/everyday-belongings.webp';
import networking from '@/assets/networking.webp';
import medicalInformation from '@/assets/medical-information.webp';
import changingContent from '@/assets/changing-content.webp';
import qrHistory from '@/assets/qr-history.webp';
import privacySecurity from '@/assets/privacy-security.webp';

/** Editorial imagery only. Product imagery remains owned by the existing QRG/product pipeline. */
export const editorialImages = {
  "corporate-gathering": { src: corporateGathering, alt: "Coworkers in blue shirts sharing a relaxed conversation around an outdoor table." },
  "small-business": { src: smallBusiness, alt: "A cafe owner handing a cup of coffee to a customer across the counter." },
  "wedding-party": { src: weddingParty, alt: "A wedding party in coordinated pale blue outfits laughing together in a garden." },
  "real-estate": { src: realEstate, alt: "A real estate agent welcoming a couple into a bright home." },
  "guerrilla-marketing": { src: guerrillaMarketing, alt: "Two street-team ambassadors talking with visitors at a colorful outdoor pop-up." },
  "personal-gifts": { src: personalGifts, alt: "A woman giving a wrapped personal gift to an older man beside a family photograph." },
  "christmas-gifts": { src: christmasGifts, alt: "Family members watching an older woman open a gift beside a Christmas tree." },
  "memorial-memories": { src: memorialMemories, alt: "A framed portrait and family photograph beside white flowers and a glowing candle." },
  "family-reunion": { src: familyReunion, alt: "Several generations of a family sharing a meal at a sunny backyard picnic." },
  "family-video": { src: familyVideo, alt: "Two women from different generations smiling at a smartphone together on a sofa." },
  "creative-studio": { src: creativeStudio, alt: "An artist working on a colorful drawing at a studio desk beside sketchbooks and folded shirts." },
  "live-music": { src: liveMusic, alt: "Musicians performing together under warm and blue stage lights at an intimate live show." },
  "office-mug": { src: officeMug, alt: "A navy coffee mug beside a notebook, laptop and plant on a sunlit office desk." },
  "everyday-belongings": { src: everydayBelongings, alt: "A commuter organizing a backpack, keys and water bottle on a park bench." },
  "networking": { src: networking, alt: "Two professionals exchanging contact information on smartphones at a casual meetup." },
  "medical-information": { src: medicalInformation, alt: "A woman and a healthcare professional reviewing a personal information card at a clinic." },
  "changing-content": { src: changingContent, alt: "A business owner planning a campaign with a tablet, calendar and colorful notes." },
  "qr-history": { src: qrHistory, alt: "An older handheld barcode scanner beside a modern smartphone on a workbench." },
  "privacy-security": { src: privacySecurity, alt: "A face-down smartphone, closed navy notebook and brass key on a wooden desk." },
};

export const pageImages: Record<string, (typeof editorialImages)[keyof typeof editorialImages]> = {
  "/qr-basics": editorialImages["networking"],
  "/qr-plus": editorialImages["small-business"],
  "/qr-canvas": editorialImages["creative-studio"],
  "/qr-play": editorialImages["family-video"],
  "/qr-dynamics": editorialImages["changing-content"],
  "/corporate-get-togethers": editorialImages["corporate-gathering"],
  "/guerrilla-marketing": editorialImages["guerrilla-marketing"],
  "/unique-qr-gifts": editorialImages["personal-gifts"],
  "/one-of-a-kind-qr-gifts": editorialImages["personal-gifts"],
  "/christmas-qr-gifts": editorialImages["christmas-gifts"],
  "/qr-history": editorialImages["qr-history"],
  "/wedding-qr-shirts": editorialImages["wedding-party"],
  "/family-reunion-shirts": editorialImages["family-reunion"],
  "/artist-qr-apparel": editorialImages["creative-studio"],
  "/memorial-qr-gifts": editorialImages["memorial-memories"],
  "/musician-merch": editorialImages["live-music"],
  "/website-qr-shirts": editorialImages["networking"],
  "/office-qr-mug": editorialImages["office-mug"],
  "/lost-found-qr": editorialImages["everyday-belongings"],
  "/networking-qr-shirts": editorialImages["networking"],
  "/medical-alert-qr": editorialImages["medical-information"],
  "/personal-items-qr": editorialImages["everyday-belongings"],
  "/event-qr-shirts": editorialImages["corporate-gathering"],
  "/everyday-qr": editorialImages["everyday-belongings"],
  "/business-qr-plus": editorialImages["small-business"],
  "/memorial-video-shirts": editorialImages["memorial-memories"],
  "/family-video-messages": editorialImages["family-video"],
  "/video-time-capsule": editorialImages["family-video"],
  "/advent-qr-shirts": editorialImages["christmas-gifts"],
  "/band-dynamic-merch": editorialImages["live-music"],
  "/realtor-qr-shirts": editorialImages["real-estate"],
  "/business-analytics-qr": editorialImages["changing-content"],
  "/earn": editorialImages["creative-studio"],
  "/privacy": editorialImages["privacy-security"],
  "/terms": editorialImages["privacy-security"],
  "/login": editorialImages["privacy-security"],
  "/gifts": editorialImages["personal-gifts"],
};
