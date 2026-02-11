
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableHead, TableRow, TableHeader, TableCell, TableBody, Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { TestSubmission } from '@/lib/supabase';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Loader2, FileDown, Eye, EyeOff, Users, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';

interface EnhancedTestSubmission extends Omit<TestSubmission, 'test'> {
  user?: {
    id: string;
    full_name: string;
    email: string;
    unit: string;
  };
  test?: {
    id: string;
    title: string;
    passing_percentage: number;
    results_released: boolean;
    test_type: string | null;
  };
  violations_count: number;
  attempt_number?: number;
  attempt_count?: number;
  media_violation_count?: number;
}

interface UnitPerformance {
  unit: string;
  totalSubmissions: number;
  passedSubmissions: number;
  averageScore: number;
  passRate: number;
}

interface RecentActivity {
  id: string;
  user_name: string;
  test_title: string;
  date: string;
  score: number;
  passed: boolean;
}

function formatDateTimeValue(
  value: string | null | undefined,
  pattern = 'MMM d, yyyy HH:mm'
) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return format(parsed, pattern);
}

const mediaViolationTypes = new Set([
  'proctor_permission_denied',
  'camera_missing',
  'camera_lost',
  'no_face_detected',
  'multiple_faces_detected',
  'mic_muted_or_blocked',
  'sustained_speech_detected',
]);

const countMediaViolations = (violations: unknown) => {
  if (!Array.isArray(violations)) return 0;
  return violations.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const type = (entry as Record<string, unknown>).type;
    return typeof type === 'string' && mediaViolationTypes.has(type);
  }).length;
};

const formatConsent = (consent: string | null | undefined) => {
  if (!consent) return 'Unknown';
  if (consent === 'granted') return 'Granted';
  if (consent === 'denied') return 'Denied';
  if (consent === 'unsupported') return 'Unsupported';
  return 'Unknown';
};

export default function Results() {
  const [submissions, setSubmissions] = useState<EnhancedTestSubmission[]>([]);
  const [unitPerformance, setUnitPerformance] = useState<UnitPerformance[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [releasingAll, setReleasingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchUserAndSubmissions() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          navigate('/auth');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', sessionData.session.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user role:', userError);
        } else {
          setUserRole(userData?.role || null);
        }

        console.log("User role:", userData?.role);

        const isAdmin = userData?.role === 'admin';
        const baseQuery = supabase
          .from('test_submissions')
          .select(
            'id, assignment_id, test_id, user_id, start_time, end_time, created_at, score, passed, status, violations_count, violations, auto_submit, proctoring_enabled, proctoring_consent'
          )
          .eq('status', 'completed')
          .not('score', 'is', null)
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          baseQuery.eq('user_id', sessionData.session.user.id);
        }

        const { data, error } = await baseQuery;

        if (error) {
          console.error('Error fetching submissions:', error);
          throw new Error(error.message);
        }

        const rawSubmissions = data || [];
        const testIds = Array.from(
          new Set(rawSubmissions.map((submission) => submission.test_id).filter(Boolean))
        ) as string[];
        const userIds = Array.from(
          new Set(rawSubmissions.map((submission) => submission.user_id).filter(Boolean))
        ) as string[];

        const [{ data: testsData, error: testsError }, { data: usersData, error: usersError }] =
          await Promise.all([
            testIds.length > 0
              ? supabase
                  .from('tests')
                  .select('id, title, passing_percentage, results_released, test_type')
                  .in('id', testIds)
              : Promise.resolve({ data: [], error: null }),
            userIds.length > 0
              ? supabase
                  .from('users')
                  .select('id, full_name, email, unit')
                  .in('id', userIds)
              : Promise.resolve({ data: [], error: null }),
          ]);

        if (testsError) {
          console.error('Error fetching tests:', testsError);
        }
        if (usersError) {
          console.error('Error fetching users:', usersError);
        }

        const testsById = new Map((testsData || []).map((test) => [test.id, test]));
        const usersById = new Map((usersData || []).map((user) => [user.id, user]));

        const processedSubmissions = rawSubmissions.map((submission) => ({
          ...submission,
          user: submission.user_id ? usersById.get(submission.user_id) : undefined,
          test: submission.test_id ? testsById.get(submission.test_id) : undefined,
          violations_count:
            submission.violations_count ??
            (submission.violations ? submission.violations.length : 0),
          media_violation_count: countMediaViolations(submission.violations),
        }));

        const releasedSubmissions = isAdmin
          ? processedSubmissions
          : processedSubmissions.filter((submission) => submission.test?.results_released);

        const attemptOrderMap = new Map<string, string[]>();
        const sortedForAttempts = [...releasedSubmissions].sort((a, b) => {
          const aTime = a.start_time || a.created_at || '';
          const bTime = b.start_time || b.created_at || '';
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        });

        sortedForAttempts.forEach((submission) => {
          if (!submission.user_id || !submission.test_id) return;
          const key = `${submission.user_id}:${submission.test_id}`;
          if (!attemptOrderMap.has(key)) {
            attemptOrderMap.set(key, []);
          }
          attemptOrderMap.get(key)?.push(submission.id);
        });

        const attemptLookup = new Map<string, { attempt: number; total: number }>();
        attemptOrderMap.forEach((ids) => {
          ids.forEach((id, index) => {
            attemptLookup.set(id, { attempt: index + 1, total: ids.length });
          });
        });

        const submissionsWithAttempts = releasedSubmissions.map((submission) => {
          const attemptInfo = attemptLookup.get(submission.id);
          return {
            ...submission,
            attempt_number: attemptInfo?.attempt || 1,
            attempt_count: attemptInfo?.total || 1,
          };
        }) as EnhancedTestSubmission[];

        setSubmissions(submissionsWithAttempts);

        if (isAdmin) {
          const unitStats = calculateUnitPerformance(submissionsWithAttempts);
          setUnitPerformance(unitStats);
          const activity = calculateRecentActivity(submissionsWithAttempts);
          setRecentActivity(activity);
        } else {
          setUnitPerformance([]);
          setRecentActivity([]);
        }
      } catch (err) {
        console.error('Error fetching submissions:', err);
        toast({
          title: "Error fetching results",
          description: "Failed to load test results. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }

    fetchUserAndSubmissions();
  }, [navigate, toast]);

  const calculateUnitPerformance = (submissions: EnhancedTestSubmission[]): UnitPerformance[] => {
    const unitStats: Record<string, { total: number; passed: number; scores: number[] }> = {};
    
    submissions.forEach(submission => {
      if (!submission.user?.unit || submission.status !== 'completed') return;
      
      const unit = submission.user.unit;
      if (!unitStats[unit]) {
        unitStats[unit] = { total: 0, passed: 0, scores: [] };
      }
      
      unitStats[unit].total++;
      if (submission.passed) unitStats[unit].passed++;
      if (submission.score !== null) unitStats[unit].scores.push(Number(submission.score));
    });
    
    return Object.entries(unitStats).map(([unit, stats]) => ({
      unit,
      totalSubmissions: stats.total,
      passedSubmissions: stats.passed,
      averageScore: stats.scores.length > 0 
        ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
        : 0,
      passRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
    })).sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  };

  const calculateRecentActivity = (submissions: EnhancedTestSubmission[]): RecentActivity[] => {
    return submissions
      .filter(s => s.status === 'completed' && s.user && s.test)
      .slice(0, 10)
      .map(submission => ({
        id: submission.id,
        user_name: submission.user?.full_name || 'Unknown',
        test_title: submission.test?.title || 'Unknown Test',
        date: submission.end_time || submission.created_at || submission.start_time || '',
        score: Number(submission.score || 0),
        passed: Boolean(submission.passed)
      }));
  };

  const formatActivityDate = (value: string) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return format(parsed, 'MMM d, yyyy');
  };

  const toggleResultRelease = async (testId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tests')
        .update({ results_released: !currentStatus })
        .eq('id', testId);

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(sub => 
        sub.test_id === testId && sub.test
          ? { ...sub, test: { ...sub.test, results_released: !currentStatus } }
          : sub
      ));

      toast({
        title: "Results Updated",
        description: `Test results have been ${!currentStatus ? 'released' : 'hidden'} for candidates.`,
      });
    } catch (error) {
      console.error('Error toggling result release:', error);
      toast({
        title: "Error",
        description: "Failed to update result release status.",
        variant: "destructive"
      });
    }
  };

  const releaseAllResults = async () => {
    setReleasingAll(true);
    try {
      // Get all unique test IDs from submissions
      const testIds = [...new Set(submissions.map(s => s.test_id).filter(Boolean))];
      
      if (testIds.length === 0) {
        toast({
          title: "No Tests Found",
          description: "No tests found to release results for.",
          variant: "destructive"
        });
        return;
      }

      // Update all tests to release results
      const { error } = await supabase
        .from('tests')
        .update({ results_released: true })
        .in('id', testIds);

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(sub => ({
        ...sub,
        test: sub.test ? { ...sub.test, results_released: true } : sub.test
      })));

      toast({
        title: "All Results Released",
        description: `Results for ${testIds.length} tests have been released to all candidates.`,
      });
    } catch (error) {
      console.error('Error releasing all results:', error);
      toast({
        title: "Error",
        description: "Failed to release all results.",
        variant: "destructive"
      });
    } finally {
      setReleasingAll(false);
    }
  };

  const normalizeSubject = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : 'Unassigned';
  };

  const testOptions = useMemo(() => {
    const seen = new Map<string, string>();
    submissions.forEach((submission) => {
      if (submission.test?.id && submission.test?.title) {
        seen.set(submission.test.id, submission.test.title);
      }
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [submissions]);

  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    submissions.forEach((submission) => {
      if (submission.test) {
        seen.add(normalizeSubject(submission.test.test_type));
      }
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return submissions.filter((submission) => {
      if (selectedTestId !== 'all' && submission.test?.id !== selectedTestId) {
        return false;
      }
      if (selectedSubject !== 'all') {
        const subject = normalizeSubject(submission.test?.test_type);
        if (subject !== selectedSubject) return false;
      }
      if (!query) return true;
      const name = submission.user?.full_name?.toLowerCase() || '';
      const email = submission.user?.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    });
  }, [submissions, searchQuery, selectedTestId, selectedSubject]);

  const tabbedSubmissions = useMemo(() => {
    if (activeTab === 'passed') return filteredSubmissions.filter((s) => s.passed);
    if (activeTab === 'failed') return filteredSubmissions.filter((s) => !s.passed);
    return filteredSubmissions;
  }, [filteredSubmissions, activeTab]);

  // Generate CSV of all test results
  const downloadResultsCSV = async () => {
    if (!tabbedSubmissions.length || !userRole || userRole !== 'admin') {
      toast({
        title: "Download failed",
        description: "You don't have permission or there are no results to download.",
        variant: "destructive"
      });
      return;
    }
    
    setDownloading(true);
    
    try {
      const slugify = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      const selectedTestTitle =
        selectedTestId !== 'all'
          ? testOptions.find((test) => test.id === selectedTestId)?.title
          : null;

      const baseName = selectedTestTitle ? `results-${slugify(selectedTestTitle)}` : 'results-all';

      // Define CSV headers
      const headers = [
        'Test Title',
        'Candidate Name',
        'Email',
        'Submitted At',
        'Score',
        'Status',
        'Attempt',
        'Violations (count)',
        'Proctoring Consent',
        'Proctor Flags (count)'
      ].join(',');
      
      // Generate CSV rows
      const rows = tabbedSubmissions.map(submission => {
        const submittedAt = submission.end_time || submission.created_at || submission.start_time;
        const csvSubmittedAt = formatDateTimeValue(submittedAt, 'yyyy-MM-dd HH:mm:ss');
        const attemptLabel = submission.attempt_count
          ? `${submission.attempt_number || 1}/${submission.attempt_count}`
          : `${submission.attempt_number || 1}`;
        const values = [
          `"${submission.test?.title || 'Unknown Test'}"`,
          `"${submission.user?.full_name || 'Unknown'}"`,
          `"${submission.user?.email || ''}"`,
          `"${csvSubmittedAt === 'N/A' ? '' : csvSubmittedAt}"`,
          `"${typeof submission.score === 'number' ? Math.round(submission.score) + '%' : 'N/A'}"`,
          `"${submission.passed ? 'Passed' : 'Failed'}"`,
          `"${attemptLabel}"`,
          `"${submission.violations_count || 0}"`,
          `"${formatConsent(submission.proctoring_consent)}"`,
          `"${submission.media_violation_count || 0}"`
        ].join(',');
        return values;
      }).join('\n');
      
      // Combine headers and rows
      const csv = `${headers}\n${rows}`;
      
      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${baseName}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download successful",
        description: "Test results have been downloaded as CSV.",
      });
    } catch (error) {
      console.error('Error downloading results:', error);
      toast({
        title: "Download failed",
        description: "An error occurred while generating the CSV file.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading results...</span>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Test Results</h1>
        <div className="flex gap-3">
          {userRole === 'admin' && (
            <>
              <Button 
                onClick={releaseAllResults} 
                variant="default"
                disabled={releasingAll}
                className="flex items-center gap-2"
              >
                {releasingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Release All Results
              </Button>
              <Button 
                onClick={downloadResultsCSV} 
                variant="outline"
                disabled={downloading || !tabbedSubmissions.length}
                className="flex items-center gap-2"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download CSV
              </Button>
            </>
          )}
          {userRole !== 'admin' && (
            <Button onClick={() => navigate('/')} variant="outline">
              Back to Home
            </Button>
          )}
        </div>
      </div>

      {/* Admin-only Performance Overview */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Performance by Unit */}
          <Card className="h-[460px]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Performance by Unit/Department
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[380px] overflow-y-auto pr-2">
              {unitPerformance.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No unit data available</p>
              ) : (
                <div className="space-y-3">
                  {unitPerformance.map((unit) => (
                    <div key={unit.unit} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{unit.unit || 'Unassigned'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {unit.totalSubmissions} submissions - {unit.passRate}% pass rate
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{unit.averageScore}%</div>
                        <div className="text-sm text-muted-foreground">avg score</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Recent Test Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{activity.user_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {activity.test_title} - {formatActivityDate(activity.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={activity.passed ? "default" : "destructive"}>
                          {activity.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by staff name or email..."
                className="pl-8"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={selectedTestId} onValueChange={setSelectedTestId}>
              <SelectTrigger className="w-full lg:w-[240px]">
                <SelectValue placeholder="Filter by test" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tests</SelectItem>
                {testOptions.map((test) => (
                  <SelectItem key={test.id} value={test.id}>
                    {test.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjectOptions.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Results</TabsTrigger>
          <TabsTrigger value="passed">Passed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ResultsTable 
            submissions={filteredSubmissions} 
            isAdmin={userRole === 'admin'}
            onToggleRelease={toggleResultRelease}
          />
        </TabsContent>
        
        <TabsContent value="passed">
          <ResultsTable 
            submissions={filteredSubmissions.filter(s => s.passed)} 
            isAdmin={userRole === 'admin'}
            onToggleRelease={toggleResultRelease}
          />
        </TabsContent>
        
        <TabsContent value="failed">
          <ResultsTable 
            submissions={filteredSubmissions.filter(s => !s.passed)} 
            isAdmin={userRole === 'admin'}
            onToggleRelease={toggleResultRelease}
          />
        </TabsContent>
      </Tabs>
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Results Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
              title="Total Submissions" 
              value={submissions.length} 
            />
            <StatCard 
              title="Pass Rate" 
              value={`${Math.round((submissions.filter(s => s.passed).length / (submissions.length || 1)) * 100)}%`}
            />
            {userRole === 'admin' && (
              <StatCard 
                title="Average Score" 
                value={`${Math.round(submissions.reduce((acc, s) => acc + (Number(s.score || 0)), 0) / (submissions.length || 1))}%`}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ResultsTableProps {
  submissions: EnhancedTestSubmission[];
  isAdmin: boolean;
  onToggleRelease: (testId: string, currentStatus: boolean) => void;
}

function ResultsTable({ submissions, isAdmin, onToggleRelease }: ResultsTableProps) {
  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No results found.
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                {isAdmin && <TableHead>User</TableHead>}
                <TableHead>Submitted At</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Violations (count)</TableHead>
                <TableHead>Proctoring</TableHead>
                <TableHead>Proctor Flags</TableHead>
                {isAdmin && <TableHead>Release Results</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    {submission.test?.title || 'Unknown Test'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {submission.user?.full_name || 'Unknown'} 
                      <div className="text-xs text-muted-foreground">
                        {submission.user?.email || submission.user_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {submission.user?.unit || 'No unit'}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    {formatDateTimeValue(submission.end_time || submission.created_at || submission.start_time)}
                  </TableCell>
                  <TableCell>
                    {typeof submission.score === 'number'
                      ? `${Math.round(submission.score)}%`
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {submission.attempt_count
                      ? `${submission.attempt_number || 1}/${submission.attempt_count}`
                      : `${submission.attempt_number || 1}`}
                  </TableCell>
                  <TableCell>
                    {submission.passed ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {submission.violations_count || 0}
                  </TableCell>
                  <TableCell>{formatConsent(submission.proctoring_consent)}</TableCell>
                  <TableCell>{submission.media_violation_count || 0}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          disabled={!submission.test_id}
                          checked={submission.test?.results_released || false}
                          onCheckedChange={() => {
                            if (!submission.test_id) return;
                            onToggleRelease(
                              submission.test_id,
                              submission.test?.results_released || false
                            );
                          }}
                        />
                        {submission.test?.results_released ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
}

function StatCard({ title, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}
