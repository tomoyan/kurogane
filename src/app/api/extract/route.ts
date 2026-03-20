import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a product information extraction specialist. Extract product details and return ONLY a valid JSON object with no extra text, markdown, or explanation.

Required JSON format:
{
  "productId": "SKU or model number, or 'N/A'",
  "nameEn": "Product name in English",
  "nameJa": "製品名（日本語）",
  "brand": "Brand name",
  "material": "Primary materials used",
  "dimensions": "Size/dimensions (e.g. 30cm × 20cm × 10cm)",
  "color": "Color options",
  "priceUsd": 99.99,
  "summaryEn": "2-3 sentence product description in English",
  "summaryJa": "2〜3文の製品説明（日本語）",
  "category": "Product category",
  "confidence": "high|medium|low"
}

Rules:
- priceUsd must be a number (not a string). If no price found, use null.
- All fields must be present. Use "N/A" for unknown string fields.
- Translate nameJa and summaryJa into natural, professional Japanese.
- Return ONLY the JSON object, nothing else.`;

export async function POST(request: Request) {
  try {
    const { url, searchText } = await request.json();

    if (!url && !searchText) {
      return NextResponse.json({ error: "url or searchText required" }, { status: 400 });
    }

    const tools: Anthropic.Tool[] = url
      ? [{ type: "web_search_20250305" as const, name: "web_search" }]
      : [{ type: "web_search_20250305" as const, name: "web_search" }];

    const userMessage = url
      ? `Extract complete product information from this URL: ${url}\n\nVisit the page and extract all available product details.`
      : `Search for this product and extract complete product information: "${searchText}"\n\nFind the most relevant product listing and extract all details.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text from all content blocks
    const fullText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    // Parse JSON from response
    const clean = fullText.replace(/```json|```/g, "").trim();
    
    // Find JSON object in the text
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const product = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ product });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
