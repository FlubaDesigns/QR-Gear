# QR Gear — Methodology

## Store / Channel / Collection Hierarchy

The entire platform uses a three-tier data architecture: **Store → Channel → Collection**. The same structure applies everywhere, but who fills each slot changes depending on the context.

### Platform Store (QR Gear)

| Tier       | Value          | Example                          |
|------------|----------------|----------------------------------|
| Store      | QR Gear        | The brand / platform itself      |
| Channel    | USA 250        | A themed channel within QR Gear  |
| Collection | (user-defined) | Dynamics or Compose products     |

### External Brand (e.g. Kingdom Connects)

| Tier       | Value              | Example                              |
|------------|--------------------|--------------------------------------|
| Store      | Kingdom Connects   | The external brand                   |
| Channel    | User ID / Page ID  | Whoever owns the page or account     |
| Collection | (user-defined)     | Dynamics or Compose products         |

### Member

| Tier       | Value                    | Example                              |
|------------|--------------------------|--------------------------------------|
| Store      | Member ID                | The member themselves                |
| Channel    | (member-named)           | "My Favorite 25 Shirts" or similar   |
| Collection | (member-curated)         | Their curated Dynamics/Compose items |

### Key Rules

- The hierarchy is always Store → Channel → Collection, no exceptions.
- Collections are what can be turned into Dynamics or Compose products.
- The backend routing (`/shop/:storeType/:storeName`) maps to this hierarchy.
- Frontend labels (e.g. "Featured Stores", "Featured Channels") are marketing copy and can vary — the data model underneath always follows this three-tier pattern.
