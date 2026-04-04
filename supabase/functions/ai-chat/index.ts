import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, files, model, filename, fileContent } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build file context - support both new multi-file format and legacy single-file
    let fileContext = "";
    const fileList: { path: string; content: string }[] = files || [];

    if (fileList.length === 0 && filename && fileContent) {
      fileList.push({ path: filename, content: fileContent });
    }

    if (fileList.length === 1) {
      fileContext = `Current file: ${fileList[0].path}\n\nCurrent file content:\n\`\`\`\n${fileList[0].content}\n\`\`\``;
    } else if (fileList.length > 1) {
      fileContext = `You are editing ${fileList.length} files simultaneously.\n\n` +
        fileList.map((f) => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
    }

    const multiFileInstructions = fileList.length > 1
      ? `\n\nIMPORTANT: When providing code changes for multiple files, format each file's code block like this:
**\`path/to/file\`**
\`\`\`language
...full file content...
\`\`\`

Always include the filename header before each code block so changes can be applied to the correct file.`
      : "";

    const systemPrompt = `You are an expert AI code editor assistant. You help users modify code files.

When the user asks you to edit code:
1. Understand what they want to change
2. Provide the COMPLETE updated file content in a code block
3. Explain what you changed
${multiFileInstructions}

${fileContext}`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const selectedModel = model || "google/gemini-3-flash-preview";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
