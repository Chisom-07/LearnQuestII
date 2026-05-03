import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Shield, UserCheck, UserX, KeyRound,
  Copy, RefreshCw, Users, BookOpen, Activity, Pencil, Search,
} from "lucide-react";
import Layout from "@/components/Layout";

// ─── Constants ────────────────────────────────────────────────────────────────
const classLevels = [
  { value: "basic_1", label: "Basic 1" }, { value: "basic_2", label: "Basic 2" },
  { value: "basic_3", label: "Basic 3" }, { value: "basic_4", label: "Basic 4" },
  { value: "basic_5", label: "Basic 5" }, { value: "basic_6", label: "Basic 6" },
];
const classLabels: Record<string, string> = {
  basic_1: "Basic 1", basic_2: "Basic 2", basic_3: "Basic 3",
  basic_4: "Basic 4", basic_5: "Basic 5", basic_6: "Basic 6",
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Admin() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [lessons, setLessons] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [enrollmentCodes, setEnrollmentCodes] = useState<any[]>([]);
  const [loginActivity, setLoginActivity] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Lesson form
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonSubject, setLessonSubject] = useState("science");
  const [lessonClass, setLessonClass] = useState("basic_1");
  const [lessonUrl, setLessonUrl] = useState("");
  const [lessonNotes, setLessonNotes] = useState("");
  const [lessonAdding, setLessonAdding] = useState(false);

  // Lesson edit
  const [editLesson, setEditLesson] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Lesson filter
  const [lessonFilterSubject, setLessonFilterSubject] = useState("all");
  const [lessonFilterClass, setLessonFilterClass] = useState("all");

  // Student filter
  const [studentFilter, setStudentFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  // Dialogs
  const [resetPasswordStudent, setResetPasswordStudent] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<any | null>(null);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<any | null>(null);
  const [deleteCodeTarget, setDeleteCodeTarget] = useState<any | null>(null);
  const [grantAdminTarget, setGrantAdminTarget] = useState("");
  const [revokeAdminTarget, setRevokeAdminTarget] = useState<any | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<any | null>(null);

  // Enrollment codes
  const [codeClassLevel, setCodeClassLevel] = useState("basic_1");
  const [codeMaxUses, setCodeMaxUses] = useState("");
  const [codeExpiry, setCodeExpiry] = useState("");

  // Guard
  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/dashboard");
    if (isAdmin) fetchData();
  }, [isAdmin, authLoading]);

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    setDataLoading(true);
    const [lessonsRes, studentsRes, adminsRes, codesRes, activityRes] = await Promise.all([
      supabase.from("lessons").select("*").order("sort_order").order("created_at"),
      // FIX: fetch all profiles; deleted auth users won't appear but profile rows may linger
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*").eq("role", "admin" as any),
      supabase.from("enrollment_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("login_activity").select("*").order("logged_in_at", { ascending: false }).limit(100),
    ]);
    setLessons(lessonsRes.data ?? []);
    setStudents(studentsRes.data ?? []);
    setAdmins(adminsRes.data ?? []);
    setEnrollmentCodes(codesRes.data ?? []);
    setLoginActivity(activityRes.data ?? []);
    setDataLoading(false);
  };

  const callAdminAction = async (action: string, params: Record<string, any>): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action, ...params },
    });
    if (error) { toast.error(error.message); return false; }
    if (data?.error) { toast.error(data.error); return false; }
    return true;
  };

  // ─── Lesson actions ─────────────────────────────────────────────────────────
  const addLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !lessonUrl.trim()) { toast.error("Title and URL are required"); return; }
    setLessonAdding(true);
    // Sort order: max existing + 1 for same subject+class
    const maxOrder = lessons
      .filter(l => l.subject === lessonSubject && l.class_level === lessonClass)
      .reduce((m, l) => Math.max(m, l.sort_order ?? 0), 0);
    const { error } = await supabase.from("lessons").insert({
      title: lessonTitle.trim(),
      subject: lessonSubject as any,
      class_level: lessonClass as any,
      embed_url: lessonUrl.trim(),
      notes: lessonNotes.trim() || null,
      sort_order: maxOrder + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Lesson added!");
      setLessonTitle(""); setLessonUrl(""); setLessonNotes("");
      fetchData();
    }
    setLessonAdding(false);
  };

  const saveEditLesson = async () => {
    if (!editLesson || !editTitle.trim() || !editUrl.trim()) { toast.error("Title and URL are required"); return; }
    setEditSaving(true);
    const { error } = await supabase.from("lessons").update({
      title: editTitle.trim(),
      embed_url: editUrl.trim(),
      notes: editNotes.trim() || null,
    }).eq("id", editLesson.id);
    if (error) toast.error(error.message);
    else { toast.success("Lesson updated!"); setEditLesson(null); fetchData(); }
    setEditSaving(false);
  };

  const confirmDeleteLesson = async () => {
    if (!deleteLessonTarget) return;
    const { error } = await supabase.from("lessons").delete().eq("id", deleteLessonTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Lesson deleted"); fetchData(); }
    setDeleteLessonTarget(null);
  };

  // ─── Student actions ─────────────────────────────────────────────────────────
  const enrollStudent = async (userId: string, classLevelVal: string) => {
    const ok = await callAdminAction("update_class", {
      user_id: userId, class_level: classLevelVal, enrollment_status: "enrolled",
    });
    if (ok) { toast.success("Student enrolled!"); fetchData(); }
  };

  const moveStudent = async (userId: string, classLevelVal: string) => {
    const ok = await callAdminAction("update_class", { user_id: userId, class_level: classLevelVal });
    if (ok) { toast.success("Student moved!"); fetchData(); }
  };

  const confirmRemoveFromClass = async () => {
    if (!removeStudentTarget) return;
    const ok = await callAdminAction("remove_from_class", { user_id: removeStudentTarget.user_id });
    if (ok) { toast.success("Student removed from class"); fetchData(); }
    setRemoveStudentTarget(null);
  };

  const toggleDeactivate = async (student: any) => {
    const ok = await callAdminAction("deactivate_student", {
      user_id: student.user_id, deactivate: student.is_active,
    });
    if (ok) {
      toast.success(student.is_active ? "Student deactivated" : "Student reactivated");
      fetchData();
    }
  };

  const confirmDeleteStudent = async () => {
    if (!deleteStudentTarget) return;
    // Delete auth user (via admin action), then profile cascade
    const ok = await callAdminAction("delete_user", { user_id: deleteStudentTarget.user_id });
    if (ok) {
      toast.success("Student account deleted");
      // FIX: immediately remove from local state so admin sees it gone instantly
      setStudents(prev => prev.filter(s => s.user_id !== deleteStudentTarget.user_id));
    }
    setDeleteStudentTarget(null);
  };

  const resetPassword = async () => {
    if (!resetPasswordStudent || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    const ok = await callAdminAction("reset_password", {
      user_id: resetPasswordStudent.user_id, new_password: newPassword,
    });
    if (ok) {
      toast.success("Password reset successfully");
      setResetPasswordStudent(null); setNewPassword("");
    }
  };

  // ─── Enrollment code actions ─────────────────────────────────────────────────
  const createEnrollmentCode = async () => {
    if (!user) return;
    const code = generateCode();
    const insertData: any = {
      code,
      class_level: codeClassLevel as any,
      created_by: user.id,
      max_uses: codeMaxUses ? parseInt(codeMaxUses) : null,
    };
    if (codeExpiry) insertData.expires_at = new Date(codeExpiry).toISOString();
    const { error } = await supabase.from("enrollment_codes").insert(insertData);
    if (error) toast.error(error.message);
    else {
      toast.success(`Code created: ${code}`);
      setCodeMaxUses(""); setCodeExpiry("");
      fetchData();
    }
  };

  const confirmDeleteCode = async () => {
    if (!deleteCodeTarget) return;
    const { error } = await supabase.from("enrollment_codes").delete().eq("id", deleteCodeTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Code deleted"); fetchData(); }
    setDeleteCodeTarget(null);
  };

  // ─── Admin role actions ──────────────────────────────────────────────────────
  const confirmGrantAdmin = async () => {
    if (!grantAdminTarget) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: grantAdminTarget, role: "admin" as any });
    if (error) toast.error(error.message);
    else { toast.success("Admin role granted!"); setGrantAdminTarget(""); fetchData(); }
  };

  const confirmRevokeAdmin = async () => {
    if (!revokeAdminTarget) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", revokeAdminTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Admin role removed"); fetchData(); }
    setRevokeAdminTarget(null);
  };

  // ─── Derived lists ───────────────────────────────────────────────────────────
  const adminUserIds = new Set(admins.map((a) => a.user_id));

  const filteredStudents = students.filter((s) => {
    if (adminUserIds.has(s.user_id)) return false;
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      if (!s.display_name?.toLowerCase().includes(q)) return false;
    }
    if (studentFilter === "all") return true;
    if (studentFilter === "pending") return s.enrollment_status === "pending";
    if (studentFilter === "enrolled") return s.enrollment_status === "enrolled";
    if (studentFilter === "removed") return s.enrollment_status === "removed";
    if (studentFilter === "inactive") return !s.is_active;
    return s.class_level === studentFilter;
  });

  const filteredLessons = lessons.filter((l) => {
    if (lessonFilterSubject !== "all" && l.subject !== lessonFilterSubject) return false;
    if (lessonFilterClass !== "all" && l.class_level !== lessonFilterClass) return false;
    return true;
  });

  // ─── Header ──────────────────────────────────────────────────────────────────
  const headerContent = (
    <header className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate("/dashboard")}
          className="text-primary-foreground hover:text-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-heading font-bold">Admin Panel</h1>
        <Button
          variant="ghost" size="sm"
          onClick={fetchData}
          className="ml-auto text-primary-foreground hover:text-accent"
          disabled={dataLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${dataLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </header>
  );

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse font-heading text-xl">Loading...</div>
    </div>
  );

  return (
    <Layout header={headerContent}>
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="students"><Users className="w-4 h-4 mr-1" /> Students</TabsTrigger>
            <TabsTrigger value="enrollment"><KeyRound className="w-4 h-4 mr-1" /> Codes</TabsTrigger>
            <TabsTrigger value="lessons"><BookOpen className="w-4 h-4 mr-1" /> Lessons</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-1" /> Activity</TabsTrigger>
            <TabsTrigger value="admins"><Shield className="w-4 h-4 mr-1" /> Admins</TabsTrigger>
          </TabsList>

          {/* ═══ STUDENTS TAB ═══════════════════════════════════════════════════ */}
          <TabsContent value="students" className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-9 w-[180px]"
                />
              </div>
              {/* Filter */}
              <Select value={studentFilter} onValueChange={setStudentFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="pending">⏳ Pending</SelectItem>
                  <SelectItem value="enrolled">✅ Enrolled</SelectItem>
                  <SelectItem value="removed">🚫 Removed</SelectItem>
                  <SelectItem value="inactive">🔒 Deactivated</SelectItem>
                  {classLevels.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="ml-auto">{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</Badge>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead className="hidden sm:table-cell">Active</TableHead>
                        <TableHead className="hidden md:table-cell">Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dataLoading ? (
                        [...Array(4)].map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(6)].map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                            No students found
                          </TableCell>
                        </TableRow>
                      ) : filteredStudents.map((s) => (
                        <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-medium min-w-[120px]">{s.display_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              s.enrollment_status === "enrolled" ? "default"
                              : s.enrollment_status === "pending" ? "secondary"
                              : "destructive"
                            }>
                              {s.enrollment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={s.class_level || "basic_1"}
                              onValueChange={(val) => {
                                if (s.enrollment_status === "enrolled") moveStudent(s.user_id, val);
                                else enrollStudent(s.user_id, val);
                              }}
                            >
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {classLevels.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {s.is_active
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Active</Badge>
                              : <Badge variant="destructive">Off</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end flex-wrap">
                              {s.enrollment_status !== "enrolled" && (
                                <Button size="sm" variant="outline" className="text-xs h-7"
                                  onClick={() => enrollStudent(s.user_id, s.class_level || "basic_1")}>
                                  <UserCheck className="w-3 h-3 mr-1" /> Enroll
                                </Button>
                              )}
                              {s.enrollment_status === "enrolled" && (
                                <Button size="sm" variant="outline" className="text-xs h-7"
                                  onClick={() => setRemoveStudentTarget(s)}>
                                  <UserX className="w-3 h-3 mr-1" /> Remove
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => toggleDeactivate(s)}>
                                {s.is_active ? "Deactivate" : "Reactivate"}
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => { setResetPasswordStudent(s); setNewPassword(""); }}
                                title="Reset password">
                                <KeyRound className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteStudentTarget(s)}
                                title="Delete account">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ENROLLMENT CODES TAB ═══════════════════════════════════════════ */}
          <TabsContent value="enrollment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Create Enrollment Code</CardTitle>
                <CardDescription>Students use this code to self-enroll into a class</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={codeClassLevel} onValueChange={setCodeClassLevel}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {classLevels.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Uses <span className="text-muted-foreground">(optional)</span></Label>
                    <Input type="number" value={codeMaxUses} onChange={(e) => setCodeMaxUses(e.target.value)}
                      placeholder="Unlimited" className="w-[120px]" min="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires <span className="text-muted-foreground">(optional)</span></Label>
                    <Input type="date" value={codeExpiry} onChange={(e) => setCodeExpiry(e.target.value)}
                      className="w-[160px]" min={new Date().toISOString().split("T")[0]} />
                  </div>
                  <Button onClick={createEnrollmentCode} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Plus className="w-4 h-4 mr-1" /> Generate Code
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-heading">Enrollment Codes</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataLoading ? (
                      <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ) : enrollmentCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No enrollment codes yet</TableCell>
                      </TableRow>
                    ) : enrollmentCodes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-bold tracking-widest text-sm bg-muted px-2 py-1 rounded">{c.code}</code>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{classLabels[c.class_level] || c.class_level}</TableCell>
                        <TableCell>{c.times_used}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? "default" : "secondary"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCodeTarget(c)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ LESSONS TAB ════════════════════════════════════════════════════ */}
          <TabsContent value="lessons" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-heading">Add New Lesson</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={addLesson} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="Introduction to Plants" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={lessonSubject} onValueChange={setLessonSubject}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="science">Science</SelectItem>
                        <SelectItem value="math">Mathematics</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class Level</Label>
                    <Select value={lessonClass} onValueChange={setLessonClass}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {classLevels.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Embed URL</Label>
                    <Input value={lessonUrl} onChange={(e) => setLessonUrl(e.target.value)}
                      placeholder="https://view.genially.com/..." required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={lessonNotes} onChange={(e) => setLessonNotes(e.target.value)}
                      placeholder="Key points for students..." />
                  </div>
                  <Button type="submit" disabled={lessonAdding}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 md:col-span-1">
                    <Plus className="w-4 h-4 mr-1" /> {lessonAdding ? "Adding..." : "Add Lesson"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lesson filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={lessonFilterSubject} onValueChange={setLessonFilterSubject}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="science">Science</SelectItem>
                  <SelectItem value="math">Mathematics</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
              <Select value={lessonFilterClass} onValueChange={setLessonFilterClass}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classLevels.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="ml-auto">{filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""}</Badge>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataLoading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(5)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredLessons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No lessons found</TableCell>
                      </TableRow>
                    ) : filteredLessons.map((l, i) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{l.title}</TableCell>
                        <TableCell className="capitalize">{l.subject}</TableCell>
                        <TableCell>{classLabels[l.class_level] || l.class_level}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon"
                              onClick={() => { setEditLesson(l); setEditTitle(l.title); setEditUrl(l.embed_url); setEditNotes(l.notes || ""); }}
                              title="Edit lesson">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteLessonTarget(l)} title="Delete lesson">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ACTIVITY TAB ═══════════════════════════════════════════════════ */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Login Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="hidden md:table-cell">Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataLoading ? (
                      [...Array(4)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(3)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : loginActivity.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No activity yet</TableCell>
                      </TableRow>
                    ) : loginActivity.map((a) => {
                      const student = students.find((s) => s.user_id === a.user_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{student?.display_name || a.user_id.slice(0, 8) + "…"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(a.logged_in_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                            {a.user_agent?.slice(0, 60) || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ADMINS TAB ═════════════════════════════════════════════════════ */}
          <TabsContent value="admins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Grant Admin Role</CardTitle>
                <CardDescription>Choose carefully — admins have full access to this panel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Select value={grantAdminTarget} onValueChange={setGrantAdminTarget}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a student..." />
                    </SelectTrigger>
                    <SelectContent>
                      {students
                        .filter((s) => !adminUserIds.has(s.user_id))
                        .map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.display_name || s.user_id}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={!grantAdminTarget}
                    onClick={() => {
                      if (grantAdminTarget) {
                        const name = students.find(s => s.user_id === grantAdminTarget)?.display_name || "this user";
                        if (window.confirm(`Grant admin role to ${name}? They will have full access to the admin panel.`)) {
                          confirmGrantAdmin();
                        }
                      }
                    }}
                  >
                    <Shield className="w-4 h-4 mr-1" /> Grant Admin
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-heading">Current Admins</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((a) => {
                      const profile = students.find((s) => s.user_id === a.user_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{profile?.display_name || a.user_id}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setRevokeAdminTarget(a)}
                              className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4 mr-1" /> Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── All Confirmation Dialogs ──────────────────────────────────────── */}

      {/* Reset Password */}
      <Dialog open={!!resetPasswordStudent} onOpenChange={(o) => !o && setResetPasswordStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for <strong>{resetPasswordStudent?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters" minLength={6} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordStudent(null)}>Cancel</Button>
            <Button onClick={resetPassword} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student */}
      <Dialog open={!!deleteStudentTarget} onOpenChange={(o) => !o && setDeleteStudentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive">Delete Student Account</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteStudentTarget?.display_name}</strong>'s account and all their data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStudentTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteStudent}>Yes, Delete Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove from class */}
      <Dialog open={!!removeStudentTarget} onOpenChange={(o) => !o && setRemoveStudentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Remove from Class</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeStudentTarget?.display_name}</strong> from their class? They will be marked as removed and lose dashboard access until re-enrolled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveStudentTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveFromClass}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson */}
      <Dialog open={!!deleteLessonTarget} onOpenChange={(o) => !o && setDeleteLessonTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Delete Lesson</DialogTitle>
            <DialogDescription>
              Permanently delete "<strong>{deleteLessonTarget?.title}</strong>"? Student progress on this lesson will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLessonTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteLesson}>Delete Lesson</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson */}
      <Dialog open={!!editLesson} onOpenChange={(o) => !o && setEditLesson(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Lesson</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Embed URL</Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Key points..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLesson(null)}>Cancel</Button>
            <Button onClick={saveEditLesson} disabled={editSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Code */}
      <Dialog open={!!deleteCodeTarget} onOpenChange={(o) => !o && setDeleteCodeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Delete Enrollment Code</DialogTitle>
            <DialogDescription>
              Delete code <code className="font-mono">{deleteCodeTarget?.code}</code>? Students will no longer be able to use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCodeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteCode}>Delete Code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Admin */}
      <Dialog open={!!revokeAdminTarget} onOpenChange={(o) => !o && setRevokeAdminTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Revoke Admin Role</DialogTitle>
            <DialogDescription>
              Remove admin access from <strong>{students.find(s => s.user_id === revokeAdminTarget?.user_id)?.display_name || "this user"}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeAdminTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRevokeAdmin}>Revoke Admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
