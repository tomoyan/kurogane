import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET() {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content:
            'What is the current USD to JPY exchange rate? Reply with ONLY a JSON object like: {"rate": 155.23} — no other text.',
        },
      ],
    });

    let rate: number | null = null;

    for (const block of response.content) {
      if (block.type === "text") {
        const text = block.text.trim();
        const clean = text.replace(/```json|```/g, "").trim();
        try {
          const parsed = JSON.parse(clean);
          if (parsed.rate && typeof parsed.rate === "number") {
            rate = parsed.rate;
            break;
          }
        } catch {
          // try regex fallback
          const match = text.match(/[\d]{3}\.[\d]+/);
          if (match) {
            rate = parseFloat(match[0]);
            break;
          }
        }
      }
    }

    if (!rate) {
      // Fallback to a reasonable default if parsing fails
      rate = 150.0;
    }

    return NextResponse.json({ rate, fetchedAt: Date.now() });
  } catch (err) {
    console.error("Rate fetch error:", err);
    return NextResponse.json({ rate: 150.0, fetchedAt: Date.now(), fallback: true });
  }
}
