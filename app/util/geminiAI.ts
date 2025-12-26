import { z } from "zod";

// Schema untuk item di receipt
const ReceiptItemSchema = z.object({
  name: z.string().describe("Nama barang atau makanan"),
  quantity: z.number().describe("Jumlah item"),
  price: z.number().describe("Harga total untuk item ini (sesuai struk)"),
});

// Schema untuk keseluruhan receipt
const ReceiptSchema = z.object({
  items: z.array(ReceiptItemSchema).describe("Daftar item dalam receipt"),
  subtotal: z.number().describe("Subtotal sebelum pajak dan diskon"),
  discount: z
    .number()
    .nullable()
    .optional()
    .describe("Diskon jika ada, null atau 0 jika tidak ada"),
  tax: z.number().nullable().describe("Pajak jika ada, null jika tidak ada"),
  total: z
    .number()
    .describe("Total harga keseluruhan setelah diskon dan pajak"),
  currency: z
    .enum(["IDR", "USD", "CNY", "MYR", "GBP"])
    .describe(
      "Mata uang: IDR (Indonesia), USD (Amerika), CNY (China), MYR (Malaysia), GBP (Inggris)"
    ),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

/**
 * Parse OCR text from receipt using server-side API route
 * This keeps API keys secure on the server
 */
export async function parseReceiptWithAI(ocrText: string): Promise<Receipt> {
  const response = await fetch("/api/parse-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ocrText }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Failed to parse receipt (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const parsed = await response.json();

  // Validate with Zod schema
  const result = ReceiptSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Validation error:", result.error);
    throw new Error("Invalid receipt data format from API");
  }

  return result.data;
}
