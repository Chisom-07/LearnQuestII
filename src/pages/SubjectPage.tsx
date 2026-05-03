import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FlaskConical, Calculator, Languages } from "lucide-react";
import Layout from "@/components/Layout";
import logo from "@/assets/odiuko-shield-transparent.png";

const subjectConfig: Record<string, { label: string; icon: any; color: string }> = {
  science: { label: "Science", icon: FlaskConical, color: "bg-emerald-500" },
  math: { label: "Mathematics", icon: Calculator, color: "bg-blue-500" },
  english: { label: "English", icon: Languages, color: "bg-purple-500" },
};

export default function SubjectPage() {
  const { subject } = useParams<{ subject: string }>();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<any[]>([]);
  const [progress, setProgress] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const config = subjectConfig[subject ?? ""] ?? subjectConfig.science;

  useEffect(() => {
    if (!profile || !user) return;
    const fetchData = async () => {
      setLoading(true);
      const [lessonsRes, progressRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("*")
          .eq("subject", subject! as any)
          .eq("class_level", profile.class_level as any)
          .order("sort_order"),
        // FIX: filter by student_id so progress is per-student
        supabase
          .from("student_progress")
          .select("lesson_id")
          .eq("student_id", user.id)
          .eq("completed", true),
      ]);
      setLessons(lessonsRes.data ?? []);
      setProgress((progressRes.data ?? []).map((p: any) => p.lesson_id));
      setLoading(false);
    };
    fetchData();
  }, [profile, subject, user]);

  const headerContent = (
    <header className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="text-primary-foreground hover:text-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <img src={logo} alt="LearnQuest" className="h-8 w-auto" />
        <config.icon className="w-6 h-6 text-accent" />
        <h1 className="text-xl font-heading font-bold">{config.label}</h1>
      </div>
    </header>
  );

  return (
    <Layout header={headerContent}>
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No lessons available yet.</p>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, i) => {
              const done = progress.includes(lesson.id);
              return (
                <Card
                  key={lesson.id}
                  className="border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/lesson/${lesson.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-white font-bold flex-shrink-0`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lesson.title}</p>
                    </div>
                    {done && (
                      <Badge className="bg-accent text-accent-foreground flex-shrink-0">✓ Done</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </Layout>
  );
}
