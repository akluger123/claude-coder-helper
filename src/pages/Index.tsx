import { useState, useEffect } from "react";
import { AuthPage } from "@/components/AuthPage";
import { TokenInput } from "@/components/TokenInput";
import { RepoSelector } from "@/components/RepoSelector";
import { IDELayout } from "@/components/IDELayout";
import { fetchUser, fetchRepos, fetchTree } from "@/lib/github";
import type { Repo, TreeItem } from "@/lib/github";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type View = "auth" | "token" | "repos" | "editor";

export default function Index() {
  const [view, setView] = useState<View>("auth");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Checking session...");
  const { toast } = useToast();

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Try to load saved GitHub token from database
          const { data } = await supabase
            .from("user_tokens")
            .select("github_token")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (data?.github_token) {
            await connectWithToken(data.github_token, currentUser.id);
          } else {
            setView("token");
            setLoading(false);
          }
        } else {
          setView("auth");
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession();

    return () => subscription.unsubscribe();
  }, []);

  async function connectWithToken(t: string, userId?: string) {
    setLoading(true);
    setLoadingMessage("Verifying token...");
    try {
      await fetchUser(t);
      setToken(t);

      // Save token to database
      const uid = userId || user?.id;
      if (uid) {
        await supabase.from("user_tokens").upsert(
          { user_id: uid, github_token: t },
          { onConflict: "user_id" }
        );
      }

      setLoadingMessage("Fetching repositories...");
      const r = await fetchRepos(t);
      setRepos(r);
      setView("repos");
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
      setView("token");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function selectRepo(repo: Repo) {
    setLoading(true);
    setLoadingMessage("Loading file tree...");
    try {
      const [owner, name] = repo.full_name.split("/");
      const t = await fetchTree(token, owner, name, repo.default_branch);
      setSelectedRepo(repo);
      setTree(t);
      setView("editor");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function disconnect() {
    setToken("");
    setRepos([]);
    setSelectedRepo(null);
    setTree([]);

    if (user) {
      await supabase.from("user_tokens").delete().eq("user_id", user.id);
    }

    setView("token");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setToken("");
    setRepos([]);
    setSelectedRepo(null);
    setTree([]);
    setView("auth");
  }

  if (loading && view !== "editor") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  switch (view) {
    case "auth":
      return <AuthPage />;
    case "token":
      return <TokenInput onConnect={(t) => connectWithToken(t)} loading={loading} onSignOut={signOut} />;
    case "repos":
      return <RepoSelector repos={repos} onSelect={selectRepo} />;
    case "editor":
      return selectedRepo ? (
        <IDELayout token={token} repo={selectedRepo} tree={tree} onDisconnect={disconnect} onSignOut={signOut} />
      ) : null;
  }
}
