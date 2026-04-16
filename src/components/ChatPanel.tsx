import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Sparkles, Files, Square, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { AI_MODELS, DEFAULT_AI_MODEL, TEAM_AI_MODELS, isSelectableModel } from "@/lib/ai-models";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FileInfo {
  path: string;
  content: string;
}

interface ChatPanelProps {
  files: FileInfo[];
  onApplyEdits: (edits: Record<string, string>) => void;
  prepareFiles?: () => Promise<FileInfo[]>;
  repoName?: string;
  repoTree?: string[];
  selectedCount?: number;
}

export function ChatPanel({ files, onApplyEdits, prepareFiles, repoName, repoTree, selectedCount }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(DEFAULT_AI_MODEL);
  const [teamMode, setTeamMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestFilesRef = useRef<FileInfo[]>(files);
  const { toast } = useToast();

  const selectedFileCount = selectedCount ?? files.length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    latestFilesRef.current = files;
  }, [files]);

  useEffect(() => {
    if (!isSelectableModel(model)) {
      setModel(DEFAULT_AI_MODEL);
    }
  }, [model]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  function parseMultiFileResponse(reply: string): Record<string, string> | null {
    const currentFiles = latestFilesRef.current;

    // Match patterns like: ```language:path/to/file\n...code...\n```
    // or FILE: path/to/file followed by ```
    const edits: Record<string, string> = {};

    // Pattern 1: ```lang:filepath
    const taggedBlocks = [...reply.matchAll(/```[\w]*:([^\n]+)\n([\s\S]*?)```/g)];
    if (taggedBlocks.length > 0) {
      for (const match of taggedBlocks) {
        edits[match[1].trim()] = match[2].trim();
      }
      return Object.keys(edits).length > 0 ? edits : null;
    }

    // Pattern 2: **`filepath`** or ### filepath followed by code block
    const headerBlocks = [...reply.matchAll(/(?:\*\*`([^`]+)`\*\*|###?\s+`?([^\n`]+)`?)\s*\n```[\w]*\n([\s\S]*?)```/g)];
    if (headerBlocks.length > 0) {
      for (const match of headerBlocks) {
        const path = (match[1] || match[2]).trim();
        edits[path] = match[3].trim();
      }
      return Object.keys(edits).length > 0 ? edits : null;
    }

    // Fallback: single code block → apply to first file
    if (currentFiles.length === 1) {
      const singleBlock = reply.match(/```[\w]*\n([\s\S]*?)```/);
      if (singleBlock) {
        edits[currentFiles[0].path] = singleBlock[1].trim();
        return edits;
      }
    }

    return null;
  }

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
      const preparedFiles = prepareFiles ? await prepareFiles() : files;
      latestFilesRef.current = preparedFiles;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: newMessages,
          files: preparedFiles,
          model,
          models: teamMode ? TEAM_AI_MODELS : undefined,
          repoName,
          repoTree,
        },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const notices = [...new Set([data?.warning, ...(Array.isArray(data?.warnings) ? data.warnings : [])].filter(Boolean))];
      if (notices.length > 0) {
        toast({ title: "Model notice", description: notices[0] });
      }

      const assistantMsg: Message = { role: "assistant", content: data.reply };
      setMessages([...newMessages, assistantMsg]);

      // Try to extract and apply edits
      const edits = parseMultiFileResponse(data.reply);
      if (edits) {
        onApplyEdits(edits);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast({ title: "AI request failed", description: err.message || "Failed to get AI response", variant: "destructive" });
      const errorMsg: Message = {
        role: "assistant",
        content: `Error: ${err.message || "Failed to get AI response"}`,
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  const fileNames = files.map((f) => f.path.split("/").pop()).join(", ");

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">AI Assistant</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={teamMode ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setTeamMode((current) => !current)}
            title="Use up to 5 models together"
          >
            <Users className="h-3.5 w-3.5" />
            x5
          </Button>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs" disabled={!!m.disabled}>
                  <span className="flex items-center gap-1.5">
                    {m.label}
                    {m.badge && (
                      <Badge variant="secondary" className="px-1 py-0 text-[9px] uppercase tracking-wide">
                        {m.badge}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Show selected files */}
      {(selectedFileCount > 0 || repoName) && (
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-1.5 text-[10px] text-muted-foreground">
          <Files className="h-3 w-3" />
          <span className="truncate">
            {selectedFileCount === 1 && files.length === 1
              ? files[0].path
              : selectedFileCount > 1
                ? `${selectedFileCount} files selected${fileNames ? `: ${fileNames}` : ""}`
                : repoName
                  ? `${repoName} repository context`
                  : "No files selected"}
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {selectedFileCount > 1
                  ? `${selectedFileCount} files selected — ask me to edit them`
                  : selectedFileCount === 1 && files.length === 1
                    ? `Ask me to edit ${files[0].path}`
                    : repoName
                      ? `Use All Files or ask me about ${repoName}`
                      : "Select a file to start editing with AI"}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                msg.role === "user" ? "bg-secondary" : "bg-primary/10"
              }`}>
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm text-foreground/90 leading-relaxed prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <pre className="bg-background rounded-md p-3 overflow-x-auto my-2">
                            <code className="text-xs font-mono">{children}</code>
                          </pre>
                        );
                      }
                      return <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={selectedFileCount > 1 ? `Edit ${selectedFileCount} files...` : selectedFileCount === 1 && files.length === 1 ? `Ask about ${files[0].path}...` : repoName ? `Ask about ${repoName}...` : "Select a file first..."}
            className="flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
            rows={1}
            disabled={false}
          />
          <Button
            size="icon"
            onClick={loading ? stopGeneration : sendMessage}
            disabled={!loading && !input.trim()}
            className="shrink-0 self-end"
            variant={loading ? "destructive" : "default"}
          >
            {loading ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
