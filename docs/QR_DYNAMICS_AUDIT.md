# QR Dynamics — 22-product audit

October 10, 2026. Read-only Main inventory plus downloaded print-PNG verification. These are the owner's existing approved products, not an older replacement set.

All 22 have distinct canonical I-context QRG identities, valid production packet / Assembly / BLD / GRF links, and registered QR payload hashes. Each original PNG decoded to its recorded destination. A separate local copy of each was regenerated with an offline verification URL and independently decoded with zxing-cpp (in addition to the production renderer's jsQR check). Offline copies were not uploaded or sent to Printful.

| Product | QRG identity | Packet | Original QR | Individual-copy QR |
|---|---|---|---|---|
| US Army - USA 250 | `QRG-11111-I-000008` | `AQWKcQlvm5XrIHl1j1BD` | Pass | Pass |
| US Navy - USA 250 | `QRG-11111-I-000009` | `CnUntRXjvnr2xSWFsSts` | Pass | Pass |
| US Air Force - USA 250 | `QRG-11111-I-000010` | `3YkqfShlzmna1gMwf3cH` | Pass | Pass |
| US Marine Corps - USA 250 | `QRG-11111-I-000011` | `MuMdv7SzuJFWpM7DLSDQ` | Pass | Pass |
| US Coast Guard - USA 250 | `QRG-11111-I-000012` | `19ZYD1I3pu2oDAXbUOdU` | Pass | Pass |
| US Space Force - USA 250 | `QRG-11111-I-000013` | `lrrPo4KJ6Stkzjr982SQ` | Pass | Pass |
| US National Guard - USA 250 | `QRG-11111-I-000014` | `yeceqGBj4zikVI52ncXS` | Pass | Pass |
| George Washington — Liberty Takes Root — USA 250 | `QRG-11111-I-000017` | `XiZbe9GSBT5o44k5g6CP` | Pass | Pass |
| Thomas Jefferson — Honesty & Wisdom — USA 250 | `QRG-11111-I-000018` | `DxsI59H60VghkuDk1Z65` | Pass | Pass |
| Benjamin Franklin — Essential Liberty — USA 250 | `QRG-11111-I-000019` | `jUXXrbtrdiop6JLYmCMt` | Pass | Pass |
| Statue of Liberty — 1886 — USA 250 | `QRG-11111-I-000020` | `9ukAW8XwjJSdagNEgIe3` | Pass | Pass |
| Lincoln Memorial — 1922 Dedication — USA 250 | `QRG-11111-I-000021` | `WOyay5yAdyKa70wTalMt` | Pass | Pass |
| Mount Rushmore — 1941 — USA 250 | `QRG-11111-I-000022` | `ZF3HQOpuijISwOXiSQjS` | Pass | Pass |
| John Adams — Liberty Once Lost — USA 250 | `QRG-11111-I-000023` | `c2M3ORI2RBCG7ZpW3wxO` | Pass | Pass |
| James Madison — Knowledge & Liberty — USA 250 | `QRG-11111-I-000024` | `e3QpRtb908lXInUqnipT` | Pass | Pass |
| Alexander Hamilton — Liberty & Heroism — USA 250 | `QRG-11111-I-000025` | `3IiI7TWSpZBoKgXPfChm` | Pass | Pass |
| Washington Monument — 1884 — USA 250 | `QRG-11111-I-000026` | `4xGiPYpmkoOeaEHaeiBj` | Pass | Pass |
| Patrick Henry — Liberty or Death — USA 250 | `QRG-11111-I-000027` | `xwxlW8Gkm4RHQ828qxS0` | Pass | Pass |
| Gateway Arch — 1965 — USA 250 | `QRG-11111-I-000028` | `81CJZKG6TMX9yUGcbZTO` | Pass | Pass |
| Thomas Paine — Glorious Triumph — USA 250 | `QRG-11111-I-000029` | `QpG2Xyrb8EwXxGJcpONx` | Pass | Pass |
| Samuel Adams — The Right to Freedom — USA 250 | `QRG-11111-I-000030` | `pG2EtCZJcqJvOo0XYkIP` | Pass | Pass |
| John Hancock — Defiance of Tyranny — USA 250 | `QRG-11111-I-000031` | `P9a3FajuCeNtyG6CayTH` | Pass | Pass |

The saved PNGs use different QR locations and dimensions. Individual-copy rendering measures each actual QR and confirms the recorded payload; it does not infer pixels from current default placement scale.

The original 22 source records/graphics are retained. Their I identities identify catalog sources. Each new physical purchase receives a distinct O identity, production packet, resolver and registered print files. Quantity is expanded to individual provider lines and a durable unit index prevents retries from allocating another active identity for the same unit.

Not performed: paid checkout, charged Printful submission, physical printing or delivery. Existing printed goods cannot be assigned different QR payloads without reprinting. This audit makes no claim that those operations were exercised.

Publication compatibility: all 22 approved Admin packets have no packet-level status field. Public landing access therefore verifies their bound, active and visible canonical catalog instance. Member/owner packets require their explicit published status. Draft packets do not inherit public access.
