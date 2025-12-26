import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

// JSON Schema untuk Gemini API
const receiptJsonSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "Daftar item dalam receipt",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nama barang atau makanan" },
          quantity: { type: Type.NUMBER, description: "Jumlah item" },
          price: {
            type: Type.NUMBER,
            description: "Harga total untuk item ini",
          },
        },
        required: ["name", "quantity", "price"],
      },
    },
    subtotal: {
      type: Type.NUMBER,
      description: "Subtotal sebelum pajak dan diskon",
    },
    discount: {
      type: Type.NUMBER,
      description: "Diskon jika ada, 0 jika tidak ada",
      nullable: true,
    },
    tax: { type: Type.NUMBER, description: "Pajak jika ada", nullable: true },
    total: {
      type: Type.NUMBER,
      description: "Total harga keseluruhan setelah diskon dan pajak",
    },
    currency: {
      type: Type.STRING,
      description: "Mata uang",
      enum: ["IDR", "USD", "CNY", "MYR", "GBP"],
    },
  },
  required: ["items", "subtotal", "tax", "total", "currency"],
};

export async function POST(request: NextRequest) {
  try {
    const { ocrText } = await request.json();

    if (!ocrText || typeof ocrText !== "string") {
      return NextResponse.json(
        { error: "OCR text is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const cleanedOcr = String(ocrText)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16000);

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemPrompt = `Kamu adalah asisten yang ahli dalam membaca dan mengekstrak data dari struk/receipt.
Tugas kamu adalah mengekstrak informasi dari teks OCR struk belanja.
Ekstrak data berikut:
- Daftar item: nama barang, quantity, harga total item
- Subtotal keseluruhan (sebelum pajak dan diskon)
- Diskon (jika ada, 0 jika tidak ada)
- Pajak/tax (jika ada, null jika tidak ada)
- Total harga keseluruhan (setelah diskon dan pajak)
- Mata uang yang digunakan

Jika ada data yang tidak jelas, buat estimasi terbaik.
Jika quantity tidak tercantum, asumsikan quantity = 1.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nTeks OCR:\n${cleanedOcr}` }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptJsonSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Parse receipt error:", error);
    return NextResponse.json(
      { error: "Failed to parse receipt" },
      { status: 500 }
    );
  }
}
