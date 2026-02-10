
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableHead, TableRow, TableHeader, TableCell, TableBody, Table } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { TestSubmission } from '@/lib/supabase';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Loader2, FileDown, Eye, EyeOff, Users, TrendingUp } from 'lucide-react';
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
  };
  violations_count: number;
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

export default function Results() {
  const [submissions, setSubmissions] = useState<EnhancedTestSubmission[]>([]);
  const [unitPerformance, setUnitPerformance] = useState<UnitPerformance[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [releasingAll, setReleasingAll] = useState(false);
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

        if (userData?.role === 'admin') {
          console.log("Fetching submissions as admin");
          
          const { data, error } = await supabase
            .from('test_submissions')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching submissions as admin:", error);
            throw new Error(error.message);
          }

          console.log("Admin submissions fetched:", data);
          
          const processedSubmissions = await Promise.all(
            (data || []).map(async (submission) => {
              let userData = null;
              if (submission.user_id) {
                const { data: user } = await supabase
                  .from('users')
                  .select('id, full_name, email, unit')
                  .eq('id', submission.user_id)
                  .single();
                userData = user;
              }
              
              let testData = null;
              if (submission.test_id) {
                const { data: test } = await supabase
                  .from('tests')
                  .select('id, title, passing_percentage, results_released')
                  .eq('id', submission.test_id)
                  .single();
                testData = test;
              }
              
              return {
                ...submission,
                user: userData,
                test: testData,
                violations_count:
                  submission.violations_count ??
                  (submission.violations ? submission.violations.length : 0),
              };
            })
          );
          
          setSubmissions(processedSubmissions as EnhancedTestSubmission[]);
          
          // Calculate unit performance
          const unitStats = calculateUnitPerformance(processedSubmissions as EnhancedTestSubmission[]);
          setUnitPerformance(unitStats);
          
          // Calculate recent activity
          const activity = calculateRecentActivity(processedSubmissions as EnhancedTestSubmission[]);
          setRecentActivity(activity);
          
        } else {
          console.log("Fetching submissions for user:", sessionData.session.user.id);
          
          const { data, error } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('user_id', sessionData.session.user.id)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching user submissions:", error);
            throw new Error(error.message);
          }

          console.log("User submissions fetched:", data);
          
          const processedSubmissions = await Promise.all(
            (data || []).map(async (submission) => {
              let testData = null;
              if (submission.test_id) {
                const { data: test } = await supabase
                  .from('tests')
                  .select('id, title, passing_percentage, results_released')
                  .eq('id', submission.test_id)
                  .single();
                testData = test;
              }
              
              return {
                ...submission,
                test: testData,
                violations_count:
                  submission.violations_count ??
                  (submission.violations ? submission.violations.length : 0),
              };
            })
          );
          
          // For non-admin users, only show released results
          const releasedSubmissions = processedSubmissions.filter(s => s.test?.results_released);
          setSubmissions(releasedSubmissions as EnhancedTestSubmission[]);
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
        date: submission.start_time || '',
        score: Number(submission.score || 0),
        passed: Boolean(submission.passed)
      }));
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
        sub.test_id === testId 
          ? { ...sub, test: { ...sub.test!, results_released: !currentStatus } }
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

  // Format duration between start and end time
  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = endDate.getTime() - startDate.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  // Generate CSV of all test results
  const downloadResultsCSV = async () => {
    if (!submissions.length || !userRole || userRole !== 'admin') {
      toast({
        title: "Download failed",
        description: "You don't have permission or there are no results to download.",
        variant: "destructive"
      });
      return;
    }
    
    setDownloading(true);
    
    try {
      // Define CSV headers
      const headers = [
        'Test ID', 
        'Test Title', 
        'Candidate ID', 
        'Candidate Name',
        'Email',
        'Unit',
        'Submission Date', 
        'Duration', 
        'Score', 
        'Status',
        'Violations'
      ].join(',');
      
      // Generate CSV rows
      const rows = submissions.map(submission => {
        const values = [
          `"${submission.test_id || ''}"`,
          `"${submission.test?.title || 'Unknown Test'}"`,
          `"${submission.user_id || ''}"`,
          `"${submission.user?.full_name || 'Unknown'}"`,
          `"${submission.user?.email || ''}"`,
          `"${submission.user?.unit || ''}"`,
          `"${submission.start_time ? format(new Date(submission.start_time), 'yyyy-MM-dd HH:mm:ss') : ''}"`,
          `"${submission.start_time && submission.end_time ? formatDuration(submission.start_time, submission.end_time) : 'N/A'}"`,
          `"${typeof submission.score === 'number' ? Math.round(submission.score) + '%' : 'N/A'}"`,
          `"${submission.passed ? 'Passed' : 'Failed'}"`,
          `"${submission.violations_count || 0}"`
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
      link.setAttribute('download', `test-results-${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
                disabled={downloading || !submissions.length}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Performance by Unit/Department
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unitPerformance.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No unit data available</p>
              ) : (
                <div className="space-y-3">
                  {unitPerformance.map((unit) => (
                    <div key={unit.unit} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{unit.unit || 'Unassigned'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {unit.totalSubmissions} submissions • {unit.passRate}% pass rate
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
                          {activity.test_title} • {format(new Date(activity.date), 'MMM d, yyyy')}
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
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Results</TabsTrigger>
          <TabsTrigger value="passed">Passed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ResultsTable 
            submissions={submissions} 
            formatDuration={formatDuration} 
            isAdmin={userRole === 'admin'}
            onToggleRelease={toggleResultRelease}
          />
        </TabsContent>
        
        <TabsContent value="passed">
          <ResultsTable 
            submissions={submissions.filter(s => s.passed)} 
            formatDuration={formatDuration} 
            isAdmin={userRole === 'admin'}
            onToggleRelease={toggleResultRelease}
          />
        </TabsContent>
        
        <TabsContent value="failed">
          <ResultsTable 
            submissions={submissions.filter(s => !s.passed)} 
            formatDuration={formatDuration} 
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
  formatDuration: (start: string, end: string) => string;
  isAdmin: boolean;
  onToggleRelease: (testId: string, currentStatus: boolean) => void;
}

function ResultsTable({ submissions, formatDuration, isAdmin, onToggleRelease }: ResultsTableProps) {
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                {isAdmin && <TableHead>User</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                {isAdmin && <TableHead>Score</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Violations</TableHead>
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
                    {submission.start_time
                      ? format(new Date(submission.start_time), 'MMM d, yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {submission.start_time && submission.end_time
                      ? formatDuration(submission.start_time, submission.end_time)
                      : 'Incomplete'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {typeof submission.score === 'number'
                        ? `${Math.round(submission.score)}%`
                        : 'N/A'}
                    </TableCell>
                  )}
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
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={submission.test?.results_released || false}
                          onCheckedChange={() => onToggleRelease(
                            submission.test_id!, 
                            submission.test?.results_released || false
                          )}
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
