import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import logo from "@/assets/odiuko-shield-transparent.png";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Friendly messages for common errors
      if (error.message.includes("Invalid login")) {
        toast.error("Incorrect email or password.");
      } else if (error.message.includes("banned")) {
        toast.error("This account has been deactivated. Please contact your teacher.");
      } else {
        toast.error(error.message);
      }
    } else if (data.session) {
      await supabase.from("login_activity").insert({
        user_id: data.session.user.id,
        user_agent: navigator.userAgent,
      });
      await supabase.from("active_sessions").upsert(
        {
          user_id: data.session.user.id,
          session_token: data.session.access_token.slice(-20),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      // Navigation handled by App.tsx route guards via auth state change
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Please check your email to confirm, then wait for admin enrollment.");
      setEmail(""); setPassword(""); setDisplayName("");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setForgotOpen(false);
      setForgotEmail("");
    }
    setForgotLoading(false);
  };

  return (
    <Layout hideDefaultHeader>
      <div className="flex-1 flex items-center justify-center p-4 min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 space-y-2">
            <img src={logo} alt="Odiuko" className="h-16 w-auto mx-auto" />
            <h1 className="text-3xl font-heading font-bold text-foreground">LearnQuest</h1>
            <p className="text-muted-foreground font-body">Your Learning Adventure Starts Here</p>
          </div>

          <Card className="border-2 shadow-xl">
            <Tabs defaultValue="login">
              <CardHeader className="pb-2">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">Log In</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="student@school.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                      disabled={loading}
                    >
                      {loading ? "Logging in..." : "Log In 🚀"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </CardContent>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup}>
                  <CardContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name</Label>
                      <Input
                        id="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        placeholder="Kwame Asante"
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="student@school.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After signing up, an admin will assign you to a class, or you can use an enrollment code.
                    </p>
                    <Button
                      type="submit"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Sign Up 🎉"}
                    </Button>
                  </CardContent>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reset Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="student@school.com"
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              We'll send a password reset link to this email address.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forgotLoading}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
