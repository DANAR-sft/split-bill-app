import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { zodResponseFormat } from "openai/helpers/zod";
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

/**
 * Parse OCR text from receipt using OpenAI structured outputs
 */
export async function parseReceiptWithAI(ocrText: string): Promise<Receipt> {
  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `Kamu adalah asisten yang ahli dalam membaca dan mengekstrak data dari struk/receipt.
Tugas kamu adalah mengekstrak informasi dari teks OCR struk belanja.
Ekstrak data berikut:
- Daftar item: nama barang, quantity, harga total item (sesuai yang tertera di struk)
- Subtotal keseluruhan (sebelum pajak)
- Pajak/tax (jika ada, null jika tidak ada)
- Total harga keseluruhan
- Mata uang yang digunakan

Jika ada data yang tidak jelas atau tidak terbaca, buat estimasi terbaik berdasarkan konteks.
Jika quantity tidak tercantum, asumsikan quantity = 1.
Pastikan semua angka dalam format number (bukan string).
Respond dengan JSON yang valid sesuai schema yang diminta.`,
    },
    {
      role: "user",
      content: `Berikut adalah teks OCR dari struk:\n\n${ocrText}\n\nEkstrak data dari struk ini.`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini-2024-07-18",
    messages: messages,
    response_format: zodResponseFormat(ReceiptSchema, "receipt"),
  });

  const content = response.choices[0].message.content;

  if (!content) {
    throw new Error("Failed to parse receipt data - no content returned");
  }

  const parsed = JSON.parse(content) as Receipt;
  return parsed;
}

export async function fetchReport({ data }: { data: string }) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "you are a expert at trading, you generate a report advising on whether to buy or sell the shares based on the data,you describe in 100 word",
    },
    {
      role: "user",
      content: data,
    },
  ];

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: messages,
    });
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.log("Error", error);
  }
}
