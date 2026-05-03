import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FlaskConical, Calculator, Languages, LogOut, Shield } from "lucide-react";
import Layout from "@/components/Layout";
import logo from "@/assets/odiuko-shield-transparent.png";

const subjectConfig = {
  science: { label: "Science", icon: FlaskConical, color: "bg-emerald-500" },
  math: { label: "Mathematics", icon: Calculator, color: "bg-blue-500" },
  english: { label: "English", icon: Languages, color: "bg-purple-500" },
};

const classLabels: Record<string, string> = {
  basic_1: "Basic 1", basic_2: "Basic 2", basic_3: "Basic 3",
  basic_4: "Basic 4", basic_5: "Basic 5", basic_6: "Basic 6",
};

type LessonRow = {
  id: string;
  title: string;
  subject: "science" | "math" | "english";
  class_level: string;
  embed_url: string;
  notes: string | null;
  sort_order: number;
};

type ProgressRow = { lesson_id: string };

type BadgeRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_count: number;
  subject: string | null;
};

export default function Dashboard() {
  const { profile, user, isAdmin, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<BadgeRow[]>([]);
  const [allBadges, setAllBadges] = useState<BadgeRow[]>([]);
  const [viewingClassLevel, setViewingClassLevel] = useState<string>("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && profile) {
      if (!viewingClassLevel) setViewingClassLevel(profile.class_level);
    }
  }, [profile, authLoading]);

  useEffect(() => {
    if (viewingClassLevel && user) {
      fetchData();
    }
  }, [viewingClassLevel, user]);

  const fetchData = async () => {
    if (!user || !viewingClassLevel) return;
    setDataLoading(true);
    const [lessonsRes, progressRes, badgesRes, earnedRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("*")
        .eq("class_level", viewingClassLevel as any)
        .order("sort_order"),
      // FIX: filter by current student's id so we only get their own progress
      supabase
        .from("student_progress")
        .select("lesson_id")
        .eq("student_id", user.id)
        .eq("completed", true),
      supabase.from("badges").select("*"),
      supabase
        .from("student_badges")
        .select("badge_id, badges(id, name, description, icon, requirement_count, subject)")
        .eq("student_id", user.id),
    ]);

    setLessons((lessonsRes.data as LessonRow[]) ?? []);
    setProgress((progressRes.data as ProgressRow[]) ?? []);
    setAllBadges((badgesRes.data as BadgeRow[]) ?? []);
    const earned = (earnedRes.data ?? [])
      .map((e: any) => e.badges)
      .filter(Boolean);
    setEarnedBadges(earned);
    setDataLoading(false);
  };

  const getSubjectProgress = (subject: string) => {
    const subjectLessons = lessons.filter((l) => l.subject === subject);
    if (subjectLessons.length === 0) return 0;
    const completed = subjectLessons.filter((l) =>
      progress.some((p) => p.lesson_id === l.id)
    ).length;
    return Math.round((completed / subjectLessons.length) * 100);
  };

  const completedCount = progress.length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl font-heading">Loading...</div>
      </div>
    );
  }

  const headerContent = (
    <header className="bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="LearnQuest" className="h-8 w-auto" />
          <h1 className="text-2xl font-heading font-bold">LearnQuest</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="text-accent hover:text-accent/80"
            >
              <Shield className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
          {isAdmin && (
            <Select value={viewingClassLevel} onValueChange={setViewingClassLevel}>
              <SelectTrigger className="w-[110px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(classLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{profile?.display_name}</p>
            <p className="text-xs opacity-80">
              {classLabels[viewingClassLevel] ?? classLabels[profile?.class_level ?? ""] ?? ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-primary-foreground hover:text-accent"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );

  return (
    <Layout header={headerContent}>
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="subjects" className="space-y-6">
          <TabsList className="bg-card border">
            <TabsTrigger value="subjects" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              📚 My Subjects
            </TabsTrigger>
            <TabsTrigger value="trophies" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              🏆 Trophy Room
            </TabsTrigger>
          </TabsList>

          {/* Subjects Tab */}
          <TabsContent value="subjects">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(["science", "math", "english"] as const).map((subject) => {
                const config = subjectConfig[subject];
                const Icon = config.icon;
                const subjectLessons = lessons.filter((l) => l.subject === subject);
                const progressPct = getSubjectProgress(subject);

                return (
                  <Card
                    key={subject}
                    className="border-2 hover:shadow-xl transition-shadow cursor-pointer group"
                    onClick={() => navigate(`/subject/${subject}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${config.color} flex items-center justify-center`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-heading">{config.label}</CardTitle>
                          {dataLoading ? (
                            <Skeleton className="h-4 w-20 mt-1" />
                          ) : (
                            <p className="text-sm text-muted-foreground">{subjectLessons.length} lesson{subjectLessons.length !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {dataLoading ? (
                        <Skeleton className="h-3 w-full rounded-full" />
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">{progressPct}%</span>
                          </div>
                          <Progress value={progressPct} className="h-3" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Continue Learning */}
            {!dataLoading && lessons.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-heading font-bold mb-4">Continue Learning</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lessons.slice(0, 6).map((lesson) => {
                    const done = progress.some((p) => p.lesson_id === lesson.id);
                    const config = subjectConfig[lesson.subject];
                    return (
                      <Card
                        key={lesson.id}
                        className="border hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                            <config.icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">{config.label}</p>
                          </div>
                          {done && <Badge className="bg-accent text-accent-foreground text-xs flex-shrink-0">✓</Badge>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {!dataLoading && lessons.length === 0 && (
              <Card className="mt-6 border-dashed border-2">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-lg font-heading">No lessons yet for your class</p>
                  <p className="text-muted-foreground">Your teacher will add lessons soon!</p>
                </CardContent>
              </Card>
            )}

            {dataLoading && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Trophy Room Tab */}
          <TabsContent value="trophies">
            <div className="mb-6">
              <h2 className="text-2xl font-heading font-bold">🏆 Trophy Room</h2>
              <p className="text-muted-foreground">
                You've completed {completedCount} lesson{completedCount !== 1 ? "s" : ""}!
              </p>
            </div>

            {dataLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
              </div>
            ) : allBadges.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="p-8 text-center">
                  <p className="text-4xl mb-3">🏅</p>
                  <p className="text-lg font-heading">No badges available yet</p>
                  <p className="text-muted-foreground">Keep learning — badges will appear here!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {allBadges.map((badge) => {
                  const earned = earnedBadges.some((e) => e.id === badge.id);
                  return (
                    <Card
                      key={badge.id}
                      className={`text-center border-2 transition-all ${
                        earned ? "border-accent shadow-lg" : "opacity-50 grayscale"
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className={`text-4xl mb-2 ${earned ? "animate-trophy-bounce" : ""}`}>
                          {badge.icon}
                        </div>
                        <p className="font-heading font-semibold text-sm">{badge.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                        {earned ? (
                          <Badge className="mt-2 bg-accent text-accent-foreground text-xs">Earned!</Badge>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-2">
                            {badge.requirement_count} lesson{badge.requirement_count !== 1 ? "s" : ""} needed
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
}
