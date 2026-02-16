import type { Transaction, Part } from '../types';

export interface PackingListItem {
  sku: string;
  description: string;
  quantity: number;
  fromProduct?: string; // Which product this part is from
}

/**
 * Generate a packing list from a transaction
 */
export function generatePackingList(
  transaction: Transaction,
  parts: Record<string, Part>
): PackingListItem[] {
  const partsMap = new Map<string, PackingListItem>();

  // Collect parts from products
  for (const product of transaction.products || []) {
    for (const part of product.parts || []) {
      const totalQty = part.quantityRequired * product.quantity;
      const existing = partsMap.get(part.partSku);
      
      if (existing) {
        existing.quantity += totalQty;
      } else {
        const partInfo = parts[part.partSku];
        partsMap.set(part.partSku, {
          sku: part.partSku,
          description: partInfo?.description || part.partSku,
          quantity: totalQty,
          fromProduct: product.productName,
        });
      }
    }
  }

  // Add individual parts
  for (const part of transaction.parts || []) {
    const existing = partsMap.get(part.partSku);
    
    if (existing) {
      existing.quantity += part.quantity;
    } else {
      const partInfo = parts[part.partSku];
      partsMap.set(part.partSku, {
        sku: part.partSku,
        description: partInfo?.description || part.partSku,
        quantity: part.quantity,
      });
    }
  }

  return Array.from(partsMap.values()).sort((a, b) => a.sku.localeCompare(b.sku));
}

/**
 * Format packing list as text for WhatsApp
 */
export function formatPackingListForWhatsApp(
  transaction: Transaction,
  packingList: PackingListItem[]
): string {
  const lines: string[] = [];
  
  // Header with date in bold
  const dateStr = new Date(transaction.date).toLocaleDateString('he-IL');
  lines.push(`*${dateStr}*`);
  
  // Location and customer
  if (transaction.location) {
    lines.push(`📍 ${transaction.location}`);
  }
  if (transaction.customer) {
    lines.push(`👤 ${transaction.customer}`);
  }
  lines.push('');

  // Products
  if (transaction.products && transaction.products.length > 0) {
    lines.push('*התקנה*');
    for (const product of transaction.products) {
      lines.push(`‏• ${product.productName} × ${product.quantity}`);
    }
    lines.push('');
  }

  // Parts to load - numbered list with RTL
  if (packingList.length > 0) {
    lines.push('*פריטים להעמסה:*');
    packingList.forEach((item, idx) => {
      lines.push(`‏${idx + 1}. ${item.sku} - ${item.description} × ${item.quantity}`);
    });
    lines.push('');
  }

  // Extra materials - unnumbered with RTL support
  if (transaction.materials && transaction.materials.trim()) {
    lines.push('*כלים וחומר:*');
    const materials = transaction.materials.split('\n').filter(m => m.trim());
    for (const material of materials) {
      lines.push(`‏• ${material.trim()}`);
    }
    lines.push('');
  }
  
  if (transaction.notes && transaction.notes.trim()) {
    lines.push('');
    lines.push('📝 *NOTES:*');
    lines.push(transaction.notes);
  }

  return lines.join('\n');
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * Open WhatsApp with pre-filled message
 */
export function openWhatsAppWithMessage(message: string, phoneNumber?: string): void {
  const encoded = encodeURIComponent(message);
  let url: string;
  
  if (phoneNumber) {
    // Send to specific number
    url = `https://wa.me/${phoneNumber}?text=${encoded}`;
  } else {
    // Open WhatsApp Web to choose recipient
    url = `https://web.whatsapp.com/send?text=${encoded}`;
  }
  
  window.open(url, '_blank');
}
