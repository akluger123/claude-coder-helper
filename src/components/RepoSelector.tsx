import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Lock, Globe, GitBranch, ArrowLeft, MessageSquare } from "lucide-react";
import type { Repo } from "@/lib/github";

interface RepoSelectorProps {
  repos: Repo[];
  onSelect: (repo: Repo) => void;
  onBack?: () => void;
  onSkipToChat?: () => void;
}

export function RepoSelector({ repos, onSelect, onBack, onSkipToChat }: RepoSelectorProps) {
  const [filter, setFilter] = useState("");
  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2 relative">
          {onBack && (
            <Button variant="ghost" size="sm" className="absolute left-0 top-0" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <h2 className="text-xl font-semibold text-foreground">Select a Repository</h2>
          <p className="text-sm text-muted-foreground">{repos.length} repositories found</p>
          {onSkipToChat && (
            <button onClick={onSkipToChat} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              Skip — use AI without a repo
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        <ScrollArea className="h-[500px] rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {filtered.map((repo) => (
              <button
                key={repo.id}
                onClick={() => onSelect(repo)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
              >
                {repo.private ? (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{repo.full_name}</div>
                  {repo.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <GitBranch className="h-3 w-3" />
                  {repo.default_branch}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No repositories found</div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
