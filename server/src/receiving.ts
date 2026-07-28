import type { Part, Product, ReceivingLine, ReceivingLineStatus, ReceivingShipment } from './types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fsExtra from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const RECEIVING_FILE = path.join(DATA_DIR, 'receiving.json');

function generateReceivingId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureReceivingFile(): Promise<void> {
  await fsExtra.ensureDir(DATA_DIR);
  if (!(await fsExtra.pathExists(RECEIVING_FILE))) {
    await fs.writeFile(RECEIVING_FILE, '[]', 'utf-8');
  }
}

export async function loadReceivingShipments(): Promise<ReceivingShipment[]> {
  await ensureReceivingFile();
  const content = await fs.readFile(RECEIVING_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveReceivingShipments(shipments: ReceivingShipment[]): Promise<void> {
  await ensureReceivingFile();
  await fs.writeFile(RECEIVING_FILE, JSON.stringify(shipments, null, 2), 'utf-8');
}

export function buildReceivingLine(
  itemType: 'product' | 'part',
  item: Product | Part,
  orderedQty: number,
  notes?: string
): ReceivingLine {
  if (itemType === 'product') {
    const product = item as Product;
    return {
      id: generateReceivingId('LINE'),
      itemType,
      itemId: product.id,
      itemName: product.name,
      orderedQty,
      acceptedQty: 0,
      status: 'pending',
      notes: notes?.trim() || undefined,
    };
  }

  const part = item as Part;
  return {
    id: generateReceivingId('LINE'),
    itemType,
    itemId: part.sku,
    itemName: part.description,
    itemSku: part.sku,
    orderedQty,
    acceptedQty: 0,
    status: 'pending',
    notes: notes?.trim() || undefined,
  };
}

export async function createReceivingShipment(input: {
  supplier: string;
  expectedDate: string;
  notes?: string;
}): Promise<ReceivingShipment> {
  const shipments = await loadReceivingShipments();
  const shipment: ReceivingShipment = {
    id: generateReceivingId('RCV'),
    supplier: input.supplier,
    expectedDate: input.expectedDate,
    status: 'pending',
    notes: input.notes?.trim() || undefined,
    lines: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  shipments.unshift(shipment);
  await saveReceivingShipments(shipments);
  return shipment;
}

export async function addReceivingLine(input: {
  shipmentId: string;
  line: ReceivingLine;
}): Promise<ReceivingShipment | null> {
  const shipments = await loadReceivingShipments();
  const shipment = shipments.find((item) => item.id === input.shipmentId);
  if (!shipment) return null;
  shipment.lines.push(input.line);
  shipment.updatedAt = new Date().toISOString();
  await saveReceivingShipments(shipments);
  return shipment;
}

export async function updateReceivingLine(input: {
  shipmentId: string;
  lineId: string;
  orderedQty?: number;
  acceptedQty?: number;
  notes?: string;
  status?: ReceivingLineStatus;
}): Promise<ReceivingShipment | null> {
  const shipments = await loadReceivingShipments();
  const shipment = shipments.find((item) => item.id === input.shipmentId);
  if (!shipment) return null;
  const line = shipment.lines.find((item) => item.id === input.lineId);
  if (!line) return null;

  if (typeof input.orderedQty === 'number') {
    line.orderedQty = input.orderedQty;
  }
  if (typeof input.acceptedQty === 'number') {
    line.acceptedQty = input.acceptedQty;
  }
  if (typeof input.notes === 'string') {
    line.notes = input.notes.trim() || undefined;
  }
  if (input.status) {
    line.status = input.status;
  } else if (typeof input.acceptedQty === 'number') {
    line.status = input.acceptedQty >= line.orderedQty
      ? 'received'
      : input.acceptedQty > 0
        ? 'partial'
        : 'pending';
  }

  shipment.updatedAt = new Date().toISOString();
  await saveReceivingShipments(shipments);
  return shipment;
}
