import { useState, useCallback, useMemo } from "react";
import { FileTree } from "@/components/FileTree";
import { CodeEditor } from "@/components/CodeEditor";
import { ChatPanel } from "@/components/ChatPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GitBranch, Save, LogOut, PanelLeftClose, PanelLeft,
  MessageSquare, PanelRightClose, X, Loader2, CheckSquare, Eye, EyeOff, Code2
} from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { fetchFileContent, isTextFilePath, updateFile } from "@/lib/github";
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
  const [editorOpen, setEditorOpen] = useState(true);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [aiSelectedFiles, setAiSelectedFiles] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const [owner, repoName] = repo.full_name.split("/");

  const currentFile = selectedPath ? fileCache[selectedPath] : null;
  const fileContent = currentFile?.content ?? "";
  const originalContent = currentFile?.original ?? "";
  const hasChanges = fileContent !== originalContent;
  const allRepoPaths = useMemo(() => tree.map((item) => item.path), [tree]);
  const allFilePaths = useMemo(
    () => tree
      .filter((item) => item.type === "blob" && isTextFilePath(item.path) && (item.size ?? 0) <= 50000)
      .map((item) => item.path),
    [tree],
  );

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
    if (allFilePaths.length > 0 && aiSelectedFiles.size === allFilePaths.length) {
      setAiSelectedFiles(new Set());
    } else {
      setAiSelectedFiles(new Set(allFilePaths));
    }
  };

  const aiFiles = Array.from(aiSelectedFiles)
    .filter((p) => fileCache[p])
    .map((p) => ({ path: p, content: fileCache[p].content }));

  const effectiveAiFiles = aiFiles.length > 0 ? aiFiles : (selectedPath && fileCache[selectedPath] ? [{ path: selectedPath, content: fileCache[selectedPath].content }] : []);

  const selectedAiCount = aiSelectedFiles.size > 0 ? aiSelectedFiles.size : selectedPath ? 1 : 0;

  const prepareAiFiles = useCallback(async () => {
    const selectedPaths = aiSelectedFiles.size > 0
      ? Array.from(aiSelectedFiles)
      : selectedPath
        ? [selectedPath]
        : [];

    if (selectedPaths.length === 0) {
      return [];
    }

    const missingPaths = selectedPaths.filter((path) => !fileCache[path]);
    const loadedEntries: Record<string, FileEntry> = {};

    for (let index = 0; index < missingPaths.length; index += 8) {
      const batch = missingPaths.slice(index, index + 8);
      const batchEntries = await Promise.all(
        batch.map(async (path) => {
          const content = await fetchFileContent(token, owner, repoName, path, repo.default_branch);
          return [path, { path, content, original: content }] as const;
        }),
      );

      Object.assign(loadedEntries, Object.fromEntries(batchEntries));
    }

    if (Object.keys(loadedEntries).length > 0) {
      setFileCache((prev) => ({ ...prev, ...loadedEntries }));
    }

    return selectedPaths
      .map((path) => {
        const entry = fileCache[path] ?? loadedEntries[path];
        return entry ? { path, content: entry.content } : null;
      })
      .filter((entry): entry is { path: string; content: string } => entry !== null);
  }, [aiSelectedFiles, fileCache, owner, repo.default_branch, repoName, selectedPath, token]);

  const handleApplyEdits = (edits: Record<string, string>) => {
    const editedPaths = Object.keys(edits);

    setFileCache((prev) => {
      const next = { ...prev };
      for (const [path, content] of Object.entries(edits)) {
        next[path] = next[path]
          ? { ...next[path], content }
          : { path, content, original: "" };
      }
      return next;
    });

    if (editedPaths.length > 0) {
      setOpenTabs((prev) => Array.from(new Set([...prev, ...editedPaths])));
      setSelectedPath((current) => current ?? editedPaths[0]);
    }
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
          <Button
            variant={allFilePaths.length > 0 && aiSelectedFiles.size === allFilePaths.length ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={selectAllForAi}
            disabled={allFilePaths.length === 0}
            title="Select every text file in the repo for AI"
          >
            <CheckSquare className="h-3 w-3" />
            {allFilePaths.length > 0 && aiSelectedFiles.size === allFilePaths.length ? "Clear All" : "All Files"}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditorOpen(!editorOpen)} title="Toggle editor">
            <Code2 className="h-4 w-4" />
          </Button>
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

      {/* Main content - resizable panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
              <div className="flex h-full flex-col bg-card">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Explorer
                </div>
                <FileTree items={tree} selectedPath={selectedPath} onSelect={selectFile} />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Editor + Preview area */}
        <ResizablePanel defaultSize={chatOpen ? 55 : 85} minSize={30}>
          <div className="flex h-full flex-col overflow-hidden">
            {/* Tabs */}
            {openTabs.length > 0 && (
              <div className="flex items-center border-b border-border bg-card overflow-x-auto">
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
                {selectedAiCount > 0 && (
                  <span className="px-2 text-[10px] text-primary shrink-0">
                    {selectedAiCount} file{selectedAiCount > 1 ? "s" : ""} for AI
                  </span>
                )}
              </div>
            )}

            {editorOpen && previewOpen ? (
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                <ResizablePanel defaultSize={50} minSize={20}>
                  {loadingFile ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedPath ? (
                    <CodeEditor filename={selectedPath} content={fileContent} onChange={(c) => setFileContent(selectedPath, c)} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                      <p className="text-sm">Select a file to start editing</p>
                    </div>
                  )}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={20}>
                  {selectedPath && <PreviewPanel filename={selectedPath} content={fileContent} />}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : editorOpen ? (
              <div className="flex-1 overflow-hidden">
                {loadingFile ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedPath ? (
                  <CodeEditor filename={selectedPath} content={fileContent} onChange={(c) => setFileContent(selectedPath, c)} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">Select a file to start editing</p>
                  </div>
                )}
              </div>
            ) : previewOpen ? (
              <div className="flex-1 overflow-hidden">
                {selectedPath ? (
                  <PreviewPanel filename={selectedPath} content={fileContent} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">Select a file to preview</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
                <p className="text-sm">Code and preview are hidden</p>
                <p className="mt-1 text-xs">Use the top bar buttons to reopen them.</p>
              </div>
            )}
          </div>
        </ResizablePanel>

        {/* Chat panel */}
        {chatOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
              <ChatPanel
                files={effectiveAiFiles}
                selectedCount={selectedAiCount}
                prepareFiles={prepareAiFiles}
                repoName={repo.full_name}
                repoTree={allRepoPaths}
                onApplyEdits={handleApplyEdits}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{selectedPath ? selectedPath : "No file selected"}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-primary">● Modified</span>}
          {selectedAiCount > 0 && <span className="text-primary">{selectedAiCount} files selected for AI</span>}
          <span>AI Code Editor</span>
        </div>
      </div>
    </div>
  );
}
