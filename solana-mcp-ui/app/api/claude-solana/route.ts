import { NextRequest, NextResponse } from "next/server";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929"; // or whichever you have access to

// Simple GET handler so you can test in the browser
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "claude-solana route is alive (GET)",
  });
}

// POST handler used by your frontend
export async function POST(req: NextRequest) {
  try {
        console.log(
      "ENV KEY CHECK:",
      process.env.ANTHROPIC_API_KEY
        ? `✅ loaded, prefix=${process.env.ANTHROPIC_API_KEY.slice(0, 40)}...`
        : "❌ NOT SET"
    );

    const body = await req.json().catch(() => null);
    const prompt = body?.prompt as string | undefined;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing 'prompt' in request body" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "Server misconfigured: ANTHROPIC_API_KEY not set" },
        { status: 500 }
      );
    }

    // Call Claude Messages API
    const claudeRes = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const rawText = await claudeRes.text();
    // Helpful debug log in your server console:
    console.log("Claude raw response:", rawText);

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Claude (or some proxy) returned non-JSON (HTML, text error, etc.)
      return NextResponse.json(
        {
          error: "Claude API did not return valid JSON",
          raw: rawText,
          status: claudeRes.status,
        },
        { status: 500 }
      );
    }

    if (!claudeRes.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Claude API error with status ${claudeRes.status}`,
          raw: data,
        },
        { status: 500 }
      );
    }

    // Pull the text chunks out of Claude's response
    const text =
      Array.isArray(data.content) && data.content.length > 0
        ? data.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n\n")
        : "";

    return NextResponse.json({ text, raw: data });
  } catch (err: any) {
    console.error("Claude route error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error in Claude route" },
      { status: 500 }
    );
  }
}
