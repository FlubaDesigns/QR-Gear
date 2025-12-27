/**
 * Script to refresh color hex values for all Printify providers
 * Run with: npx tsx scripts/refresh-color-hex.ts
 */

import { storage } from '../server/storage';
import { syncProductVariants, printify } from '../server/lib/printify';

async function main() {
  console.log('[Color Hex Refresh] Starting...');
  
  // Give database time to initialize
  await new Promise(r => setTimeout(r, 1000));
  
  if (!printify.isConfigured) {
    console.error('[Color Hex Refresh] Printify API not configured');
    process.exit(1);
  }
  
  // Get all providers that have colors
  const allProviders = await storage.getAllPrintifyProviders();
  console.log(`[Color Hex Refresh] Found ${allProviders.length} total providers`);
  
  // Filter to those needing hex values
  const providersNeedingHex = allProviders.filter(p => {
    if (!p.availableColors || !Array.isArray(p.availableColors)) return true; // Need colors
    // Check if any color is missing hex
    return (p.availableColors as any[]).some(c => !c.hex);
  });
  
  console.log(`[Color Hex Refresh] ${providersNeedingHex.length} providers need hex values`);
  
  let successCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < providersNeedingHex.length; i++) {
    const provider = providersNeedingHex[i];
    
    try {
      const catalogData = await syncProductVariants(provider.blueprintId, provider.providerId);
      
      await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.providerId, {
        availableColors: catalogData.colors,
        availableSizes: catalogData.sizes,
      });
      
      successCount++;
      console.log(`[${i + 1}/${providersNeedingHex.length}] Updated ${provider.blueprintId}/${provider.providerId} with ${catalogData.colors.length} colors`);
      
      // Rate limiting - 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      failedCount++;
      console.error(`[${i + 1}/${providersNeedingHex.length}] Failed ${provider.blueprintId}/${provider.providerId}: ${err.message}`);
    }
  }
  
  console.log(`\n[Color Hex Refresh] Complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
