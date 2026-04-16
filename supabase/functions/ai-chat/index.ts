import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NVIDIA NIM models and their correct model IDs
const NVIDIA_MODELS: Record<string, { modelId: string; secretKey: string }> = {
  "minimax": { modelId: "minimaxai/minimax-m2.5", secretKey: "MINIMAX_API_KEY" },
  "google-phi": { modelId: "microsoft/phi-4-mini-instruct", secretKey: "GOOGLE_PHI_API_KEY" },
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const TEAM_MODEL_LIMIT = 5;
const MAX_TREE_ENTRIES = 2500;
const MAX_FILE_CHARS = 12000;
const MAX_TOTAL_FILE_CHARS = 120000;

const GATEWAY_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
]);

type ChatMessage = {
  role: string;
  content: string;
};

type FilePayload = {
  path: string;
  content: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n/* truncated for context */`;
}

function buildRepoContext(repoName?: string, repoTree?: string[]) {
  if (!repoName && (!repoTree || repoTree.length === 0)) {
    return "";
  }

  const lines = (repoTree || []).slice(0, MAX_TREE_ENTRIES);
  const overflow = (repoTree?.length || 0) - lines.length;

  return [
    repoName ? `Repository: ${repoName}` : null,
    lines.length > 0 ? `Repository tree:\n${lines.join("\n")}` : null,
    overflow > 0 ? `...and ${overflow} more paths not shown.` : null,
  ].filter(Boolean).join("\n\n");
}

function buildFileContext(files: FilePayload[]) {
  if (files.length === 0) {
    return "";
  }

  let totalChars = 0;
  let includedFiles = 0;
  const blocks: string[] = [];

  for (const file of files) {
    if (totalChars >= MAX_TOTAL_FILE_CHARS) break;

    const remaining = Math.max(0, MAX_TOTAL_FILE_CHARS - totalChars);
    const limit = Math.min(MAX_FILE_CHARS, remaining);
    if (limit === 0) break;

    const content = truncate(file.content || "", limit);
    blocks.push(`File: ${file.path}\n\`\`\`\n${content}\n\`\`\``);
    totalChars += content.length;
    includedFiles += 1;
  }

  const omittedFiles = files.length - includedFiles;
  const prefix = files.length === 1
    ? `Current file: ${files[0].path}`
    : `You are editing ${files.length} files simultaneously.`;

  return [
    prefix,
    blocks.join("\n\n"),
    omittedFiles > 0 ? `...${omittedFiles} additional files were omitted to stay within the context limit.` : null,
  ].filter(Boolean).join("\n\n");
}

function buildSystemPrompt(files: FilePayload[], repoName?: string, repoTree?: string[]) {
  const repoContext = buildRepoContext(repoName, repoTree);
  const fileContext = buildFileContext(files);
  const multiFileInstructions = files.length > 1
    ? `\n\nIMPORTANT: When providing code changes for multiple files, format each file's code block like this:
**\`path/to/file\`**
\`\`\`language
...full file content...
\`\`\`

Always include the filename header before each code block so changes can be applied to the correct file.`
    : "";

  if (!repoContext && !fileContext) {
    return "You are a helpful AI assistant. You can answer questions about coding, technology, and general knowledge. Be concise and helpful.";
  }

  return `You are an expert AI code editor assistant. You help users modify code files and reason about repositories.

When the user asks you to edit code:
1. Understand what they want to change
2. Provide the COMPLETE updated file content in a code block whenever code changes are required
3. Keep explanations concise and practical${multiFileInstructions}

${repoContext ? `${repoContext}\n\n` : ""}${fileContext}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(model: string, messages: ChatMessage[]) {
  const nvidiaConfig = NVIDIA_MODELS[model];

  if (nvidiaConfig) {
    const apiKey = Deno.env.get(nvidiaConfig.secretKey);
    if (!apiKey) {
      throw new Error(`${nvidiaConfig.secretKey} is not configured.`);
    }

    const response = await fetchWithTimeout(NVIDIA_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: nvidiaConfig.modelId,
        messages,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    }, 90000);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    return {
      reply: data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.",
      resolvedModel: model,
    };
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const resolvedModel = GATEWAY_MODELS.has(model) ? model : DEFAULT_MODEL;
  const warning = resolvedModel !== model
    ? `${model} isn't available right now, so ${DEFAULT_MODEL} answered instead.`
    : undefined;

  const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages,
    }),
  }, 60000);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Add funds in Settings > Workspace > Usage.");
    }

    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return {
    reply: data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.",
    resolvedModel,
    warning,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, files, model, models, filename, fileContent, repoName, repoTree } = await req.json();

    const fileList: { path: string; content: string }[] = files || [];

    if (fileList.length === 0 && filename && fileContent) {
      fileList.push({ path: filename, content: fileContent });
    }
    const systemPrompt = buildSystemPrompt(fileList, repoName, repoTree);

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const selectedModel = model || DEFAULT_MODEL;
    const selectedModels = Array.isArray(models)
      ? models.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0).slice(0, TEAM_MODEL_LIMIT)
      : [];

    if (selectedModels.length > 1) {
      const modelResults = await Promise.all(
        selectedModels.map(async (candidate) => {
          try {
            return { model: candidate, ...(await callModel(candidate, apiMessages)) };
          } catch (error) {
            return {
              model: candidate,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      const successfulResults = modelResults.filter(
        (result): result is { model: string; reply: string; resolvedModel: string; warning?: string } => "reply" in result,
      );

      if (successfulResults.length === 0) {
        return jsonResponse({ error: "All selected models failed to respond." }, 500);
      }

      const synthesisSource = messages[messages.length - 1]?.content || "";
      const synthesisMessages: ChatMessage[] = [
        {
          role: "system",
          content: "You are an expert AI orchestrator. Combine the model outputs into one clear final answer. If the task involves code edits, preserve full file contents and file headers exactly.",
        },
        {
          role: "user",
          content: `Original user request:\n${synthesisSource}\n\nModel outputs:\n${successfulResults.map((result) => `Model: ${result.resolvedModel}\n${result.reply}`).join("\n\n---\n\n")}`,
        },
      ];

      const synthesis = await callModel(selectedModel, synthesisMessages);
      const warnings = modelResults.flatMap((result) => {
        if ("error" in result) return [`${result.model} failed: ${result.error}`];
        return result.warning ? [result.warning] : [];
      });

      return jsonResponse({
        reply: synthesis.reply,
        collaborators: successfulResults.map((result) => result.resolvedModel),
        warning: synthesis.warning,
        warnings,
      });
    }

    const result = await callModel(selectedModel, apiMessages);
    return jsonResponse({ reply: result.reply, warning: result.warning, model: result.resolvedModel });
  } catch (error) {
    console.error("ai-chat error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
