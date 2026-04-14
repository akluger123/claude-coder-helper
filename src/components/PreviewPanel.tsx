import { useState, useMemo } from "react";
import { Eye, EyeOff, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewPanelProps {
  filename: string;
  content: string;
}

export function PreviewPanel({ filename, content }: PreviewPanelProps) {
  const [key, setKey] = useState(0);

  const isPreviewable = useMemo(() => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ["html", "htm", "svg", "md", "markdown"].includes(ext || "");
  }, [filename]);

  const previewContent = useMemo(() => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "md" || ext === "markdown") {
      // Simple markdown → HTML conversion for preview
      const html = content
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code style='background:#1e1e2e;padding:2px 6px;border-radius:3px;font-size:13px'>$1</code>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/\n\n/g, "<br/><br/>");
      return `<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;padding:24px;background:#0a0a0f;color:#e0e0e0;line-height:1.6}h1,h2,h3{color:#fff}code{background:#1e1e2e}li{margin:4px 0}</style></head><body>${html}</body></html>`;
    }
    if (ext === "svg") {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0f}</style></head><body>${content}</body></html>`;
    }
    return content;
  }, [filename, content, key]);

  const srcDoc = useMemo(() => previewContent, [previewContent]);

  if (!isPreviewable) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Preview not available for this file type</p>
          <p className="text-[10px] mt-1 opacity-60">Supports: HTML, SVG, Markdown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          <span>Preview</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setKey((k) => k + 1)}
          title="Refresh preview"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <iframe
        key={key}
        srcDoc={srcDoc}
        className="flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts"
        title="Preview"
      />
    </div>
  );
}
