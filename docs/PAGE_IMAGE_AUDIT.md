# Page image and alt-text review

October 11, 2026. Route inventory: `PAGE_LAYOUT_AUDIT.md` (107 entries). Added editorial imagery to the 37 public routes below. Homepage remains unchanged; product, account, member, admin and builder routes retain their existing contextual product/artwork previews rather than unrelated stock scenes. Utility, redirect, scan/embed and error states retain their functional presentation.

## Public page images

| Route | Asset | Alt text |
|---|---|---|
| `/qr-basics` | `networking.webp` | Two professionals exchanging contact information on smartphones at a casual meetup. |
| `/qr-plus` | `small-business.webp` | A cafe owner handing a cup of coffee to a customer across the counter. |
| `/qr-canvas` | `creative-studio.webp` | An artist working on a colorful drawing at a studio desk beside sketchbooks and folded shirts. |
| `/qr-play` | `family-video.webp` | Two women from different generations smiling at a smartphone together on a sofa. |
| `/qr-dynamics` | `changing-content.webp` | A business owner planning a campaign with a tablet, calendar and colorful notes. |
| `/corporate-get-togethers` | `corporate-gathering.webp` | Coworkers in blue shirts sharing a relaxed conversation around an outdoor table. |
| `/guerrilla-marketing` | `guerrilla-marketing.webp` | Two street-team ambassadors talking with visitors at a colorful outdoor pop-up. |
| `/unique-qr-gifts` | `personal-gifts.webp` | A woman giving a wrapped personal gift to an older man beside a family photograph. |
| `/one-of-a-kind-qr-gifts` | `personal-gifts.webp` | A woman giving a wrapped personal gift to an older man beside a family photograph. |
| `/christmas-qr-gifts` | `christmas-gifts.webp` | Family members watching an older woman open a gift beside a Christmas tree. |
| `/qr-history` | `qr-history.webp` | An older handheld barcode scanner beside a modern smartphone on a workbench. |
| `/wedding-qr-shirts` | `wedding-party.webp` | A wedding party in coordinated pale blue outfits laughing together in a garden. |
| `/family-reunion-shirts` | `family-reunion.webp` | Several generations of a family sharing a meal at a sunny backyard picnic. |
| `/artist-qr-apparel` | `creative-studio.webp` | An artist working on a colorful drawing at a studio desk beside sketchbooks and folded shirts. |
| `/memorial-qr-gifts` | `memorial-memories.webp` | A framed portrait and family photograph beside white flowers and a glowing candle. |
| `/musician-merch` | `live-music.webp` | Musicians performing together under warm and blue stage lights at an intimate live show. |
| `/website-qr-shirts` | `networking.webp` | Two professionals exchanging contact information on smartphones at a casual meetup. |
| `/office-qr-mug` | `office-mug.webp` | A navy coffee mug beside a notebook, laptop and plant on a sunlit office desk. |
| `/lost-found-qr` | `everyday-belongings.webp` | A commuter organizing a backpack, keys and water bottle on a park bench. |
| `/networking-qr-shirts` | `networking.webp` | Two professionals exchanging contact information on smartphones at a casual meetup. |
| `/medical-alert-qr` | `medical-information.webp` | A woman and a healthcare professional reviewing a personal information card at a clinic. |
| `/personal-items-qr` | `everyday-belongings.webp` | A commuter organizing a backpack, keys and water bottle on a park bench. |
| `/event-qr-shirts` | `corporate-gathering.webp` | Coworkers in blue shirts sharing a relaxed conversation around an outdoor table. |
| `/everyday-qr` | `everyday-belongings.webp` | A commuter organizing a backpack, keys and water bottle on a park bench. |
| `/business-qr-plus` | `small-business.webp` | A cafe owner handing a cup of coffee to a customer across the counter. |
| `/memorial-video-shirts` | `memorial-memories.webp` | A framed portrait and family photograph beside white flowers and a glowing candle. |
| `/family-video-messages` | `family-video.webp` | Two women from different generations smiling at a smartphone together on a sofa. |
| `/video-time-capsule` | `family-video.webp` | Two women from different generations smiling at a smartphone together on a sofa. |
| `/advent-qr-shirts` | `christmas-gifts.webp` | Family members watching an older woman open a gift beside a Christmas tree. |
| `/band-dynamic-merch` | `live-music.webp` | Musicians performing together under warm and blue stage lights at an intimate live show. |
| `/realtor-qr-shirts` | `real-estate.webp` | A real estate agent welcoming a couple into a bright home. |
| `/business-analytics-qr` | `changing-content.webp` | A business owner planning a campaign with a tablet, calendar and colorful notes. |
| `/earn` | `creative-studio.webp` | An artist working on a colorful drawing at a studio desk beside sketchbooks and folded shirts. |
| `/privacy` | `privacy-security.webp` | A face-down smartphone, closed navy notebook and brass key on a wooden desk. |
| `/terms` | `privacy-security.webp` | A face-down smartphone, closed navy notebook and brass key on a wooden desk. |
| `/login` | `privacy-security.webp` | A face-down smartphone, closed navy notebook and brass key on a wooden desk. |
| `/gifts` | `personal-gifts.webp` | A woman giving a wrapped personal gift to an older man beside a family photograph. |

## Implementation and validation

- Central route/image/alt registry and shared PageIntro/PageImage components.
- All 19 images are 1536×1024 WebP; actual product mockups are unchanged.
- Existing JSX image audit: every image has an alt attribute; replaced empty and generic background labels in product/artwork previews. Dynamic labels use the existing product or item name.
- TypeScript, canonical layout verification and production build passed. Live image loading and alt values are checked after publishing.
- Master CSS, homepage and backend logic are unchanged.

## Generated asset provenance

Built-in image generation created the editorial scenes; Sharp converted the originals to WebP at quality 85. No logos, readable text or pretend scannable QR codes were requested. These scenes illustrate uses, not purchasable catalog items.

### small-business.webp

An independent cafe owner in a navy t-shirt welcoming a customer at a beautiful neighborhood coffee counter; a tablet seen from the back, ceramic cups, warm daylight. Small business hospitality, no readable signage.

### wedding-party.webp

A joyful diverse group of adult bridesmaids and groomsmen in coordinated soft blue casual shirts spending time together in a garden before a wedding. Flowers and a tasteful reception setting, candid relaxed laughter, no wedding-brand text.

### real-estate.webp

A professional woman real estate agent showing a bright modern home to an adult couple, standing at the open front door, subtle key in hand, friendly natural interaction, no signs or visible documents.

### guerrilla-marketing.webp

Two adult street-team brand ambassadors in navy and orange casual shirts chatting with passersby at a tasteful small urban outdoor pop-up table, an engaging colorful abstract display with no lettering, lively friendly street scene, no logos.

### personal-gifts.webp

An adult woman giving a beautifully wrapped small gift to an older man at a home dining table, a personal family photograph beside the gift, sincere delight, warm window light, no text.

### christmas-gifts.webp

A multigenerational family exchanging a personal Christmas gift beside a softly lit Christmas tree, an older woman unwrapping a keepsake while adult family members smile, deep green and warm gold holiday colors, natural candid moment, no lettering.

### memorial-memories.webp

A quiet respectful tabletop remembrance scene: a framed candid photograph of a smiling older adult, a second printed family photo, a simple white flower and softly lit candle, warm natural window light. Comforting and personal, not gloomy, no text.

### family-reunion.webp

A joyful multigenerational diverse extended family in casual coordinated blue and neutral t-shirts at a backyard picnic, talking and laughing together around a wooden table in warm afternoon light, natural candid photography, no text.

### family-video.webp

An adult woman and an older woman sitting together on a sofa smiling at a smartphone held in one hand, family photos softly blurred behind them, phone screen turned away from camera, a feeling of sharing a recorded family memory, natural daylight.

### creative-studio.webp

A female artist at a light-filled studio desk creating a colorful original drawing on a tablet beside sketchbooks, paint swatches, and neatly folded plain navy t-shirts. Hands and art visible, intimate candid editorial view, no text or brand logos.

### live-music.webp

A diverse small group of adult musicians performing an intimate live gig, woman guitarist and man singer in dark casual shirts with a drummer softly behind, expressive but natural, warm amber and cool blue stage lighting, no signage.

### office-mug.webp

A beautiful navy ceramic coffee mug on a tidy sunlit coworking desk beside an open notebook, laptop edge and a small plant, a person's hand reaching for the mug, editorial close-up, no text on the mug or visible computer screen.

### everyday-belongings.webp

A casual adult commuter on a park bench organizing a blue backpack, keys and a reusable water bottle before leaving, warm daylight, focus on the everyday belongings and natural hands, no visible personal information or logos.

### networking.webp

Two diverse adult professionals in relaxed smart casual clothing exchanging contact information on their smartphones during a friendly creative meetup, phones turned away from the camera, authentic conversation, softly blurred contemporary event space, no text.

### medical-information.webp

A calm adult woman and a friendly female healthcare professional reviewing a small personal information card together at a bright community clinic desk, card facing away and no text legible, reassuring natural expression, respectful non-emergency atmosphere.

### changing-content.webp

A small business owner planning a campaign at a bright desk with a tablet facing away, a simple unmarked wall calendar, colorful sticky notes without text and folded plain t-shirts, intentional candid editorial photography, natural light, no invented software UI.

### qr-history.webp

Editorial still-life illustrating the evolution of scanning technology: an older handheld industrial barcode scanner beside a modern smartphone on a clean workbench, subtle shipping boxes out of focus in background, attractive navy and warm light palette, no text or fake QR symbols.

### privacy-security.webp

A calm minimal editorial still-life of a smartphone with its dark screen face down beside a closed navy notebook and a small simple brass key on a clean wooden desk, soft window light, visual theme of privacy and responsible access, no text or logos.

### corporate-gathering.webp

Candid editorial scene of five diverse adult coworkers sharing conversation around an outdoor terrace table at golden hour, in solid navy and blue shirts; no logos, text or QR codes.
