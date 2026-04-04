import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Github, ExternalLink } from "lucide-react";

interface TokenInputProps {
  onConnect: (token: string) => void;
  loading: boolean;
  onSignOut?: () => void;
}

export function TokenInput({ onConnect, loading, onSignOut }: TokenInputProps) {
  const [token, setToken] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Github className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">AI Code Editor</h1>
          <p className="text-muted-foreground text-sm">
            Connect your GitHub account to start editing code with AI assistance.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Personal Access Token</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && token.trim() && onConnect(token.trim())}
                className="pl-10 bg-secondary border-border font-mono text-sm"
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => onConnect(token.trim())}
            disabled={!token.trim() || loading}
          >
            {loading ? "Connecting..." : "Connect to GitHub"}
          </Button>
        </div>

        <div className="text-center">
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=AI+Code+Editor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Generate a token with repo scope
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
