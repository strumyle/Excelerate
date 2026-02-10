
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Battery, Clock, Users, BookOpen, Award } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalTests: 0,
    totalQuestions: 0,
    totalCandidates: 0,
    avgScore: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    certificatesIssued: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total tests
        const { count: testsCount, error: testsError } = await supabase
          .from('tests')
          .select('*', { count: 'exact', head: true });

        // Get total questions
        const { count: questionsCount, error: questionsError } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true });

        // Get total candidates (users with role 'candidate')
        const { count: candidatesCount, error: candidatesError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'candidate');

        // Get average score
        const { data: submissions, error: submissionsError } = await supabase
          .from('test_submissions')
          .select('score');

        let avgScore = 0;
        if (submissions && submissions.length > 0) {
          const totalScore = submissions.reduce((sum, sub) => sum + (sub.score || 0), 0);
          avgScore = totalScore / submissions.length;
        }

        // Get total courses
        const { count: coursesCount, error: coursesError } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Get total enrollments
        const { count: enrollmentsCount, error: enrollmentsError } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true });

        // Get certificates issued
        const { count: certificatesCount, error: certificatesError } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalTests: testsCount || 0,
          totalQuestions: questionsCount || 0,
          totalCandidates: candidatesCount || 0,
          avgScore: Math.round(avgScore * 10) / 10, // Round to 1 decimal
          totalCourses: coursesCount || 0,
          totalEnrollments: enrollmentsCount || 0,
          certificatesIssued: certificatesCount || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Learning Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.totalCourses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active learning courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.totalEnrollments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Course registrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.certificatesIssued}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Certificates issued
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.totalTests}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Excel proficiency assessments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.totalQuestions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In question bank
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Candidates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : stats.totalCandidates}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered test takers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-6 w-16 animate-pulse bg-muted rounded"></div> : `${stats.avgScore}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all submissions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest test submissions and activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 w-full animate-pulse bg-muted rounded"></div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No recent activity to display</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Performance by Group</CardTitle>
            <CardDescription>
              Average scores by candidate group
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 w-full animate-pulse bg-muted rounded"></div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No group data to display</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
