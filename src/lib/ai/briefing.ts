import { createServerFn } from "@tanstack/react-start";

export const askControlBrief = createServerFn({ method: "POST" })
  .validator((input: { summary: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI briefing is unavailable in this environment." };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 420,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are the Chief Controller, Northern Railway Delhi Division. Write a terse control-office briefing for the NDLS–UMB block plan. No markdown, no bullets, 120–180 words. Use Indian Railways terms (possession, TSR, OHE, S&T, BCM, mega block). Do not invent trains, km, or numbers that are not in the summary.",
          },
          { role: "user", content: data.summary },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `Briefing service returned ${res.status}.` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const text = body.choices[0]?.message.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "Empty briefing." };
    return { ok: true as const, text };
  });
