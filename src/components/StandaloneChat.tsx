import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Bot, User, Loader2, Sparkles, ArrowLeft, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AI_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini Pro" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "minimax", label: "MiniMax M2.5" },
  { value: "google-phi", label: "Phi-4 Mini" },
];

interface StandaloneChatProps {
  onBack: () => void;
  onSignOut: () => void;
}

export function StandaloneChat({ onBack, onSignOut }: StandaloneChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: newMessages, files: [], model, webSearch: true },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setMessages([...newMessages, { role: "assistant", content: `Error: ${err.message || "Failed to get AI response"}` }]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="text-xs" onClick={onSignOut}>Sign Out</Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h2 className="text-lg font-medium text-foreground mb-1">AI Assistant</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask me anything — coding questions, web lookups, general knowledge. No repo required.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${msg.role === "user" ? "bg-secondary" : "bg-primary/10"}`}>
                {msg.role === "user" ? <User className="h-4 w-4 text-foreground" /> : <Bot className="h-4 w-4 text-primary" />}
              </div>
              <div className="min-w-0 flex-1 text-sm text-foreground/90 leading-relaxed prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code: ({ children, className }) => {
                      if (className?.includes("language-")) {
                        return (<pre className="bg-card rounded-md p-3 overflow-x-auto my-2"><code className="text-xs font-mono">{children}</code></pre>);
                      }
                      return <code className="bg-card px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                  }}
                >{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-2xl flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask anything..."
            className="flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
            rows={1}
          />
          {loading ? (
            <Button size="icon" variant="destructive" onClick={stopGeneration} className="shrink-0 self-end">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={sendMessage} disabled={!input.trim()} className="shrink-0 self-end">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}