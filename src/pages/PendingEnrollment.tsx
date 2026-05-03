import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, KeyRound } from "lucide-react";
import Layout from "@/components/Layout";

export default function PendingEnrollment() {
  const { signOut, refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("enroll_with_code", {
      enrollment_code: code.trim(),
    });

    if (error) {
      toast.error(error.message);
    } else if (data && typeof data === "object") {
      const result = data as any;
      if (result.success) {
        toast.success("You've been enrolled! Redirecting...");
        await refreshProfile();
      } else {
        toast.error(result.error || "Failed to enroll");
      }
    }
    setLoading(false);
  };

  return (
    <Layout hideDefaultHeader>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground">LearnQuest</h1>
            <p className="text-muted-foreground mt-1 font-body">Almost there!</p>
          </div>

          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="font-heading text-center">⏳ Awaiting Enrollment</CardTitle>
              <CardDescription className="text-center">
                Your account has been created. An admin will assign you to a class, or you can enter an enrollment code below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleEnroll} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="enrollment-code">Enrollment Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="enrollment-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Enter code from admin"
                      className="font-mono tracking-widest"
                    />
                    <Button type="submit" disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <KeyRound className="w-4 h-4 mr-1" />
                      {loading ? "..." : "Join"}
                    </Button>
                  </div>
                </div>
              </form>

              <div className="border-t pt-4">
                <Button variant="ghost" onClick={signOut} className="w-full text-muted-foreground">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
