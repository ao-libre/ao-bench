export interface LLMAdapter {
  name: string;
  generate(prompt: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// OpenAI adapter
// ---------------------------------------------------------------------------

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class OpenAIAdapter implements LLMAdapter {
  readonly name: string;

  constructor(private readonly model: string) {
    this.name = model;
  }

  async generate(prompt: string): Promise<string> {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. " +
          "Export it before running the harness with an OpenAI model.",
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI API returned an empty response");
    }
    return content;
  }
}

// ---------------------------------------------------------------------------
// Anthropic adapter
// ---------------------------------------------------------------------------

interface AnthropicMessage {
  type: string;
  text: string;
}

interface AnthropicResponse {
  content: AnthropicMessage[];
}

class AnthropicAdapter implements LLMAdapter {
  readonly name: string;

  constructor(private readonly model: string) {
    this.name = model;
  }

  async generate(prompt: string): Promise<string> {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
          "Export it before running the harness with a Claude model.",
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content[0]?.text;
    if (!text) {
      throw new Error("Anthropic API returned an empty response");
    }
    return text;
  }
}

// ---------------------------------------------------------------------------
// Scripted adapter (for testing — no API key required)
// ---------------------------------------------------------------------------

class ScriptedAdapter implements LLMAdapter {
  readonly name = "scripted";

  async generate(_prompt: string): Promise<string> {
    // Returns a minimal TypeScript script that attacks and waits in a loop.
    // The runner will extract this from the markdown code block.
    return `\`\`\`typescript
import { AOBot } from "@aobench/sdk";

const bot = new AOBot("TestChar", {
  gatewayUrl: process.env["GATEWAY_URL"] ?? "ws://localhost:7780",
  password: "aobench",
});

await bot.connect();

for (let i = 0; i < 10; i++) {
  const state = bot.getState();
  console.log(\`XP: \${state.exp}\`);
  await bot.attack();
  await bot.waitTicks(1);
}

bot.disconnect();
\`\`\``;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAdapter(model: string): LLMAdapter {
  if (
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3")
  ) {
    return new OpenAIAdapter(model);
  }

  if (model.startsWith("claude-")) {
    return new AnthropicAdapter(model);
  }

  if (model === "scripted") {
    return new ScriptedAdapter();
  }

  // Default to OpenAI for unknown models (future-proofing)
  return new OpenAIAdapter(model);
}
