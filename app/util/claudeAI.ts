import { z } from "zod";

// Schema untuk item di receipt (Zod untuk validasi)
const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
});

// Schema untuk keseluruhan receipt (Zod untuk validasi)
const ReceiptSchema = z.object({
  items: z.array(ReceiptItemSchema),
  subtotal: z.number(),
  tax: z.number().nullable(),
  total: z.number(),
  currency: z.enum(["IDR", "USD", "CNY", "MYR", "GBP"]),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

/**
 * Parse OCR text from receipt using Agent Router (OpenAI-compatible API)
 * @see https://docs.agentrouter.org/en/roocode.html
 */
export async function parseReceiptWithAI(ocrText: string): Promise<Receipt> {
  // Trim and normalize OCR input
  const cleanedOcr = String(ocrText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000);

  // Model - gpt-5 as per Agent Router docs
  const modelName =
    process.env.NEXT_PUBLIC_CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

  const systemPrompt = `Kamu adalah asisten yang ahli dalam membaca dan mengekstrak data dari struk/receipt.
Ekstrak informasi dari teks OCR struk belanja dan kembalikan dalam format JSON.

Format JSON:
{
  "items": [{"name": "string", "quantity": number, "price": number}],
  "subtotal": number,
  "tax": number atau null,
  "total": number,
  "currency": "IDR" | "USD" | "CNY" | "MYR" | "GBP"
}

Jika quantity tidak tercantum, asumsikan 1.
Pastikan angka berupa number bukan string.
HANYA respond dengan JSON.`;

  // Call server proxy to avoid exposing tokens from client
  const response = await fetch("/api/agentrouter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      ocrText: cleanedOcr,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error(
        "401: Token tidak valid. Dapatkan dari https://agentrouter.org/console/token"
      );
    }
    throw new Error(
      `Agent Router error (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  // Agent Router proxied response may already be JSON text or the raw API response
  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // not JSON - but may be plain content
    data = { raw: text };
  }

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.message ||
    data?.raw ||
    text;

  if (!content) {
    console.error("Agent Router proxy response:", text);
    throw new Error("Tidak ada konten dari Agent Router (proxy)");
  }

  // Extract JSON (handle markdown code blocks)
  let jsonStr = content.trim();
  const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1].trim();

  try {
    return ReceiptSchema.parse(JSON.parse(jsonStr));
  } catch (e: any) {
    console.error("Parse error:", content);
    throw new Error(`Gagal parsing: ${e?.message || "Invalid JSON"}`);
  }
}
