import { printify, type CreateOrderRequest, type PrintifyOrderAddress, type PrintifyOrderLineItem } from './printify';
import { storage } from '../storage';
import { sendShippingUpdateEmail } from './email';

interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  zip: string;
  country: string;
}

export async function submitOrderToPrintify(
  orderId: string,
  shippingAddress: ShippingAddress
): Promise<{ success: boolean; printifyOrderId?: string; error?: string }> {
  try {
    if (!printify.isConfigured) {
      return { success: false, error: 'Printify API not configured' };
    }

    const order = await storage.getOrder(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.printifyOrderId) {
      return { success: true, printifyOrderId: order.printifyOrderId };
    }

    const orderItems = await storage.getOrderItems(orderId);
    if (!orderItems.length) {
      return { success: false, error: 'No order items found' };
    }

    const lineItems: PrintifyOrderLineItem[] = [];
    
    for (const item of orderItems) {
      const customization = item.customization as Record<string, any>;
      
      if (!customization?.printifyProductId || !customization?.printifyVariantId) {
        console.warn(`Order item ${item.id} missing Printify product/variant IDs`);
        continue;
      }

      lineItems.push({
        product_id: customization.printifyProductId,
        variant_id: customization.printifyVariantId,
        quantity: item.quantity,
        print_areas: customization.printAreas,
      });
    }

    if (!lineItems.length) {
      return { success: false, error: 'No valid line items for Printify' };
    }

    const addressTo: PrintifyOrderAddress = {
      first_name: shippingAddress.firstName,
      last_name: shippingAddress.lastName,
      email: shippingAddress.email,
      phone: shippingAddress.phone,
      country: shippingAddress.country,
      region: shippingAddress.region,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      zip: shippingAddress.zip,
    };

    const printifyOrderRequest: CreateOrderRequest = {
      external_id: orderId,
      label: `QR Gear Order ${orderId.slice(0, 8).toUpperCase()}`,
      line_items: lineItems,
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: addressTo,
    };

    const printifyOrder = await printify.createOrder(printifyOrderRequest);

    await storage.updateOrder(orderId, {
      printifyOrderId: printifyOrder.id,
      status: 'processing',
    });

    await printify.submitOrderToProduction(printifyOrder.id);

    await storage.updateOrder(orderId, {
      status: 'in_production',
    });

    console.log(`Order ${orderId} submitted to Printify: ${printifyOrder.id}`);
    return { success: true, printifyOrderId: printifyOrder.id };
  } catch (error: any) {
    console.error(`Failed to submit order ${orderId} to Printify:`, error);
    return { success: false, error: error.message };
  }
}

export async function checkPrintifyOrderStatus(orderId: string): Promise<{
  status: string;
  trackingNumber?: string;
  carrier?: string;
}> {
  try {
    const order = await storage.getOrder(orderId);
    if (!order?.printifyOrderId) {
      return { status: 'not_submitted' };
    }

    const printifyOrder = await printify.getOrder(order.printifyOrderId);
    
    const status = printifyOrder.status?.toLowerCase() || 'unknown';
    const shipments = printifyOrder.shipments || [];
    
    if (shipments.length > 0) {
      const latestShipment = shipments[shipments.length - 1];
      return {
        status,
        trackingNumber: latestShipment.tracking_number,
        carrier: latestShipment.carrier,
      };
    }

    return { status };
  } catch (error: any) {
    console.error(`Failed to check Printify order status for ${orderId}:`, error);
    return { status: 'error' };
  }
}

export async function syncPrintifyOrderStatuses(): Promise<void> {
  try {
    const orders = await storage.getOrdersByStatus('in_production');
    
    for (const order of orders) {
      if (!order.printifyOrderId) continue;

      const { status, trackingNumber, carrier } = await checkPrintifyOrderStatus(order.id);

      if (status === 'shipped' && trackingNumber && order.status !== 'shipped') {
        await storage.updateOrder(order.id, { status: 'shipped' });

        const user = await storage.getUser(order.userId);
        if (user?.email) {
          sendShippingUpdateEmail(
            user.email,
            user.firstName || 'Customer',
            order.id,
            trackingNumber,
            carrier || 'Standard Shipping'
          ).catch(err => console.error('Failed to send shipping email:', err));
        }
      } else if (status === 'delivered' && order.status !== 'delivered') {
        await storage.updateOrder(order.id, { status: 'delivered' });
      }
    }
  } catch (error) {
    console.error('Failed to sync Printify order statuses:', error);
  }
}
