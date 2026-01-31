import { storage } from '../storage';
import { sendHostingExpirationReminder } from './email';
import { syncPrintifyOrderStatuses } from './printify-orders';
import { printify } from './printify';
import { startCostSync, getCostSyncStatus } from './printify-cost-sync';
import { 
  getExpiringInstances, 
  markReminderSent, 
  checkAndUpdateExpiredInstances,
  type BuyerInstance 
} from './buyerInstanceService';

const REMINDER_INTERVALS = [30, 7, 0];
const INSTANCE_REMINDER_DAYS = [30, 7, 1];

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

export async function checkBuyerInstanceExpirations(): Promise<void> {
  console.log('[Cron] Checking buyer instance expirations...');
  
  try {
    // First, mark any expired instances
    const expiredCount = await checkAndUpdateExpiredInstances();
    if (expiredCount > 0) {
      console.log(`[Cron] Marked ${expiredCount} buyer instances as expired`);
    }
    
    // Send reminders for instances expiring soon
    for (const days of INSTANCE_REMINDER_DAYS) {
      const expiringInstances = await getExpiringInstances(days);
      
      for (const instance of expiringInstances) {
        const reminderKey = `${days}day`;
        
        // Check if reminder already sent
        if (instance.remindersSent.some(r => r.startsWith(reminderKey))) {
          continue;
        }
        
        console.log(`[Cron] Sending ${days}-day reminder for instance ${instance.instanceId}`);
        
        try {
          // Send via Resend
          const { sendInstanceExpirationReminder } = await import('./email');
          const baseUrl = process.env.REPLIT_DOMAIN 
            ? `https://${process.env.REPLIT_DOMAIN}`
            : 'http://localhost:5000';
          
          await sendInstanceExpirationReminder({
            customerEmail: instance.buyerEmail,
            instanceId: instance.instanceId,
            daysRemaining: days,
            renewalUrl: `${baseUrl}/renew/${instance.instanceId}`,
            expirationDate: new Date(instance.hostingExpiresAt),
          });
          
          await markReminderSent(instance.instanceId, reminderKey);
        } catch (emailErr) {
          console.error(`[Cron] Failed to send reminder for ${instance.instanceId}:`, emailErr);
        }
      }
    }
    
    console.log('[Cron] Buyer instance expiration check complete');
  } catch (error) {
    console.error('[Cron] Error checking buyer instance expirations:', error);
  }
}

export async function runAllCronJobs(): Promise<void> {
  console.log('[Cron] Running scheduled jobs...');
  
  await Promise.allSettled([
    checkHostingExpirations(),
    checkBuyerInstanceExpirations(),
    syncPrintifyOrderStatuses(),
    syncPrintifyCatalog(),
  ]);
  
  console.log('[Cron] All scheduled jobs completed');
}

let cronInterval: NodeJS.Timeout | null = null;
let costSyncInterval: NodeJS.Timeout | null = null;

// Weekly cost sync - extracts real production costs from Printify and stores in database
async function runWeeklyCostSync(): Promise<void> {
  console.log('[Cron] Starting weekly Printify cost sync...');
  
  try {
    const status = await getCostSyncStatus();
    if (status.isRunning) {
      console.log('[Cron] Cost sync already running, skipping');
      return;
    }
    
    await startCostSync({ forceRefresh: false });
    console.log('[Cron] Weekly cost sync started in background');
  } catch (error) {
    console.error('[Cron] Error starting weekly cost sync:', error);
  }
}

export async function startCronJobs(): Promise<void> {
  if (cronInterval) {
    console.log('[Cron] Jobs already running');
    return;
  }

  runAllCronJobs();

  // Hourly jobs (hosting checks, order sync, catalog sync)
  cronInterval = setInterval(runAllCronJobs, 60 * 60 * 1000);
  
  // Weekly cost sync (every 7 days) - runs in background to extract Printify production costs
  // and store them in our local database for pricing display
  costSyncInterval = setInterval(runWeeklyCostSync, 7 * 24 * 60 * 60 * 1000);
  
  console.log('[Cron] Jobs scheduled to run every hour');
  console.log('[Cron] Cost sync scheduled to run weekly');
  
  // Initial cost sync at startup if database has no costs
  // This seeds the database with production costs so pricing displays immediately
  setTimeout(async () => {
    try {
      const status = await getCostSyncStatus();
      if (!status.isRunning) {
        console.log('[Cron] Checking if initial cost sync is needed...');
        // forceRefresh: false means it will skip providers that already have costs
        await startCostSync({ forceRefresh: false });
        console.log('[Cron] Initial cost sync started in background');
      }
    } catch (error) {
      console.error('[Cron] Error starting initial cost sync:', error);
    }
  }, 5000); // Wait 5 seconds for server to fully initialize
}

export function stopCronJobs(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[Cron] Jobs stopped');
  }
}
