import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut } from '@/lib/supabase';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  ListChecks,
  LogOut,
  Menu,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { CandidateMetrics } from '@/components/CandidateMetrics';
import { StudentTutorialsView } from '@/components/learning/StudentTutorialsView';
import { cn } from '@/lib/utils';

interface AssignedAssessment {
  assignment_id: string;
  active_submission_id: string | null;
  question_count: number;
  available_until: string | null;
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  passing_percentage: number;
  latest_status: 'not_started' | 'in_progress' | 'completed';
}

interface TestResult {
  id: string;
  test_id: string;
  score: number;
  passed: boolean;
  created_at: string;
  tests: {
    title: string;
    passing_percentage: number;
    results_released: boolean;
  };
}

type CandidateView = 'dashboard' | 'learning' | 'tests' | 'results' | 'tutorials';
const getSubmissionLockKey = (submissionId: string) => `active_exam_submission_${submissionId}`;
const getSubmissionProgressKey = (submissionId: string) => `exam_progress_${submissionId}`;

const hasSubmissionLock = (submissionId: string | null) => {
  if (!submissionId) return false;
  try {
    const explicitLock = localStorage.getItem(getSubmissionLockKey(submissionId)) === '1';
    const hasProgressSnapshot = localStorage.getItem(getSubmissionProgressKey(submissionId)) !== null;
    return explicitLock || hasProgressSnapshot;
  } catch {
    return false;
  }
};

const isMissingRetryColumnError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes('remaining_attempts') ||
    message.includes('granted_attempts') ||
    (message.includes('column') && message.includes('does not exist'))
  );
};

export default function CandidateDashboard() {
  const [user, setUser] = useState<any>(null);
  const [assessments, setAssessments] = useState<AssignedAssessment[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [retakePermissions, setRetakePermissions] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeView, setActiveView] = useState<CandidateView>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const navItems: Array<{
    key: CandidateView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'learning', label: 'Learning Path', icon: BookOpen },
    { key: 'tests', label: 'Assigned Tests', icon: ListChecks },
    { key: 'results', label: 'Results', icon: Trophy },
    { key: 'tutorials', label: 'Tutorials', icon: PlayCircle },
  ];

  useEffect(() => {
    const initializeDashboard = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate('/auth');
        return;
      }

      setUser(currentUser);
      await Promise.all([
        fetchAssignedAssessments(currentUser.id),
        fetchTestResults(currentUser.id),
        fetchRetakePermissions(currentUser.id),
      ]);
      setLoading(false);
    };

    void initializeDashboard();
  }, [navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchAssignedAssessments = async (userId: string) => {
    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('test_assignments')
        .select('id, test_id, question_count, is_active, available_until, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        const message = assignmentsError.message || 'Failed to load assignments.';
        throw new Error(message);
      }

      const assignments = assignmentsData || [];
      if (assignments.length === 0) {
        setAssessments([]);
        return;
      }

      const testIds = Array.from(new Set(assignments.map((row) => row.test_id)));
      const assignmentIds = assignments.map((row) => row.id);

      const [{ data: testsData, error: testsError }, { data: submissionData, error: submissionsError }] =
        await Promise.all([
          supabase.from('tests').select('*').in('id', testIds),
          supabase
            .from('test_submissions')
            .select('id, assignment_id, status, created_at')
            .eq('user_id', userId)
            .in('assignment_id', assignmentIds)
            .order('created_at', { ascending: false }),
        ]);

      if (testsError) throw testsError;
      if (submissionsError) throw submissionsError;

      const testsById = new Map((testsData || []).map((test) => [test.id, test]));
      const latestSubmissionByAssignment = new Map<
        string,
        { id: string; assignment_id: string | null; status: string | null; created_at: string | null }
      >();

      (submissionData || []).forEach((row) => {
        if (!row.assignment_id) return;
        if (!latestSubmissionByAssignment.has(row.assignment_id)) {
          latestSubmissionByAssignment.set(row.assignment_id, row);
        }
      });

      const mapped = assignments
        .map((assignment) => {
          const test = testsById.get(assignment.test_id);
          if (!test) return null;

          const latest = latestSubmissionByAssignment.get(assignment.id);
          const latestStatus =
            latest?.status === 'completed'
              ? 'completed'
              : latest?.status === 'in_progress'
                ? 'in_progress'
                : 'not_started';

          return {
            assignment_id: assignment.id,
            active_submission_id: latest?.status === 'in_progress' ? latest.id : null,
            question_count: assignment.question_count,
            available_until: assignment.available_until || null,
            id: test.id,
            title: test.title,
            description: test.description || '',
            duration_minutes: test.duration_minutes,
            passing_percentage: test.passing_percentage,
            latest_status: latestStatus,
          } as AssignedAssessment;
        })
        .filter((value): value is AssignedAssessment => Boolean(value));

      setAssessments(mapped);
    } catch (error) {
      console.error('Error fetching assigned assessments:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      const lowerMessage = rawMessage.toLowerCase();
      const needsMigration =
        lowerMessage.includes('permission denied') ||
        lowerMessage.includes('does not exist') ||
        lowerMessage.includes('relation') ||
        lowerMessage.includes('schema');
      const description = needsMigration
        ? 'Assignments are not available yet. Please ask an admin to run the latest database migrations.'
        : 'Failed to load your assigned assessments.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const fetchTestResults = async (userId: string) => {
    try {
      const { data: submissionRows, error: submissionsError } = await supabase
        .from('test_submissions')
        .select('id, test_id, score, passed, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('score', 'is', null)
        .order('created_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      const rows = submissionRows || [];

      if (rows.length === 0) {
        setTestResults([]);
        return;
      }

      const testIds = Array.from(new Set(rows.map((row) => row.test_id).filter(Boolean)));
      const { data: releasedTests, error: testsError } = await supabase
        .from('tests')
        .select('id, title, passing_percentage, results_released')
        .in('id', testIds)
        .eq('results_released', true);

      if (testsError) throw testsError;

      const testsById = new Map((releasedTests || []).map((test) => [test.id, test]));
      const releasedResults = rows
        .filter((row) => row.test_id && testsById.has(row.test_id))
        .map((row) => ({
          id: row.id,
          test_id: row.test_id,
          score: Number(row.score || 0),
          passed: Boolean(row.passed),
          created_at: row.created_at || new Date().toISOString(),
          tests: testsById.get(row.test_id)!,
        })) as TestResult[];

      setTestResults(releasedResults);
    } catch (error) {
      console.error('Error fetching test results:', error);
    }
  };

  const fetchRetakePermissions = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('test_retake_permissions')
        .select('test_id, remaining_attempts')
        .eq('user_id', userId)
        .gt('remaining_attempts', 0);

      if (!error) {
        const next = new Map<string, number>();
        (data || []).forEach((row) => {
          const attempts = Number((row as { remaining_attempts?: number | null }).remaining_attempts || 0);
          if (attempts > 0) {
            next.set(row.test_id, attempts);
          }
        });
        setRetakePermissions(next);
        return;
      }

      if (isMissingRetryColumnError(error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('test_retake_permissions')
          .select('test_id')
          .eq('user_id', userId);

        if (legacyError) throw legacyError;

        const next = new Map<string, number>();
        (legacyData || []).forEach((row) => {
          next.set(row.test_id, 1);
        });
        setRetakePermissions(next);
        return;
      }

      throw error;
    } catch (error) {
      console.error('Error fetching retake permissions:', error);
      setRetakePermissions(new Map());
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const refreshRetakePermissions = () => {
      void fetchRetakePermissions(user.id);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRetakePermissions();
      }
    };

    window.addEventListener('focus', refreshRetakePermissions);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshRetakePermissions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, fetchRetakePermissions]);

  useEffect(() => {
    if (activeView !== 'tests' || !user?.id) return;
    void fetchRetakePermissions(user.id);
  }, [activeView, user?.id, fetchRetakePermissions]);

  const handleStartAssessment = (assessment: AssignedAssessment) => {
    navigate(`/exam/${assessment.id}?assignmentId=${assessment.assignment_id}`);
  };

  const getRemainingTimeMs = (availableUntil: string | null) => {
    if (!availableUntil) return null;
    const parsed = new Date(availableUntil);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, parsed.getTime() - nowMs);
  };

  const formatRemainingTime = (remainingMs: number | null) => {
    if (remainingMs === null) return 'No access deadline';
    if (remainingMs <= 0) return 'Window closed';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad2 = (value: number) => String(value).padStart(2, '0');
    return `${days}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  };

  const isAvailabilityExpired = (assessment: AssignedAssessment) => {
    const remaining = getRemainingTimeMs(assessment.available_until);
    return remaining !== null && remaining <= 0;
  };

  const getGrade = (score: number, passingPercentage: number) => {
    if (score < 50) return { grade: 'Not Yet', color: 'text-red-600', bg: 'bg-red-100' };
    if (score < passingPercentage) return { grade: 'Can Do Better', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { grade: 'Pass', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const getActionLabel = (
    status: AssignedAssessment['latest_status'],
    retakeAllowed: boolean,
    availabilityExpired: boolean,
    inProgressLockedElsewhere: boolean
  ) => {
    if (availabilityExpired && !retakeAllowed) return 'Assessment closed';
    if (inProgressLockedElsewhere) return 'Assessment in progress';
    if (status === 'in_progress') return 'Resume Assessment';
    if (status === 'completed') return retakeAllowed ? 'Start Retake' : 'Retake unavailable';
    return 'Start Assessment';
  };

  const getStatusLabel = (status: AssignedAssessment['latest_status']) => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'completed') return 'Completed';
    return 'Not Started';
  };

  const getStatusBadgeClasses = (status: AssignedAssessment['latest_status']) => {
    if (status === 'in_progress') {
      return 'border-amber-200 bg-amber-50 text-amber-800';
    }
    if (status === 'completed') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    }
    return 'border-slate-200 bg-slate-100 text-slate-700';
  };

  const dashboardStats = useMemo(() => {
    const inProgress = assessments.filter((assessment) => assessment.latest_status === 'in_progress').length;
    const completed = assessments.filter((assessment) => assessment.latest_status === 'completed').length;
    const avgScore =
      testResults.length > 0
        ? Math.round(testResults.reduce((sum, result) => sum + (result.score || 0), 0) / testResults.length)
        : 0;

    return {
      assigned: assessments.length,
      inProgress,
      completed,
      avgScore,
    };
  }, [assessments, testResults]);

  const completionRate =
    dashboardStats.assigned > 0
      ? Math.round((dashboardStats.completed / dashboardStats.assigned) * 100)
      : 0;
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Candidate';

  const renderDashboardView = () => (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-sidebar via-sidebar-accent to-primary text-white shadow-lg">
          <CardContent className="p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/70">Candidate Workspace</p>
                <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Welcome back, {userName}</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  Your dashboard now focuses on assigned assessments only. Start or resume any active test from your queue.
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-white/70" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">Assigned</p>
                <p className="mt-1 text-2xl font-bold">{dashboardStats.assigned}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">Completed</p>
                <p className="mt-1 text-2xl font-bold">{dashboardStats.completed}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">Completion</p>
                <p className="mt-1 text-2xl font-bold">{completionRate}%</p>
              </div>
            </div>
            <div className="mt-6">
              <Button
                className="bg-white text-sidebar hover:bg-white/90"
                onClick={() => setActiveView('tests')}
              >
                View Assigned Tests
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progress Pulse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall completion</span>
                <span className="font-medium text-foreground">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2.5" />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">Average Score</p>
              <p className="mt-1 text-2xl font-bold text-primary">{dashboardStats.avgScore}%</p>
            </div>
            <Button
              variant="outline"
              className="w-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => setActiveView('results')}
            >
              Open Results
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">Assigned Assessments</p>
              <ListChecks className="h-4 w-4 text-blue-700" />
            </div>
            <p className="mt-2 text-3xl font-bold text-blue-900">{dashboardStats.assigned}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-700">In Progress</p>
              <Clock className="h-4 w-4 text-amber-700" />
            </div>
            <p className="mt-2 text-3xl font-bold text-amber-900">{dashboardStats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-emerald-700">Completed</p>
              <Trophy className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-900">{dashboardStats.completed}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-indigo-700">Average Score</p>
              <Gauge className="h-4 w-4 text-indigo-700" />
            </div>
            <p className="mt-2 text-3xl font-bold text-indigo-900">{dashboardStats.avgScore}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Performance Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateMetrics />
        </CardContent>
      </Card>
    </div>
  );

  const renderLearningView = () => (
    <Card className="border border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BookOpen className="h-5 w-5 mr-2 text-primary" />
          My Learning Path
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-slate-50 to-blue-50 p-6">
          <p className="text-muted-foreground mb-4">
            Access your enrolled courses and track your learning progress.
          </p>
          <Button onClick={() => navigate('/learning-path')} className="bg-primary hover:bg-primary/90">
            View Learning Path
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderTestsView = () => (
    <Card className="border border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListChecks className="h-5 w-5 mr-2 text-primary" />
          Assigned Assessments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-700 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Assessment Instructions</h4>
              <p className="text-sm text-blue-800 mt-1">
                You can only access assessments assigned to you. Each assignment has a fixed number of random questions selected when you start.
              </p>
            </div>
          </div>
        </div>

        {assessments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No assessments assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {assessments.map((assessment) => (
              <div
                key={assessment.assignment_id}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {(() => {
                  const availabilityExpired = isAvailabilityExpired(assessment);
                  const remainingTime = getRemainingTimeMs(assessment.available_until);
                  const retriesLeft = retakePermissions.get(assessment.id) || 0;
                  const canRetake = retriesLeft > 0;
                  const canBypassExpiredWindow = availabilityExpired && canRetake;
                  const inProgressLockedElsewhere =
                    assessment.latest_status === 'in_progress' &&
                    Boolean(assessment.active_submission_id) &&
                    !hasSubmissionLock(assessment.active_submission_id);
                  const isRetakeBlocked =
                    assessment.latest_status === 'completed' && !canRetake;
                  const isAccessBlocked =
                    (availabilityExpired && !canBypassExpiredWindow) ||
                    isRetakeBlocked ||
                    inProgressLockedElsewhere;
                  const actionLabel = getActionLabel(
                    assessment.latest_status,
                    canRetake,
                    availabilityExpired,
                    inProgressLockedElsewhere
                  );
                  return (
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{assessment.title}</h3>
                    <p className="text-muted-foreground mt-1">{assessment.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-3">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1.5 text-primary" />
                        {assessment.duration_minutes} minutes
                      </div>
                      <div className="flex items-center">
                        <Target className="w-4 h-4 mr-1.5 text-primary" />
                        {assessment.passing_percentage}% to pass
                      </div>
                      <div className="flex items-center">
                        <ListChecks className="w-4 h-4 mr-1.5 text-primary" />
                        {assessment.question_count} questions
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1.5 text-primary" />
                        {formatRemainingTime(remainingTime)}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Badge variant="outline" className={cn('font-medium', getStatusBadgeClasses(assessment.latest_status))}>
                        {getStatusLabel(assessment.latest_status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    <Button
                      onClick={() => {
                        if (!isAccessBlocked) {
                          handleStartAssessment(assessment);
                        }
                      }}
                      disabled={isAccessBlocked}
                      className="bg-primary hover:bg-primary/90 w-full lg:w-auto"
                    >
                      {actionLabel}
                    </Button>
                    {availabilityExpired && !canBypassExpiredWindow && (
                      <span className="text-xs text-muted-foreground mt-2">
                        Assessment window has expired.
                      </span>
                    )}
                    {availabilityExpired && canBypassExpiredWindow && (
                      <span className="text-xs text-muted-foreground mt-2">
                        Retry granted. Start now to reopen the assessment window.
                      </span>
                    )}
                    {!availabilityExpired && isRetakeBlocked && (
                      <span className="text-xs text-muted-foreground mt-2">
                        Retake permission required.
                      </span>
                    )}
                    {!availabilityExpired && assessment.latest_status === 'completed' && canRetake && (
                      <span className="text-xs text-muted-foreground mt-2">
                        Retries left: {retriesLeft}
                      </span>
                    )}
                    {inProgressLockedElsewhere && (
                      <span className="text-xs text-muted-foreground mt-2">
                        This assessment is currently in progress on another device.
                      </span>
                    )}
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderResultsView = () => (
    <Card className="border border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="h-5 w-5 mr-2 text-primary" />
          Recent Test Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        {testResults.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No released test results available yet. Completed assessments remain hidden until an admin releases them.
          </p>
        ) : (
          <div className="space-y-4">
            {testResults.map((result) => {
              const grade = getGrade(result.score || 0, result.tests.passing_percentage);
              const progressValue = Math.max(0, Math.min(100, Number(result.score || 0)));

              return (
                <div key={result.id} className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <h3 className="text-lg font-semibold">{result.tests.title}</h3>
                    <Badge className={`${grade.bg} ${grade.color} border-none`}>{grade.grade}</Badge>
                  </div>
                  <Progress value={progressValue} className="h-2 mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{Math.round(Number(result.score || 0))}%</div>
                      <div className="text-xs text-muted-foreground mt-1">Score</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className={cn('text-2xl font-bold', result.passed ? 'text-green-700' : 'text-red-700')}>
                        {result.passed ? 'PASSED' : 'FAILED'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Result</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold text-slate-800">
                        {format(new Date(result.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Date Taken</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderView = () => {
    if (activeView === 'dashboard') return renderDashboardView();
    if (activeView === 'learning') return renderLearningView();
    if (activeView === 'tests') return renderTestsView();
    if (activeView === 'results') return renderResultsView();
    return (
      <Card className="border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlayCircle className="h-5 w-5 mr-2 text-primary" />
            Tutorials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentTutorialsView />
        </CardContent>
      </Card>
    );
  };

  const currentViewLabel = navItems.find((item) => item.key === activeView)?.label || 'Dashboard';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-base text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100">
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex h-screen">
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden',
            isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        <aside
          className={cn(
            'fixed md:sticky md:top-0 top-0 left-0 z-50 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col',
            isSidebarCollapsed ? 'md:w-16' : 'md:w-64',
            isMobileSidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full md:translate-x-0'
          )}
        >
          <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
            <div className={cn('flex items-center gap-3', isSidebarCollapsed && 'md:hidden')}>
              <div className="h-10 w-10 rounded-xl bg-white border border-sidebar-border/60 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Excelerate logo"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div>
                <h1 className="font-semibold text-lg text-sidebar-foreground">Excelerate</h1>
                <p className="text-xs text-sidebar-foreground/65">Candidate Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
            {!isSidebarCollapsed && (
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                Workspace
              </p>
            )}
            {navItems.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                className={cn(
                  'w-full justify-start text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  activeView === item.key && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
                  isSidebarCollapsed && 'md:px-2 md:justify-center'
                )}
                onClick={() => {
                  setActiveView(item.key);
                  setIsMobileSidebarOpen(false);
                }}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <item.icon className={cn('h-4 w-4', !isSidebarCollapsed && 'mr-2')} />
                {!isSidebarCollapsed && item.label}
              </Button>
            ))}
          </nav>

          {!isSidebarCollapsed && (
            <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
              <p className="text-xs uppercase tracking-wide text-sidebar-foreground/65">Today's Focus</p>
              <p className="mt-1 text-sm font-medium text-sidebar-foreground">
                {dashboardStats.inProgress > 0
                  ? `${dashboardStats.inProgress} assessment(s) in progress`
                  : 'No pending resume'}
              </p>
              <p className="mt-1 text-xs text-sidebar-foreground/70">
                Active assignments: {dashboardStats.assigned}
              </p>
            </div>
          )}

          <div className="p-3 border-t border-sidebar-border bg-sidebar">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isSidebarCollapsed && 'md:px-2 md:justify-center'
              )}
              onClick={async () => {
                const success = await signOut();
                if (success) {
                  toast({ title: 'Signed out successfully' });
                  navigate('/auth');
                }
              }}
              title={isSidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className={cn('h-4 w-4', !isSidebarCollapsed && 'mr-2')} />
                {!isSidebarCollapsed && 'Sign Out'}
              </Button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 h-screen overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            <div className="mb-6 rounded-2xl border border-border/70 bg-white/80 backdrop-blur shadow-sm">
              <div className="p-4 md:p-6">
                <div className="flex items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setIsMobileSidebarOpen(true)}
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidate Dashboard</p>
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">{currentViewLabel}</h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        Welcome back, {userName}.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs border border-border/70">
                      {assessments.length} active assignments
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">Use the sidebar to move between dashboard sections.</div>
              </div>
            </div>

            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
