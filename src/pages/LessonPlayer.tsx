import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, BookOpen } from "lucide-react";
import Layout from "@/components/Layout";
import logo from "@/assets/odiuko-shield-transparent.png";

export default function LessonPlayer() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lessonId || !user) return;
    const fetchLesson = async () => {
      setLoading(true);
      const [{ data: lessonData }, { data: prog }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).single(),
        supabase
          .from("student_progress")
          .select("completed")
          .eq("student_id", user.id)
          .eq("lesson_id", lessonId)
          .maybeSingle(),
      ]);
      setLesson(lessonData);
      setCompleted(prog?.completed ?? false);
      setLoading(false);
    };
    fetchLesson();
  }, [lessonId, user]);

  const markComplete = async () => {
    if (!user || !lessonId || completed) return;
    setSaving(true);
    const { error } = await supabase.from("student_progress").upsert(
      {
        student_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" }
    );
    if (error) {
      toast.error("Failed to save progress. Please try again.");
    } else {
      setCompleted(true);
      toast.success("Lesson completed! 🎉");
      await checkAndAwardBadges();
    }
    setSaving(false);
  };

  const checkAndAwardBadges = async () => {
    if (!user) return;
    const [{ data: progressData }, { data: allBadges }, { data: alreadyEarned }] = await Promise.all([
      supabase
        .from("student_progress")
        .select("lesson_id, lessons(subject)")
        .eq("student_id", user.id)
        .eq("completed", true),
      supabase.from("badges").select("*"),
      supabase.from("student_badges").select("badge_id").eq("student_id", user.id),
    ]);

    const totalCompleted = progressData?.length ?? 0;
    const bySubject: Record<string, number> = {};
    progressData?.forEach((p: any) => {
      const s = p.lessons?.subject;
      if (s) bySubject[s] = (bySubject[s] ?? 0) + 1;
    });

    const earnedIds = new Set((alreadyEarned ?? []).map((e: any) => e.badge_id));

    for (const badge of allBadges ?? []) {
      if (earnedIds.has(badge.id)) continue;
      const count = badge.subject ? (bySubject[badge.subject] ?? 0) : totalCompleted;
      if (count >= badge.requirement_count) {
        const { error } = await supabase
          .from("student_badges")
          .insert({ student_id: user.id, badge_id: badge.id });
        if (!error) {
          toast.success(`🏆 Badge earned: ${badge.name}!`);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-14 bg-primary" />
        <div className="flex-1 flex flex-col lg:flex-row">
          <Skeleton className="flex-1 h-[60vh] lg:h-auto" />
          <div className="w-full lg:w-80 p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-heading">Lesson not found</p>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const headerContent = (
    <header className="bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:text-accent flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logo} alt="LearnQuest" className="h-7 w-auto flex-shrink-0" />
          <h1 className="text-base font-heading font-bold truncate">{lesson.title}</h1>
        </div>
        {completed && (
          <Badge className="bg-accent text-accent-foreground flex-shrink-0 ml-2">✓ Completed</Badge>
        )}
      </div>
    </header>
  );

  return (
    <Layout header={headerContent}>
      <div className="flex flex-col lg:flex-row" style={{ minHeight: "calc(100vh - 8rem)" }}>
        {/* iframe */}
        <div className="flex-1 bg-muted">
          <iframe
            src={lesson.embed_url}
            className="w-full h-[60vh] lg:h-full border-0"
            allow="fullscreen; autoplay"
            title={lesson.title}
            loading="lazy"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card flex-shrink-0">
          <div className="p-6 space-y-6 lg:sticky lg:top-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0 pb-3">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-accent" />
                  Lesson Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {lesson.notes || "No notes for this lesson."}
                </p>
              </CardContent>
            </Card>

            {!completed ? (
              <Button
                onClick={markComplete}
                disabled={saving}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-base py-6"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {saving ? "Saving..." : "Mark as Complete"}
              </Button>
            ) : (
              <div className="text-center p-4 rounded-lg bg-accent/10 border border-accent/30">
                <CheckCircle className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="font-heading font-semibold">Great job! 🎉</p>
                <p className="text-sm text-muted-foreground">You've completed this lesson.</p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
