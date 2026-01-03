# QR Gear - Library Update Schedule

This document tracks libraries and dependencies that require regular updates to maintain security, compatibility, and access to new features.

## Critical Updates (Check Monthly)

### Firebase SDKs
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| firebase-admin | functions/package.json | 12.1.0 | Monthly | Core Firebase Admin SDK |
| firebase-functions | functions/package.json | 4.x | Monthly | Cloud Functions runtime |
| firebase | package.json | 11.8.0 | Monthly | Client SDK |
| firebase-tools | package.json | CLI tool | Monthly | Deployment CLI |

### Payment Processing
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| stripe | package.json + functions | Latest | Monthly | Payment gateway - security critical |
| @stripe/stripe-js | package.json | Latest | Monthly | Client-side Stripe |
| @stripe/react-stripe-js | package.json | Latest | Monthly | React Stripe components |

## Important Updates (Check Quarterly)

### Database & ORM
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| drizzle-orm | package.json | Latest | Quarterly | PostgreSQL ORM |
| drizzle-kit | package.json | Latest | Quarterly | Migration tool |
| @neondatabase/serverless | package.json | Latest | Quarterly | Neon PostgreSQL driver |

### Frontend Framework
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| react | package.json | 18.x | Quarterly | Major framework |
| react-dom | package.json | 18.x | Quarterly | React DOM bindings |
| vite | package.json | 5.x | Quarterly | Build tool |
| @vitejs/plugin-react | package.json | Latest | Quarterly | Vite React plugin |
| typescript | package.json | 5.x | Quarterly | TypeScript compiler |

### UI Components
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| @radix-ui/* | package.json | Various | Quarterly | shadcn/ui primitives |
| tailwindcss | package.json | 4.x | Quarterly | CSS framework |
| lucide-react | package.json | Latest | Quarterly | Icons |

## Standard Updates (Check Every 6 Months)

### State Management & Data Fetching
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| @tanstack/react-query | package.json | 5.x | 6 months | Server state management |
| wouter | package.json | Latest | 6 months | Routing |

### Form & Validation
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| react-hook-form | package.json | Latest | 6 months | Form management |
| zod | package.json | Latest | 6 months | Schema validation |
| @hookform/resolvers | package.json | Latest | 6 months | Zod resolver |

### Utilities
| Package | Location | Current Version | Update Frequency | Notes |
|---------|----------|-----------------|------------------|-------|
| date-fns | package.json | Latest | 6 months | Date utilities |
| clsx | package.json | Latest | 6 months | Class names |
| tailwind-merge | package.json | Latest | 6 months | Tailwind class merging |

## External API Dependencies

### Printful API
- **Endpoint**: https://api.printful.com
- **Documentation**: https://developers.printful.com/docs
- **Check Frequency**: Monthly for deprecation notices
- **Notes**: Monitor for API version changes, rate limit updates, and new features

### Printify API
- **Endpoint**: https://api.printify.com/v1
- **Documentation**: https://developers.printify.com
- **Check Frequency**: Monthly for deprecation notices
- **Notes**: Blueprint IDs may change; monitor catalog updates

### Resend API
- **Endpoint**: https://api.resend.com
- **Documentation**: https://resend.com/docs
- **Check Frequency**: Quarterly
- **Notes**: Email delivery service

## Update Commands

### Check for outdated packages
```bash
npm outdated
```

### Update all packages (minor/patch)
```bash
npm update
```

### Update specific package
```bash
npm install package-name@latest
```

### Firebase Functions
```bash
cd functions && npm outdated
cd functions && npm update
```

## Security Considerations

1. **Always test after updates** - Run the full test suite after updating any package
2. **Check changelogs** - Review breaking changes before major version updates
3. **Firebase Functions** - Updates may require redeployment
4. **Stripe** - Payment-related updates should be tested in Stripe test mode first
5. **Keep backups** - Commit working state before major updates

## Last Updated
- Date: January 3, 2026
- Updated by: QR Gear Development
