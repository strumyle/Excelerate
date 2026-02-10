
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, TrendingUp, Trophy, Clock, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface MetricsData {
  totalQuizzesTaken: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  recentPerformance: Array<{
    tutorial_title: string;
    score: number;
    created_at: string;
  }>;
  categoryBreakdown: Record<string, { 
    total: number; 
    correct: number; 
    percentage: number; 
  }>;
}

export function CandidateMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      // Fetch quiz attempts with tutorial titles
      const { data: attempts, error: attemptsError } = await supabase
        .from('tutorial_quiz_attempts')
        .select(`
          *,
          tutorials!inner(title)
        `)
        .eq('user_id', sessionData.session.user.id)
        .order('created_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      if (!attempts || attempts.length === 0) {
        setMetrics({
          totalQuizzesTaken: 0,
          averageScore: 0,
          bestScore: 0,
          totalTimeSpent: 0,
          recentPerformance: [],
          categoryBreakdown: {}
        });
        return;
      }

      // Calculate metrics
      const totalQuizzesTaken = attempts.length;
      const scores = attempts.map(a => a.score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const bestScore = Math.max(...scores);
      const totalTimeSpent = attempts.reduce((sum, attempt) => sum + attempt.time_spent_seconds, 0);

      // Recent performance (last 5)
      const recentPerformance = attempts.slice(0, 5).map(attempt => ({
        tutorial_title: (attempt.tutorials as any)?.title || 'Unknown',
        score: attempt.score,
        created_at: attempt.created_at || ''
      }));

      // Category breakdown (if available)
      const categoryBreakdown: Record<string, { total: number; correct: number; percentage: number }> = {};
      
      attempts.forEach(attempt => {
        if (attempt.category_breakdown) {
          const breakdown = attempt.category_breakdown as Record<string, { correct: number; total: number }>;
          Object.entries(breakdown).forEach(([category, stats]) => {
            if (!categoryBreakdown[category]) {
              categoryBreakdown[category] = { total: 0, correct: 0, percentage: 0 };
            }
            categoryBreakdown[category].total += stats.total;
            categoryBreakdown[category].correct += stats.correct;
          });
        }
      });

      // Calculate percentages
      Object.keys(categoryBreakdown).forEach(category => {
        const stats = categoryBreakdown[category];
        stats.percentage = (stats.correct / stats.total) * 100;
      });

      setMetrics({
        totalQuizzesTaken,
        averageScore: Math.round(averageScore),
        bestScore: Math.round(bestScore),
        totalTimeSpent,
        recentPerformance,
        categoryBreakdown
      });

    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load performance metrics.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getGrade = (score: number) => {
    if (score < 50) return { grade: 'Not Yet', color: 'text-red-600' };
    if (score < 70) return { grade: 'Can Do Better', color: 'text-yellow-600' };
    return { grade: 'Pass', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading metrics...</span>
      </div>
    );
  }

  if (!metrics || metrics.totalQuizzesTaken === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-600">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold mb-2">No Quiz Data Yet</h3>
            <p>Take your first practice quiz to see your performance metrics here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Quizzes Taken</p>
                <p className="text-2xl font-bold">{metrics.totalQuizzesTaken}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Average Score</p>
                <p className="text-2xl font-bold">{metrics.averageScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Best Score</p>
                <p className="text-2xl font-bold">{metrics.bestScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Time Spent</p>
                <p className="text-2xl font-bold">{formatTime(metrics.totalTimeSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.recentPerformance.map((performance, index) => {
              const grade = getGrade(performance.score);
              return (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{performance.tutorial_title}</h4>
                    <p className="text-sm text-slate-600">
                      {new Date(performance.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{performance.score}%</p>
                    <p className={`text-sm ${grade.color}`}>{grade.grade}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category Performance */}
      {Object.keys(metrics.categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics.categoryBreakdown).map(([category, stats]) => (
                <div key={category}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{category}</span>
                    <span className="text-sm text-slate-600">
                      {stats.correct}/{stats.total} ({Math.round(stats.percentage)}%)
                    </span>
                  </div>
                  <Progress value={stats.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
