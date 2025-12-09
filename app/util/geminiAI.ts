import { GoogleGenAI, Type } from "@google/genai";
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
  subtotal: z.number().describe("Subtotal sebelum pajak"),
  tax: z.number().nullable().describe("Pajak jika ada, null jika tidak ada"),
  total: z.number().describe("Total harga keseluruhan"),
  currency: z
    .enum(["IDR", "USD", "CNY", "MYR", "GBP"])
    .describe(
      "Mata uang: IDR (Indonesia), USD (Amerika), CNY (China), MYR (Malaysia), GBP (Inggris)"
    ),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

// JSON Schema untuk Gemini API (format native)
const receiptJsonSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "Daftar item dalam receipt",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Nama barang atau makanan",
          },
          quantity: {
            type: Type.NUMBER,
            description: "Jumlah item",
          },
          price: {
            type: Type.NUMBER,
            description: "Harga total untuk item ini (sesuai struk)",
          },
        },
        required: ["name", "quantity", "price"],
      },
    },
    subtotal: {
      type: Type.NUMBER,
      description: "Subtotal sebelum pajak",
    },
    tax: {
      type: Type.NUMBER,
      description: "Pajak jika ada, null jika tidak ada",
      nullable: true,
    },
    total: {
      type: Type.NUMBER,
      description: "Total harga keseluruhan",
    },
    currency: {
      type: Type.STRING,
      description:
        "Mata uang: IDR (Indonesia), USD (Amerika), CNY (China), MYR (Malaysia), GBP (Inggris)",
      enum: ["IDR", "USD", "CNY", "MYR", "GBP"],
    },
  },
  required: ["items", "subtotal", "tax", "total", "currency"],
};

/**
 * Parse OCR text from receipt using Gemini AI structured outputs
 */
export async function parseReceiptWithAI(ocrText: string): Promise<Receipt> {
  const ai = new GoogleGenAI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  });

  // Trim and normalize OCR input to limit context size and speed up inference.
  const cleanedOcr = String(ocrText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000);

  const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.5-flash";

  const systemPrompt = `Kamu adalah asisten yang ahli dalam membaca dan mengekstrak data dari struk/receipt.
Tugas kamu adalah mengekstrak informasi dari teks OCR struk belanja.
Ekstrak data berikut:
- Daftar item: nama barang, quantity, harga total item (sesuai yang tertera di struk)
- Subtotal keseluruhan (sebelum pajak)
- Pajak/tax (jika ada, null jika tidak ada)
- Total harga keseluruhan
- Mata uang yang digunakan

Jika ada data yang tidak jelas atau tidak terbaca, buat estimasi terbaik berdasarkan konteks.
Jika quantity tidak tercantum, asumsikan quantity = 1.
Pastikan semua angka dalam format number (bukan string).`;

  const userPrompt = `Berikut adalah teks OCR dari struk:\n\n${cleanedOcr}\n\nEkstrak data dari struk ini.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: receiptJsonSchema,
      temperature: 0.0,
      topP: 0.95,
      maxOutputTokens: 2000,
    },
  });

  let content: string | null = null;

  const respAny = response as any;
  if (typeof respAny.text === "function") {
    content = respAny.text();
  } else if (typeof respAny.text === "string") {
    content = respAny.text;
  } else if (respAny.candidates && respAny.candidates.length > 0) {
    const part = respAny.candidates[0].content?.parts?.[0];
    if (part && part.text) {
      content = part.text;
    }
  }

  if (!content) {
    throw new Error(
      "Failed to parse receipt data - no content returned from Gemini API"
    );
  }

  const parsed = JSON.parse(content) as Receipt;
  return parsed;
}
