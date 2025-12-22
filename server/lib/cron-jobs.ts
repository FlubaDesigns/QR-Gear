import { storage } from '../storage';
import { sendHostingExpirationReminder } from './email';
import { syncPrintifyOrderStatuses } from './printify-orders';
import { printify } from './printify';

const REMINDER_INTERVALS = [30, 7, 0];

// Sync product catalog from Printify in background
export async function syncPrintifyCatalog(): Promise<void> {
  console.log('[Cron] Starting Printify catalog sync...');
  
  try {
    if (!printify.isConfigured) {
      console.log('[Cron] Printify not configured, skipping sync');
      return;
    }

    // Get all local products that have Printify IDs
    const localProducts = await storage.getAllProducts();
    const printifyProducts = localProducts.filter(p => p.printifyId);
    
    console.log(`[Cron] Syncing ${printifyProducts.length} products with Printify...`);
    
    for (const product of printifyProducts) {
      try {
        // Get fresh data from Printify
        const blueprintId = parseInt(product.printifyId!);
        if (isNaN(blueprintId)) continue;
        
        const blueprint = await printify.getBlueprintDetails(blueprintId);
        if (!blueprint) continue;
        
        // Update local product with latest Printify data
        const syncedAt = new Date().toISOString();
        await storage.updateProduct(product.id, {
          metadata: {
            ...(typeof product.metadata === 'object' ? product.metadata : {}),
            syncedAt,
            blueprintId,
          }
        });
        
        console.log(`[Cron] Synced product: ${product.name}`);
      } catch (err: any) {
        console.error(`[Cron] Failed to sync product ${product.id}:`, err.message);
      }
    }
    
    console.log('[Cron] Printify catalog sync complete');
  } catch (error) {
    console.error('[Cron] Error syncing Printify catalog:', error);
  }
}

export async function checkHostingExpirations(): Promise<void> {
  console.log('[Cron] Checking hosting expirations...');
  
  try {
    const hostedImages = await storage.getAllHostedImages();
    const now = new Date();

    for (const image of hostedImages) {
      if (!image.expiresAt) continue;

      const expiresAt = new Date(image.expiresAt);
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        console.log(`[Cron] Image ${image.id} has expired, marking as inactive`);
        await storage.updateHostedImage(image.id, { isActive: false });
        continue;
      }

      if (REMINDER_INTERVALS.includes(daysRemaining)) {
        const existingReminder = await storage.getHostingReminderByImageAndDays(image.id, daysRemaining);
        if (existingReminder) continue;

        const user = image.userId ? await storage.getUser(image.userId) : null;
        if (user?.email) {
          console.log(`[Cron] Sending ${daysRemaining}-day reminder for image ${image.id}`);
          
          const baseUrl = process.env.REPLIT_DOMAIN 
            ? `https://${process.env.REPLIT_DOMAIN}`
            : 'http://localhost:5000';
          
          const sent = await sendHostingExpirationReminder({
            customerEmail: user.email,
            customerName: user.firstName || 'Customer',
            imageId: image.id,
            imageTitle: image.originalName || 'Your QR Image',
            expirationDate: expiresAt,
            daysRemaining,
            renewalUrl: `${baseUrl}/account?renew=${image.id}`,
          });

          if (sent) {
            await storage.createHostingReminder({
              customGiftId: image.id,
              reminderType: `${daysRemaining}_day`,
              scheduledFor: new Date(),
            });
          }
        }
      }
    }
    
    console.log('[Cron] Hosting expiration check complete');
  } catch (error) {
    console.error('[Cron] Error checking hosting expirations:', error);
  }
}

export async function runAllCronJobs(): Promise<void> {
  console.log('[Cron] Running scheduled jobs...');
  
  await Promise.allSettled([
    checkHostingExpirations(),
    syncPrintifyOrderStatuses(),
    syncPrintifyCatalog(),
  ]);
  
  console.log('[Cron] All scheduled jobs completed');
}

let cronInterval: NodeJS.Timeout | null = null;

export function startCronJobs(): void {
  if (cronInterval) {
    console.log('[Cron] Jobs already running');
    return;
  }

  runAllCronJobs();

  cronInterval = setInterval(runAllCronJobs, 60 * 60 * 1000);
  
  console.log('[Cron] Jobs scheduled to run every hour');
}

export function stopCronJobs(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[Cron] Jobs stopped');
  }
}
