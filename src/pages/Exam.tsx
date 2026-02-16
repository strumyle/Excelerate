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
  created_at: string;
  updated_at: string;
}

interface SubmissionContext {
  submissionId: string;
  questionIds: string[];
}

interface InProgressSubmissionRow {
  id: string;
  question_ids: string[] | null;
  start_time: string | null;
  created_at: string | null;
}

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';
const getSubmissionLockKey = (submissionId: string) => `active_exam_submission_${submissionId}`;
const getSubmissionProgressKey = (submissionId: string) => `exam_progress_${submissionId}`;
const isRetakeRpcSignatureError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();

  return (
    code === 'PGRST202' ||
    code === 'PGRST203' ||
    (message.includes('could not find the function') &&
      message.includes('consume_test_retake_attempt')) ||
    (message.includes('could not choose') &&
      message.includes('consume_test_retake_attempt')) ||
    (message.includes('function') &&
      message.includes('consume_test_retake_attempt') &&
      message.includes('arguments'))
  );
};
const isRetakeRpcCallShapeError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    isRetakeRpcSignatureError(error) ||
    message.includes('p_permission_id') ||
    (message.includes('invalid input syntax for type uuid') && message.includes('null'))
  );
};
const isRetakeMigrationError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '').toLowerCase();
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    isRetakeRpcSignatureError(error) ||
    code === '42703' ||
    code === '42p01' ||
    ((message.includes('remaining_attempts') || message.includes('granted_attempts')) &&
      message.includes('does not exist')) ||
    ((message.includes('column') || message.includes('relation')) && message.includes('does not exist')) ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('function') && message.includes('consume_test_retake_attempt'))
  );
};
const getErrorMessage = (error: unknown) => String((error as { message?: string })?.message || '');
const getErrorCode = (error: unknown) => String((error as { code?: string })?.code || '');

const hasSubmissionLock = (submissionId: string) => {
  try {
    const explicitLock = localStorage.getItem(getSubmissionLockKey(submissionId)) === '1';
    const hasProgressSnapshot = localStorage.getItem(getSubmissionProgressKey(submissionId)) !== null;
    return explicitLock || hasProgressSnapshot;
  } catch {
    return false;
  }
};

const setSubmissionLock = (submissionId: string) => {
  try {
    localStorage.setItem(getSubmissionLockKey(submissionId), '1');
  } catch {
    // Ignore local storage failures.
  }
};

const clearSubmissionLock = (submissionId: string) => {
  try {
    localStorage.removeItem(getSubmissionLockKey(submissionId));
    localStorage.removeItem(getSubmissionProgressKey(submissionId));
  } catch {
    // Ignore local storage failures.
  }
};

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
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Failed to load exam context.';
        setAccessError(message);
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
      .select('id, test_id, question_count, is_active, available_until, created_at, updated_at')
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

  const parseDateMs = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };

  const getRetryWindowMs = (assignment: TestAssignment, testDurationMinutes: number) => {
    const minimumMs = Math.max(1, testDurationMinutes || 1) * 60 * 1000;
    const maxReasonableMs = 30 * 24 * 60 * 60 * 1000;
    const availableUntilMs = parseDateMs(assignment.available_until);
    if (availableUntilMs === null) return minimumMs;

    const baseCandidates = [parseDateMs(assignment.updated_at), parseDateMs(assignment.created_at)];
    for (const baseMs of baseCandidates) {
      if (baseMs === null || baseMs >= availableUntilMs) continue;
      const windowMs = availableUntilMs - baseMs;
      if (windowMs >= minimumMs && windowMs <= maxReasonableMs) {
        return windowMs;
      }
    }

    return minimumMs;
  };

  const ensureCandidateSubmission = async (
    userId: string,
    assignment: TestAssignment,
    test: any
  ): Promise<SubmissionContext> => {
    const consumeRetakePermission = async () => {
      const payloads: Array<
        { mode: 'one_arg'; payload: { p_test_id: string } } |
        { mode: 'two_arg_null'; payload: { p_test_id: string; p_permission_id: null } }
      > = [
        {
          mode: 'one_arg',
          payload: { p_test_id: assignment.test_id },
        },
        {
          mode: 'two_arg_null',
          payload: { p_test_id: assignment.test_id, p_permission_id: null },
        },
      ];

      let data: unknown = null;
      let lastError: unknown = null;
      let lastMode: string | null = null;

      for (const rpcCall of payloads) {
        const response = await supabase.rpc('consume_test_retake_attempt', rpcCall.payload);
        if (!response.error) {
          data = response.data;
          lastError = null;
          lastMode = rpcCall.mode;
          break;
        }

        lastError = response.error;
        lastMode = rpcCall.mode;
      }

      // Final strict RPC fallback: resolve a concrete permission id and consume via 2-arg call.
      if (lastError) {
        let permissionRows: Array<{ id: string }> | null = null;
        let permissionLookupError: unknown = null;

        const primaryLookup = await supabase
          .from('test_retake_permissions')
          .select('id')
          .eq('user_id', userId)
          .eq('test_id', assignment.test_id)
          .gt('remaining_attempts', 0)
          .order('granted_at', { ascending: true })
          .limit(1);

        if (primaryLookup.error) {
          permissionLookupError = primaryLookup.error;
          // Legacy fallback if retry-count columns are not present in this environment.
          if (isRetakeMigrationError(primaryLookup.error)) {
            const legacyLookup = await supabase
              .from('test_retake_permissions')
              .select('id')
              .eq('user_id', userId)
              .eq('test_id', assignment.test_id)
              .order('granted_at', { ascending: true })
              .limit(1);
            permissionRows = (legacyLookup.data as Array<{ id: string }> | null) || null;
            permissionLookupError = legacyLookup.error;
          }
        } else {
          permissionRows = (primaryLookup.data as Array<{ id: string }> | null) || null;
        }

        if (permissionLookupError) {
          lastError = permissionLookupError;
          lastMode = 'lookup_permission_id';
        } else {
          const permissionId = permissionRows?.[0]?.id;
          if (!permissionId) {
            return false;
          }

          const byIdResponse = await supabase.rpc('consume_test_retake_attempt', {
            p_test_id: assignment.test_id,
            p_permission_id: permissionId,
          });

          if (byIdResponse.error) {
            lastError = byIdResponse.error;
            lastMode = 'two_arg_id';
          } else {
            data = byIdResponse.data;
            lastError = null;
            lastMode = 'two_arg_id';
          }
        }
      }

      if (lastError) {
        const errorCode = getErrorCode(lastError);
        const errorMessageRaw = getErrorMessage(lastError);
        const errorMessage = errorMessageRaw.toLowerCase();
        console.error('Failed to consume retake permission before attempt start.', {
          error: lastError,
          code: errorCode,
          message: errorMessageRaw,
          details: (lastError as { details?: string })?.details || null,
          hint: (lastError as { hint?: string })?.hint || null,
          mode: lastMode,
          userId,
          assignmentId: assignment.id,
          testId: assignment.test_id,
        });

        if (errorMessage.includes('not authenticated')) {
          throw new Error('Your session expired. Please sign in again.');
        }

        if (isRetakeMigrationError(lastError) || isRetakeRpcCallShapeError(lastError)) {
          throw new Error(
            'Retry validation is unavailable because database migrations are incomplete. Please contact your administrator.'
          );
        }

        if (errorMessage.includes('permission denied')) {
          throw new Error(
            'Retry validation is blocked by database permissions. Please contact your administrator.'
          );
        }

        const diagnostic = errorCode
          ? ` (code: ${errorCode}${errorMessageRaw ? `, ${errorMessageRaw}` : ''})`
          : (errorMessageRaw ? ` (${errorMessageRaw})` : '');
        throw new Error(
          `Unable to validate retry credit right now${diagnostic}. Please contact your administrator.`
        );
      }

      const row = Array.isArray(data) ? data[0] : data;
      return Boolean((row as { consumed?: boolean } | null)?.consumed);
    };

    const { data: inProgressRows, error: inProgressError } = await supabase
      .from('test_submissions')
      .select('id, question_ids, start_time, created_at')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);

    if (inProgressError) throw new Error(inProgressError.message);

    const inProgress = (inProgressRows?.[0] as InProgressSubmissionRow | undefined) || null;
    if (inProgress) {
      const startMs = parseDateMs(inProgress.start_time) ?? parseDateMs(inProgress.created_at);
      const durationMs = Math.max(0, Number(test?.duration_minutes || 0)) * 60 * 1000;
      const isTimedOut =
        durationMs > 0 &&
        startMs !== null &&
        Date.now() >= startMs + durationMs;

      if (isTimedOut) {
        const nowIso = new Date().toISOString();
        const { error: expireError } = await supabase
          .from('test_submissions')
          .update({
            status: 'expired',
            end_time: nowIso,
            auto_submit: true,
          })
          .eq('id', inProgress.id)
          .eq('user_id', userId);

        if (expireError) {
          throw new Error(expireError.message);
        }

        clearSubmissionLock(inProgress.id);
      } else {
        if (!hasSubmissionLock(inProgress.id)) {
          throw new Error(
            'This assessment is already in progress on another device. Please continue from the original device.'
          );
        }

        const lockedQuestionIds = (inProgress.question_ids || []).filter(Boolean) as string[];
        if (lockedQuestionIds.length > 0) {
          setSubmissionLock(inProgress.id);
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

        setSubmissionLock(inProgress.id);
        return { submissionId: inProgress.id, questionIds: fallbackSample };
      }
    }

    const { data: priorAttemptRows, error: priorAttemptError } = await supabase
      .from('test_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .in('status', ['completed', 'expired', 'submitted', 'failed'])
      .limit(1);

    if (priorAttemptError) throw new Error(priorAttemptError.message);

    const assignmentExpired = isAssignmentExpired(assignment);
    const hasPriorAttempt = (priorAttemptRows || []).length > 0;
    const requiresRetakePermission = assignmentExpired || hasPriorAttempt;
    if (requiresRetakePermission) {
      const consumed = await consumeRetakePermission();
      if (!consumed) {
        console.warn('Retake consume returned no available credits.', {
          userId,
          assignmentId: assignment.id,
          testId: assignment.test_id,
          assignmentExpired,
          hasPriorAttempt,
        });
        if (assignmentExpired) {
          throw new Error(
            'This assessment window has expired and you have no retries left. Contact your administrator for reassignment.'
          );
        }
        throw new Error(
          'You have no retries left for this assessment. Contact your administrator for access.'
        );
      }
    }

    if (assignmentExpired) {
      const retryWindowMs = getRetryWindowMs(assignment, Number(test?.duration_minutes || 0));
      const reopenedUntil = new Date(Date.now() + retryWindowMs).toISOString();
      const { error: reopenError } = await supabase
        .from('test_assignments')
        .update({
          available_until: reopenedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)
        .eq('user_id', userId);

      if (reopenError) {
        throw new Error(reopenError.message);
      }

      assignment.available_until = reopenedUntil;
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
        proctoring_enabled: false,
        proctoring_consent: 'unknown',
      })
      .select('id, question_ids')
      .limit(1);

    if (insertError) throw new Error(insertError.message);
    const inserted = insertedRows?.[0];
    if (!inserted) throw new Error('Failed to create a submission.');

    setSubmissionLock(inserted.id);
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
        proctoring_enabled: false,
        proctoring_consent: 'unknown',
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

    const test = await getTestById(assignment.test_id);
    const submission = await ensureCandidateSubmission(userId, assignment, test);
    setSubmissionLock(submission.submissionId);

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
