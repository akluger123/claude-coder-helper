import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, filename, fileContent } = await req.json();

    const systemPrompt = `You are an expert AI code editor assistant. You help users modify code files.

When the user asks you to edit code:
1. Understand what they want to change
2. Provide the COMPLETE updated file content in a single code block
3. Explain what you changed

When responding with code changes, wrap the FULL updated file in a code block with the appropriate language tag.

${filename ? `Current file: ${filename}` : "No file selected"}
${fileContent ? `\nCurrent file content:\n\`\`\`\n${fileContent}\n\`\`\`` : ""}`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Use Lovable AI proxy
    const response = await fetch("https://gnljofpkrgkcwygxzhlr.supabase.co/functions/v1/ai-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI proxy error: ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Extract code block if present
    const codeBlockMatch = reply.match(/```[\w]*\n([\s\S]*?)```/);
    const codeBlock = codeBlockMatch ? codeBlockMatch[1].trim() : null;

    return new Response(JSON.stringify({ reply, codeBlock }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
