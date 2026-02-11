import { useEffect, useState } from 'react';
import { ExamInterface } from '@/components/exam/ExamInterface';
import { ExamLanding } from '@/components/exam/ExamLanding';
import { supabase } from '@/lib/supabase';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface TestAssignment {
  id: string;
  test_id: string;
  question_count: number;
  is_active: boolean;
  available_until: string | null;
}

interface SubmissionContext {
  submissionId: string;
  questionIds: string[];
}

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

const Exam = () => {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentIdFromQuery = searchParams.get('assignmentId');

  const [loading, setLoading] = useState(true);
  const [assignedTest, setAssignedTest] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [testStarted, setTestStarted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExamContext = async () => {
      try {
        setLoading(true);
        setAccessError(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate('/auth');
          return;
        }

        const { data: currentUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user:', userError);
          setAccessError('Unable to load your profile.');
          return;
        }

        setUserDetails(currentUser);

        const isAdmin =
          currentUser?.role === 'admin' ||
          session.user.id === SPECIAL_ADMIN_ID ||
          session.user.email === SPECIAL_ADMIN_EMAIL;

        if (isAdmin) {
          await loadAdminContext(session.user.id);
        } else {
          await loadCandidateContext(session.user.id);
        }
      } catch (error) {
        console.error('Error loading exam context:', error);
        setAccessError('Failed to load exam context.');
      } finally {
        setLoading(false);
      }
    };

    void fetchExamContext();
  }, [navigate, testId, assignmentIdFromQuery]);

  const sampleQuestionIds = (sourceIds: string[], desiredCount: number) => {
    const pool = [...sourceIds];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(desiredCount, pool.length));
  };

  const getTestById = async (id: string) => {
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single();
    if (error || !data) {
      throw new Error(error?.message || 'Test not found');
    }
    return data;
  };

  const resolveCandidateAssignment = async (userId: string): Promise<TestAssignment | null> => {
    let query = supabase
      .from('test_assignments')
      .select('id, test_id, question_count, is_active, available_until')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (assignmentIdFromQuery) {
      query = query.eq('id', assignmentIdFromQuery);
    }

    if (testId) {
      query = query.eq('test_id', testId);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);
    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as TestAssignment;
  };

  const isAssignmentExpired = (assignment: TestAssignment) => {
    if (!assignment.available_until) return false;
    const parsed = new Date(assignment.available_until);
    if (Number.isNaN(parsed.getTime())) return false;
    return Date.now() > parsed.getTime();
  };

  const ensureCandidateSubmission = async (
    userId: string,
    assignment: TestAssignment,
    test: any
  ): Promise<SubmissionContext> => {
    const { data: inProgressRows, error: inProgressError } = await supabase
      .from('test_submissions')
      .select('id, question_ids')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);

    if (inProgressError) throw new Error(inProgressError.message);

    const inProgress = inProgressRows?.[0];
    if (inProgress) {
      const lockedQuestionIds = (inProgress.question_ids || []).filter(Boolean) as string[];
      if (lockedQuestionIds.length > 0) {
        return { submissionId: inProgress.id, questionIds: lockedQuestionIds };
      }

      const desiredCount =
        assignment.question_count ||
        test.question_count ||
        (test.question_ids || []).length;
      const fallbackSample = sampleQuestionIds(test.question_ids || [], desiredCount);
      if (fallbackSample.length === 0) {
        throw new Error('Assigned test bank has no questions.');
      }

      const { error: fixError } = await supabase
        .from('test_submissions')
        .update({ question_ids: fallbackSample })
        .eq('id', inProgress.id);

      if (fixError) throw new Error(fixError.message);

      return { submissionId: inProgress.id, questionIds: fallbackSample };
    }

    const { data: completedRows, error: completedError } = await supabase
      .from('test_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .eq('status', 'completed')
      .limit(1);

    if (completedError) throw new Error(completedError.message);

    let consumedRetakePermissionId: string | null = null;
    if ((completedRows || []).length > 0) {
      const { data: permissionRows, error: permissionError } = await supabase
        .from('test_retake_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('test_id', assignment.test_id)
        .order('granted_at', { ascending: true })
        .limit(1);

      if (permissionError) throw new Error(permissionError.message);

      const permission = permissionRows?.[0];
      if (!permission) {
        throw new Error('You have already completed this assigned assessment. Retake permission is required.');
      }

      consumedRetakePermissionId = permission.id;
    }

    const desiredCount =
      assignment.question_count ||
      test.question_count ||
      (test.question_ids || []).length;
    const sampledQuestionIds = sampleQuestionIds(test.question_ids || [], desiredCount);
    if (sampledQuestionIds.length === 0) {
      throw new Error('Assigned test bank has no questions.');
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('test_submissions')
      .insert({
        test_id: assignment.test_id,
        assignment_id: assignment.id,
        question_ids: sampledQuestionIds,
        user_id: userId,
        start_time: new Date().toISOString(),
        status: 'in_progress',
      })
      .select('id, question_ids')
      .limit(1);

    if (insertError) throw new Error(insertError.message);
    const inserted = insertedRows?.[0];
    if (!inserted) throw new Error('Failed to create a submission.');

    if (consumedRetakePermissionId) {
      const { error: deleteError } = await supabase
        .from('test_retake_permissions')
        .delete()
        .eq('id', consumedRetakePermissionId);
      if (deleteError) {
        console.error('Failed to consume retake permission:', deleteError);
      }
    }

    return {
      submissionId: inserted.id,
      questionIds: ((inserted.question_ids || []) as string[]).filter(Boolean),
    };
  };

  const ensureAdminSubmission = async (userId: string, test: any): Promise<SubmissionContext> => {
    const { data: inProgressRows, error: inProgressError } = await supabase
      .from('test_submissions')
      .select('id, question_ids')
      .eq('user_id', userId)
      .eq('test_id', test.id)
      .eq('status', 'in_progress')
      .is('assignment_id', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (inProgressError) throw new Error(inProgressError.message);

    const inProgress = inProgressRows?.[0];
    if (inProgress) {
      const existingQuestionIds = (inProgress.question_ids || []).filter(Boolean) as string[];
      if (existingQuestionIds.length > 0) {
        return { submissionId: inProgress.id, questionIds: existingQuestionIds };
      }
    }

    const desiredCount = test.question_count || (test.question_ids || []).length;
    const sampledQuestionIds = sampleQuestionIds(test.question_ids || [], desiredCount);
    if (sampledQuestionIds.length === 0) {
      throw new Error('Selected test has no questions.');
    }

    if (inProgress) {
      const { error: updateError } = await supabase
        .from('test_submissions')
        .update({ question_ids: sampledQuestionIds })
        .eq('id', inProgress.id);
      if (updateError) throw new Error(updateError.message);
      return { submissionId: inProgress.id, questionIds: sampledQuestionIds };
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('test_submissions')
      .insert({
        test_id: test.id,
        assignment_id: null,
        question_ids: sampledQuestionIds,
        user_id: userId,
        start_time: new Date().toISOString(),
        status: 'in_progress',
      })
      .select('id')
      .limit(1);

    if (insertError) throw new Error(insertError.message);
    const inserted = insertedRows?.[0];
    if (!inserted) throw new Error('Failed to prepare admin preview.');

    return { submissionId: inserted.id, questionIds: sampledQuestionIds };
  };

  const loadCandidateContext = async (userId: string) => {
    const assignment = await resolveCandidateAssignment(userId);
    if (!assignment) {
      setAssignedTest(null);
      setSubmissionId(null);
      setQuestionIds([]);
      setAccessError('No active assignment found for this assessment.');
      return;
    }

    if (isAssignmentExpired(assignment)) {
      setAssignedTest(null);
      setSubmissionId(null);
      setQuestionIds([]);
      setAccessError('This assessment window has expired. Contact your administrator for reassignment.');
      return;
    }

    const test = await getTestById(assignment.test_id);
    const submission = await ensureCandidateSubmission(userId, assignment, test);

    setAssignedTest(test);
    setSubmissionId(submission.submissionId);
    setQuestionIds(submission.questionIds);
  };

  const loadAdminContext = async (userId: string) => {
    if (!testId) {
      setAssignedTest(null);
      setSubmissionId(null);
      setQuestionIds([]);
      setAccessError('Admin preview requires a test id in the URL.');
      return;
    }

    const test = await getTestById(testId);
    const submission = await ensureAdminSubmission(userId, test);

    setAssignedTest(test);
    setSubmissionId(submission.submissionId);
    setQuestionIds(submission.questionIds);
  };

  const handleStartTest = () => {
    setTestStarted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading your test...</span>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Assessment Access</CardTitle>
            <CardDescription>{accessError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Contact your administrator if you believe this is an error.
            </p>
            <Button
              onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}
              variant="outline"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assignedTest || !submissionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Test Available</CardTitle>
            <CardDescription>You do not have an active assessment context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}
              variant="outline"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return testStarted ? (
    <ExamInterface
      testId={assignedTest.id}
      submissionId={submissionId}
      questionIds={questionIds}
      userDetails={userDetails}
    />
  ) : (
    <ExamLanding testId={assignedTest.id} test={assignedTest} userDetails={userDetails} onStart={handleStartTest} />
  );
};

export default Exam;
