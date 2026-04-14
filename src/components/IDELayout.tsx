import { useState, useCallback } from "react";
import { FileTree } from "@/components/FileTree";
import { CodeEditor } from "@/components/CodeEditor";
import { ChatPanel } from "@/components/ChatPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GitBranch, Save, LogOut, PanelLeftClose, PanelLeft,
  MessageSquare, PanelRightClose, X, Loader2, CheckSquare, Eye, EyeOff
} from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { fetchFileContent, updateFile } from "@/lib/github";
import type { TreeItem, Repo } from "@/lib/github";
import { useToast } from "@/hooks/use-toast";

interface IDELayoutProps {
  token: string;
  repo: Repo;
  tree: TreeItem[];
  onDisconnect: () => void;
  onSignOut?: () => void;
  onBack?: () => void;
}

export interface FileEntry {
  path: string;
  content: string;
  original: string;
}

export function IDELayout({ token, repo, tree, onDisconnect, onSignOut, onBack }: IDELayoutProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<Record<string, FileEntry>>({});
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [aiSelectedFiles, setAiSelectedFiles] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const [owner, repoName] = repo.full_name.split("/");

  const currentFile = selectedPath ? fileCache[selectedPath] : null;
  const fileContent = currentFile?.content ?? "";
  const originalContent = currentFile?.original ?? "";
  const hasChanges = fileContent !== originalContent;

  const selectFile = useCallback(async (path: string) => {
    if (fileCache[path]) {
      setSelectedPath(path);
      if (!openTabs.includes(path)) {
        setOpenTabs((prev) => [...prev, path]);
      }
      return;
    }
    setLoadingFile(true);
    try {
      const content = await fetchFileContent(token, owner, repoName, path, repo.default_branch);
      setFileCache((prev) => ({ ...prev, [path]: { path, content, original: content } }));
      setSelectedPath(path);
      if (!openTabs.includes(path)) {
        setOpenTabs((prev) => [...prev, path]);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingFile(false);
    }
  }, [token, owner, repoName, repo.default_branch, openTabs, fileCache, toast]);

  const setFileContent = (path: string, content: string) => {
    setFileCache((prev) => ({
      ...prev,
      [path]: { ...prev[path], content },
    }));
  };

  const closeTab = (path: string) => {
    const newTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(newTabs);
    setAiSelectedFiles((prev) => { const n = new Set(prev); n.delete(path); return n; });
    if (selectedPath === path) {
      if (newTabs.length > 0) {
        setSelectedPath(newTabs[newTabs.length - 1]);
      } else {
        setSelectedPath(null);
      }
    }
  };

  const saveFile = async () => {
    if (!selectedPath || !currentFile) return;
    setSaving(true);
    try {
      await updateFile(token, owner, repoName, selectedPath, currentFile.content, `Update ${selectedPath} via AI Editor`, repo.default_branch);
      setFileCache((prev) => ({
        ...prev,
        [selectedPath]: { ...prev[selectedPath], original: currentFile.content },
      }));
      toast({ title: "Saved", description: `${selectedPath} committed successfully` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleAiFile = (path: string) => {
    setAiSelectedFiles((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  };

  const selectAllForAi = () => {
    if (aiSelectedFiles.size === openTabs.length) {
      setAiSelectedFiles(new Set());
    } else {
      setAiSelectedFiles(new Set(openTabs));
    }
  };

  // Build files array for AI
  const aiFiles = Array.from(aiSelectedFiles)
    .filter((p) => fileCache[p])
    .map((p) => ({ path: p, content: fileCache[p].content }));

  // If no files explicitly selected, use current file
  const effectiveAiFiles = aiFiles.length > 0 ? aiFiles : (selectedPath && fileCache[selectedPath] ? [{ path: selectedPath, content: fileCache[selectedPath].content }] : []);

  const handleApplyEdits = (edits: Record<string, string>) => {
    setFileCache((prev) => {
      const next = { ...prev };
      for (const [path, content] of Object.entries(edits)) {
        if (next[path]) {
          next[path] = { ...next[path], content };
        }
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack} title="Back to menu">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-1.5 text-sm">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{repo.full_name}</span>
            <span className="text-muted-foreground">({repo.default_branch})</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasChanges && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={saveFile} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Commit
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewOpen(!previewOpen)} title="Toggle preview">
            {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? <PanelRightClose className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDisconnect} title="Disconnect repo">
            <LogOut className="h-4 w-4" />
          </Button>
          {onSignOut && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSignOut}>
              Sign Out
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="flex w-60 flex-col border-r border-border bg-card shrink-0">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Explorer
            </div>
            <FileTree items={tree} selectedPath={selectedPath} onSelect={selectFile} />
          </div>
        )}

        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs with AI selection */}
          {openTabs.length > 0 && (
            <div className="flex items-center border-b border-border bg-card overflow-x-auto">
              {openTabs.length > 1 && (
                <button
                  onClick={selectAllForAi}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-primary border-r border-border shrink-0 transition-colors"
                  title={aiSelectedFiles.size === openTabs.length ? "Deselect all for AI" : "Select all for AI"}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>{aiSelectedFiles.size === openTabs.length ? "None" : "All"}</span>
                </button>
              )}
              {openTabs.map((tab) => {
                const name = tab.split("/").pop() || tab;
                const isActive = tab === selectedPath;
                const isAiSelected = aiSelectedFiles.has(tab);
                const tabModified = fileCache[tab] && fileCache[tab].content !== fileCache[tab].original;
                return (
                  <div
                    key={tab}
                    className={`group flex items-center gap-1 border-r border-border px-2 py-1.5 text-xs cursor-pointer shrink-0 ${
                      isActive ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={isAiSelected}
                      onCheckedChange={() => toggleAiFile(tab)}
                      className="h-3.5 w-3.5 rounded-sm border-muted-foreground/40"
                    />
                    <span className="font-mono" onClick={() => selectFile(tab)}>{name}</span>
                    {tabModified && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    <button
                      className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                      onClick={(e) => { e.stopPropagation(); closeTab(tab); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {aiSelectedFiles.size > 0 && (
                <span className="px-2 text-[10px] text-primary shrink-0">
                  {aiSelectedFiles.size} file{aiSelectedFiles.size > 1 ? "s" : ""} for AI
                </span>
              )}
            </div>
          )}

          <div className={`flex-1 overflow-hidden ${previewOpen ? "flex" : ""}`}>
            <div className={previewOpen ? "flex-1 overflow-hidden" : "h-full"}>
              {loadingFile ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : selectedPath ? (
                <CodeEditor
                  filename={selectedPath}
                  content={fileContent}
                  onChange={(c) => setFileContent(selectedPath, c)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <p className="text-sm">Select a file to start editing</p>
                </div>
              )}
            </div>
            {previewOpen && selectedPath && (
              <div className="w-1/2 border-l border-border overflow-hidden">
                <PreviewPanel filename={selectedPath} content={fileContent} />
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-80 border-l border-border shrink-0">
            <ChatPanel
              files={effectiveAiFiles}
              onApplyEdits={handleApplyEdits}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{selectedPath ? selectedPath : "No file selected"}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-primary">● Modified</span>}
          {aiSelectedFiles.size > 1 && <span className="text-primary">{aiSelectedFiles.size} files selected for AI</span>}
          <span>AI Code Editor</span>
        </div>
      </div>
    </div>
  );
}
