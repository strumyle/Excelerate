import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GradeRequest {
  submissionId: string;
  answers: Record<string, string>;
  violations?: number;
  autoSubmit?: boolean;
}

interface GradeResult {
  correctAnswers: number;
  totalQuestions: number;
  totalPoints: number;
  maxPoints: number;
  percentageScore: number;
  passed: boolean;
  questionResults: Array<{
    questionId: string;
    isCorrect: boolean;
    points: number;
  }>;
}

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';

const parseOptions = (rawOptions: unknown): string[] => {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
      .filter((value) => value.length > 0);
  }

  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
          .filter((value) => value.length > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const letterToIndex = (value: string): number | null => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;

  // Accept formats like A, A), (A), A., Option A, option b
  const optionMatch = trimmed.match(/^OPTION\s+([A-Z])$/i);
  if (optionMatch?.[1]) {
    return optionMatch[1].charCodeAt(0) - 65;
  }

  const wrappedMatch = trimmed.match(/^\(?([A-Z])\)?[.):-]?$/);
  if (wrappedMatch?.[1]) {
    return wrappedMatch[1].charCodeAt(0) - 65;
  }

  if (/^[A-Z]$/.test(trimmed)) {
    return trimmed.charCodeAt(0) - 65;
  }

  return null;
};

const isAnswerCorrect = (
  userAnswerRaw: string,
  correctAnswerRaw: string | null,
  rawOptions: unknown
): boolean => {
  const userAnswer = normalizeText(userAnswerRaw);
  const correctAnswer = normalizeText(correctAnswerRaw);
  if (!userAnswer || !correctAnswer) return false;

  // Current format: both values store option text directly.
  if (userAnswer === correctAnswer) return true;

  const options = parseOptions(rawOptions).map((option) => normalizeText(option));
  if (options.length === 0) return false;

  // Legacy format support: correct_answer stored as A/B/C/D.
  const correctIndex = letterToIndex(correctAnswerRaw || '');
  if (correctIndex !== null && options[correctIndex] && userAnswer === options[correctIndex]) {
    return true;
  }

  // Backward compatibility in case clients send A/B/C/D as selected answer.
  const userIndex = letterToIndex(userAnswerRaw || '');
  if (userIndex !== null && correctIndex !== null && userIndex === correctIndex) {
    return true;
  }
  if (userIndex !== null && options[userIndex] && options[userIndex] === correctAnswer) {
    return true;
  }

  return false;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requesterProfile } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdminRequester =
      requesterProfile?.role === 'admin' ||
      user.id === SPECIAL_ADMIN_ID ||
      user.email === SPECIAL_ADMIN_EMAIL;

    const { submissionId, answers, violations = 0, autoSubmit = false }: GradeRequest =
      await req.json();

    if (!submissionId || !answers) {
      return new Response(
        JSON.stringify({ error: 'submissionId and answers are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: submission, error: submissionError } = await supabaseClient
      .from('test_submissions')
      .select('id, user_id, test_id, status, question_ids')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (submission.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not allowed to grade this submission' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (submission.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: 'Submission is not in progress' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lockedQuestionIds = Array.isArray(submission.question_ids)
      ? submission.question_ids.filter(Boolean)
      : [];

    if (lockedQuestionIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Submission has no locked question set' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const answerKeys = Object.keys(answers);
    const allowedSet = new Set(lockedQuestionIds);
    const invalidAnswerKeys = answerKeys.filter((questionId) => !allowedSet.has(questionId));
    if (invalidAnswerKeys.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Answer payload contains invalid question IDs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: test, error: testError } = await supabaseClient
      .from('tests')
      .select('id, passing_percentage, results_released')
      .eq('id', submission.test_id)
      .single();

    if (testError || !test) {
      return new Response(
        JSON.stringify({ error: 'Test not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: questions, error: questionsError } = await supabaseClient
      .from('questions')
      .select('id, correct_answer, points, options')
      .in('id', lockedQuestionIds);

    if (questionsError || !questions) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let correctAnswers = 0;
    let totalPoints = 0;
    let maxPoints = 0;
    const questionResults: GradeResult['questionResults'] = [];

    for (const question of questions) {
      const userAnswer = answers[question.id] || '';
      const isCorrect = isAnswerCorrect(userAnswer, question.correct_answer, question.options);
      const points = question.points || 1;

      maxPoints += points;
      if (isCorrect) {
        correctAnswers += 1;
        totalPoints += points;
      }

      questionResults.push({
        questionId: question.id,
        isCorrect,
        points: isCorrect ? points : 0,
      });
    }

    const totalQuestions = questions.length;
    const percentageScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const passed = percentageScore >= test.passing_percentage;

    const { data: savedSubmission, error: updateError } = await supabaseClient
      .from('test_submissions')
      .update({
        end_time: new Date().toISOString(),
        answers,
        score: percentageScore,
        total_points: totalPoints,
        passed,
        violations_count: violations,
        status: 'completed',
        auto_submit: autoSubmit,
      })
      .eq('id', submissionId)
      .select('id')
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update submission' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: GradeResult = {
      correctAnswers,
      totalQuestions,
      totalPoints,
      maxPoints,
      percentageScore,
      passed,
      questionResults,
    };

    const resultsReleased = Boolean(test.results_released);
    const canViewDetailedResult = isAdminRequester || resultsReleased;

    return new Response(
      JSON.stringify({
        success: true,
        result: canViewDetailedResult ? result : null,
        resultsReleased,
        submissionId: savedSubmission?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
