import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Question } from '@/lib/supabase';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { AntiCheat, type ViolationType } from '@/utils/antiCheat';
import { MediaProctor, type ProctoringConsent, type ProctoringStatus } from '@/utils/mediaProctor';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExamProps {
  testId?: string;
  submissionId?: string;
  questionIds?: string[];
  userDetails?: any;
}

type AnswerRecord = Record<string, string>;

interface GradeSubmissionResponse {
  success: boolean;
  result: {
    percentageScore: number;
  } | null;
  resultsReleased?: boolean;
}

const violationMessageMap: Record<string, string> = {
  tab_switch: 'Tab switch detected. This activity has been recorded.',
  right_click: 'Right-click is disabled during the exam and has been recorded.',
  copy: 'Copy attempt detected and recorded.',
  print_screen: 'Print screen attempt detected and recorded.',
  proctor_permission_denied: 'Camera and microphone permission was denied. This has been flagged.',
  camera_missing: 'No usable camera detected. This has been flagged.',
  camera_lost: 'Camera feed was interrupted. This has been flagged.',
  no_face_detected: 'No face detected for an extended period. This has been flagged.',
  multiple_faces_detected: 'Multiple faces detected. This has been flagged.',
  mic_muted_or_blocked: 'Microphone became unavailable. This has been flagged.',
  sustained_speech_detected: 'Sustained speech was detected and has been flagged.',
};

export function ExamInterface({
  testId: propTestId,
  submissionId,
  questionIds: propQuestionIds,
  userDetails,
}: ExamProps) {
  const { testId: paramTestId } = useParams<{ testId: string }>();
  const testId = propTestId || paramTestId;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testData, setTestData] = useState<any>(null);
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAutoSubmitWarning, setShowAutoSubmitWarning] = useState(false);
  const [proctoringRequired, setProctoringRequired] = useState(false);
  const [proctoringConsent, setProctoringConsent] = useState<ProctoringConsent>('unknown');
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>('inactive');
  const [proctoringNote, setProctoringNote] = useState<string | null>(null);
  const [showProctoringConsentModal, setShowProctoringConsentModal] = useState(false);
  const [antiCheatReady, setAntiCheatReady] = useState(false);
  const lastSavedRef = useRef<string>('');
  const localSaveTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const durationSecondsRef = useRef<number>(0);
  const hasShownTimeWarningRef = useRef(false);
  const antiCheatRef = useRef<AntiCheat | null>(null);
  const mediaProctorRef = useRef<MediaProctor | null>(null);
  const violationToastTimestampsRef = useRef<Map<string, number>>(new Map());

  const { toast } = useToast();
  const navigate = useNavigate();

  const getInitials = () => {
    if (!userDetails?.full_name) return 'C';

    return userDetails.full_name
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getStorageKey = () => (submissionId ? `exam_progress_${submissionId}` : 'exam_progress');
  const getSubmissionLockKey = () =>
    submissionId ? `active_exam_submission_${submissionId}` : 'active_exam_submission';

  const readLocalProgress = () => {
    if (!submissionId) return null;
    try {
      const raw = localStorage.getItem(getStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeLocalProgress = (payload: { answers: AnswerRecord; currentQuestionIndex: number }) => {
    if (!submissionId) return;
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    } catch {
      // Ignore local storage failures
    }
  };

  const clearLocalProgress = () => {
    if (!submissionId) return;
    try {
      localStorage.removeItem(getStorageKey());
    } catch {
      // Ignore local storage failures
    }
  };

  const clearSubmissionLock = () => {
    if (!submissionId) return;
    try {
      localStorage.removeItem(getSubmissionLockKey());
    } catch {
      // Ignore local storage failures
    }
  };

  const handleViolationEvent = (type: ViolationType) => {
    setViolations((prev) => prev + 1);
    const now = Date.now();
    const lastShownAt = violationToastTimestampsRef.current.get(type) || 0;
    if (now - lastShownAt < 4000) return;
    violationToastTimestampsRef.current.set(type, now);

    toast({
      title: 'Warning',
      description: (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{violationMessageMap[type] || 'Suspicious activity detected and recorded.'}</span>
        </div>
      ),
      variant: 'destructive',
    });
  };

  const syncProctoringFields = async (consent: ProctoringConsent, enabled: boolean) => {
    if (!submissionId) return;

    const { error } = await supabase
      .from('test_submissions')
      .update({
        proctoring_consent: consent,
        proctoring_enabled: enabled,
      })
      .eq('id', submissionId);

    if (error) {
      throw error;
    }
  };

  const startMediaProctoring = async () => {
    if (!submissionId) return;
    if (!antiCheatRef.current || !antiCheatReady) {
      throw new Error('Anti-cheat system is still initializing.');
    }

    if (mediaProctorRef.current) {
      mediaProctorRef.current.stop();
      mediaProctorRef.current = null;
    }

    const mediaProctor = new MediaProctor({
      onViolation: (type, details) => {
        void antiCheatRef.current?.recordExternalViolation(type, details);
      },
    });

    mediaProctorRef.current = mediaProctor;
    const result = await mediaProctor.start();
    setProctoringConsent(result.consent);
    setProctoringStatus(result.status);
    setProctoringNote(result.reason || null);

    const enabled = result.enabled && result.consent === 'granted';
    await syncProctoringFields(result.consent, enabled);

    if (result.consent === 'denied') {
      await antiCheatRef.current.recordExternalViolation('proctor_permission_denied', {
        reason: 'browser_permission_denied',
      });
    }
  };

  const handleProctoringConsentGrant = async () => {
    try {
      setShowProctoringConsentModal(false);
      await startMediaProctoring();
    } catch (error: any) {
      console.error('Failed to initialize media proctoring:', error);
      setProctoringConsent('unsupported');
      setProctoringStatus('limited');
      setProctoringNote(error?.message || 'Could not initialize media monitoring.');
      await syncProctoringFields('unsupported', false).catch((updateError) => {
        console.error('Failed to persist proctoring unsupported state:', updateError);
      });
      toast({
        title: 'Proctoring Limited',
        description: 'Could not fully initialize camera/audio checks. Exam will continue and this is flagged.',
        variant: 'destructive',
      });
    }
  };

  const handleProctoringConsentDecline = async () => {
    setShowProctoringConsentModal(false);
    setProctoringConsent('denied');
    setProctoringStatus('declined');
    setProctoringNote('Candidate declined camera/audio access.');
    mediaProctorRef.current?.stop();
    mediaProctorRef.current = null;

    await syncProctoringFields('denied', false).catch((error) => {
      console.error('Failed to persist proctoring denied state:', error);
    });
    const denialViolationPromise = antiCheatRef.current?.recordExternalViolation(
      'proctor_permission_denied',
      { reason: 'user_declined_permission' }
    );
    if (denialViolationPromise) {
      await denialViolationPromise.catch((error) => {
        console.error('Failed to record proctor permission denial:', error);
      });
    }
  };

  const handleActivateProctoring = () => {
    if (!proctoringRequired) return;
    setShowProctoringConsentModal(true);
  };

  const normalizeAnswers = (input: unknown, validIds: string[]) => {
    const normalized: AnswerRecord = {};
    validIds.forEach((id) => {
      normalized[id] = '';
    });

    if (input && typeof input === 'object') {
      Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
        if (!validIds.includes(key)) return;
        normalized[key] = typeof value === 'string' ? value : '';
      });
    }

    return normalized;
  };

  const saveProgressToCloud = async (payload: AnswerRecord, force = false) => {
    if (!submissionId) return;
    const snapshot = JSON.stringify(payload);
    if (!force && snapshot === lastSavedRef.current) return;

    const { error } = await supabase
      .from('test_submissions')
      .update({ answers: payload })
      .eq('id', submissionId);

    if (error) {
      throw error;
    }
    lastSavedRef.current = snapshot;
  };

  useEffect(() => {
    const initTest = async () => {
      if (!testId || !submissionId) {
        toast({
          title: 'Error',
          description: 'Missing test session context.',
          variant: 'destructive',
        });
        navigate('/candidate-dashboard');
        return;
      }

      try {
        setLoading(true);

        const [{ data: test, error: testError }, { data: submissionRow, error: submissionError }] =
          await Promise.all([
            supabase.from('tests').select('*').eq('id', testId).single(),
            supabase
              .from('test_submissions')
              .select('question_ids, answers, start_time, violations_count, proctoring_enabled, proctoring_consent')
              .eq('id', submissionId)
              .single(),
          ]);

        if (testError || !test) {
          throw new Error(testError?.message || 'Test not found');
        }

        if (submissionError || !submissionRow) {
          throw new Error(submissionError?.message || 'Submission not found');
        }

        setTestData(test);
        setProctoringRequired(Boolean(test.proctoring_required));
        setViolations(submissionRow.violations_count || 0);

        const submissionConsent = (submissionRow.proctoring_consent || 'unknown') as ProctoringConsent;
        setProctoringConsent(submissionConsent);
        if (!test.proctoring_required) {
          setProctoringStatus('inactive');
          setProctoringNote(null);
          setShowProctoringConsentModal(false);
        } else if (submissionConsent === 'granted' && submissionRow.proctoring_enabled) {
          setProctoringStatus('active');
          setProctoringNote(null);
          setShowProctoringConsentModal(false);
        } else if (submissionConsent === 'denied') {
          setProctoringStatus('declined');
          setProctoringNote('Camera/audio permission declined for this attempt.');
          setShowProctoringConsentModal(false);
        } else if (submissionConsent === 'unsupported') {
          setProctoringStatus('limited');
          setProctoringNote('Camera/audio monitoring has limited support on this device.');
          setShowProctoringConsentModal(false);
        } else {
          setProctoringStatus('inactive');
          setProctoringNote(null);
          setShowProctoringConsentModal(true);
        }

        const startTime = submissionRow.start_time ? new Date(submissionRow.start_time).getTime() : Date.now();
        const durationSeconds = Math.max(0, Math.floor(test.duration_minutes * 60));
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
        startTimeRef.current = startTime;
        durationSecondsRef.current = durationSeconds;
        setTimeRemaining(remainingSeconds);
        if (remainingSeconds > 0 && remainingSeconds <= 300 && !hasShownTimeWarningRef.current) {
          hasShownTimeWarningRef.current = true;
          setShowAutoSubmitWarning(true);
        }

        const lockedQuestionIds =
          ((submissionRow.question_ids as string[] | null) || propQuestionIds || []).filter(Boolean);

        if (lockedQuestionIds.length === 0) {
          throw new Error('No locked question set found for this submission.');
        }

        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .in('id', lockedQuestionIds);

        if (questionError || !questionData) {
          throw new Error(questionError?.message || 'Failed to load questions');
        }

        const byId = new Map(questionData.map((question) => [question.id, question]));
        const orderedQuestions = lockedQuestionIds
          .map((id) => byId.get(id))
          .filter((question): question is NonNullable<typeof questionData[number]> => Boolean(question));

        const validatedQuestions = orderedQuestions.map((question) => {
          let options: string[] = [];

          if (Array.isArray(question.options)) {
            options = [...question.options];
          } else if (question.options) {
            try {
              const parsed = JSON.parse(String(question.options));
              options = Array.isArray(parsed) ? parsed : [];
            } catch {
              options = [];
            }
          }

          return {
            ...question,
            options,
            test_type: question.test_type || 'A',
          } as Question;
        });

        const questionsWithShuffledOptions = validatedQuestions.map((question) => ({
          ...question,
          options: Array.isArray(question.options)
            ? [...question.options].sort(() => Math.random() - 0.5)
            : [],
        }));

        setQuestions(questionsWithShuffledOptions);

        const questionIds = questionsWithShuffledOptions.map((question) => question.id);
        const serverAnswers = normalizeAnswers(submissionRow.answers, questionIds);
        const localProgress = readLocalProgress();
        const mergedAnswers = normalizeAnswers(serverAnswers, questionIds);

        if (localProgress?.answers) {
          Object.entries(localProgress.answers as AnswerRecord).forEach(([key, value]) => {
            if (questionIds.includes(key) && typeof value === 'string') {
              mergedAnswers[key] = value;
            }
          });
        }

        setAnswers(mergedAnswers);
        if (localProgress?.currentQuestionIndex !== undefined) {
          const desiredIndex = Number(localProgress.currentQuestionIndex);
          if (Number.isFinite(desiredIndex)) {
            const clampedIndex = Math.max(0, Math.min(questionsWithShuffledOptions.length - 1, desiredIndex));
            setCurrentQuestionIndex(clampedIndex);
          }
        }
      } catch (error: any) {
        console.error('Error initializing test:', error);
        toast({
          title: 'Failed to load test',
          description: error.message || 'An unexpected error occurred.',
          variant: 'destructive',
        });
        navigate('/candidate-dashboard');
      } finally {
        setLoading(false);
      }
    };

    void initTest();
  }, [testId, submissionId, propQuestionIds, navigate, toast]);

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = document.body.style.overflow;

    const requestFullscreen = async () => {
      if (!document.fullscreenElement && root.requestFullscreen) {
        try {
          await root.requestFullscreen();
        } catch {
          // Ignore if browser blocks fullscreen.
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    void requestFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleEnterFullscreen = async () => {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      try {
        await root.requestFullscreen();
      } catch {
        // Ignore if browser blocks fullscreen.
      }
    }
  };

  useEffect(() => {
    if (loading || !submissionId) return;

    let isCancelled = false;

    const setupAntiCheat = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;

      if (!userId) {
        navigate('/auth');
        return;
      }

      const antiCheat = new AntiCheat(submissionId, userId, {
        maxTabSwitches: 3,
        onViolation: (type) => {
          handleViolationEvent(type);
        },
      });

      if (isCancelled) return;

      antiCheatRef.current = antiCheat;
      await antiCheat.bootstrapFromSubmission();
      antiCheat.initialize();
      setAntiCheatReady(true);
    };

    void setupAntiCheat();
    return () => {
      isCancelled = true;
      setAntiCheatReady(false);
      antiCheatRef.current?.cleanup();
      antiCheatRef.current = null;
      mediaProctorRef.current?.stop();
      mediaProctorRef.current = null;
    };
  }, [loading, submissionId, navigate]);

  useEffect(() => {
    if (!submissionId || loading) return;
    if (localSaveTimerRef.current) {
      clearTimeout(localSaveTimerRef.current);
    }
    const questionIds = questions.map((question) => question.id);
    const payload = normalizeAnswers(answers, questionIds);
    localSaveTimerRef.current = window.setTimeout(() => {
      writeLocalProgress({
        answers: payload,
        currentQuestionIndex,
      });
    }, 300);

    return () => {
      if (localSaveTimerRef.current) {
        clearTimeout(localSaveTimerRef.current);
      }
    };
  }, [answers, currentQuestionIndex, questions, submissionId, loading]);

  useEffect(() => {
    if (!submissionId || loading) return;
    const intervalId = window.setInterval(() => {
      const questionIds = questions.map((question) => question.id);
      const payload = normalizeAnswers(answers, questionIds);
      saveProgressToCloud(payload).catch((error) => {
        console.error('Autosave failed:', error);
      });
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [answers, questions, submissionId, loading]);

  useEffect(() => {
    if (!submissionId) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const questionIds = questions.map((question) => question.id);
        const payload = normalizeAnswers(answers, questionIds);
        writeLocalProgress({
          answers: payload,
          currentQuestionIndex,
        });
        saveProgressToCloud(payload, true).catch((error) => {
          console.error('Visibility save failed:', error);
        });
      }
    };

    const handlePageHide = () => {
      const questionIds = questions.map((question) => question.id);
      const payload = normalizeAnswers(answers, questionIds);
      writeLocalProgress({
        answers: payload,
        currentQuestionIndex,
      });
      saveProgressToCloud(payload, true).catch((error) => {
        console.error('Page hide save failed:', error);
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [answers, questions, currentQuestionIndex, submissionId]);

  useEffect(() => {
    if (loading || !submissionId) return;
    if (!proctoringRequired) return;
    if (proctoringConsent !== 'granted') return;
    if (mediaProctorRef.current) return;
    if (!antiCheatRef.current || !antiCheatReady) return;

    void startMediaProctoring().catch((error) => {
      console.error('Failed to resume media proctoring:', error);
    });
  }, [loading, submissionId, proctoringRequired, proctoringConsent, antiCheatReady]);

  useEffect(() => {
    if (loading || !submissionId) return;
    if (!startTimeRef.current || durationSecondsRef.current <= 0) return;

    const timer = window.setInterval(() => {
      const startTime = startTimeRef.current;
      const durationSeconds = durationSecondsRef.current;
      if (!startTime || durationSeconds <= 0) return;

      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
      setTimeRemaining(remainingSeconds);

      if (remainingSeconds > 0 && remainingSeconds <= 300 && !hasShownTimeWarningRef.current) {
        hasShownTimeWarningRef.current = true;
        setShowAutoSubmitWarning(true);
      }

      if (remainingSeconds <= 0) {
        setShowAutoSubmitWarning(false);
        window.clearInterval(timer);
        void handleSubmit(true);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading, submissionId]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prevIndex) => prevIndex - 1);
    }
  };

  const gradeOnServer = async (isAutoSubmit: boolean): Promise<GradeSubmissionResponse> => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const questionIds = questions.map((question) => question.id);
    const payloadAnswers = normalizeAnswers(answers, questionIds);

    if (!token) {
      throw new Error('Not authenticated');
    }

    if (!testId) {
      throw new Error('Missing test context.');
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/grade-submission`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          submission_id: submissionId,
          testId,
          test_id: testId,
          answers: payloadAnswers,
          violations,
          violations_count: violations,
          autoSubmit: isAutoSubmit,
          auto_submit: isAutoSubmit,
          proctoringConsent,
          proctoringEnabled: proctoringStatus === 'active',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to grade submission');
    }

    return response.json() as Promise<GradeSubmissionResponse>;
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (submitting) return;
    if (!submissionId) return;

    setSubmitting(true);
    try {
      const { success, result, resultsReleased } = await gradeOnServer(isAutoSubmit);

      if (!success) {
        throw new Error('Grading failed');
      }

      mediaProctorRef.current?.stop();
      mediaProctorRef.current = null;
      antiCheatRef.current?.cleanup();
      antiCheatRef.current = null;

      clearLocalProgress();
      clearSubmissionLock();
      const isAdminUser = userDetails?.role === 'admin';
      const canShowScore = Boolean(result && (resultsReleased || isAdminUser));
      const message = canShowScore && result
        ? `Your answers have been recorded. Score: ${result.percentageScore.toFixed(1)}%`
        : 'Your answers have been recorded. Results will remain hidden until an admin releases them.';
      if (isAdminUser) {
        toast({
          title: isAutoSubmit ? "Time's up!" : 'Test submitted',
          description: message,
        });
      }

      navigate(isAdminUser ? '/results' : '/candidate-dashboard');
    } catch (error: any) {
      console.error('Error submitting test:', error);
      toast({
        title: 'Submission error',
        description: error.message || 'Failed to submit your test. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600 mb-4"></div>
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  if (!isFullscreen) {
    return (
      <div className="min-h-screen w-full bg-slate-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-lg border-excelerate-100 shadow-lg">
          <CardHeader>
            <CardTitle>Full screen required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This assessment must be taken in full screen to reduce malpractice.
              Click the button below to continue.
            </p>
            <Button onClick={handleEnterFullscreen} className="w-full">
              Enter Full Screen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const isTimeLow = timeRemaining < 60;
  const questionOptions = currentQuestion && Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
  const answeredCount = questions.reduce((total, question) => (answers[question.id] ? total + 1 : total), 0);
  const isLastQuestion = questions.length > 0 && currentQuestionIndex >= questions.length - 1;
  const canAdvance = Boolean(currentQuestion && answers[currentQuestion.id]);

  return (
    <div className="min-h-screen w-full bg-slate-50 p-4">
      <Card className="shadow-lg border-excelerate-100 h-[calc(100vh-2rem)] w-full max-w-6xl mx-auto flex flex-col">
        <CardHeader className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-excelerate-100">
                <AvatarFallback className="bg-excelerate-50 text-excelerate-700">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{testData?.title || 'Excel Test'}</CardTitle>
                <p className="text-xs text-muted-foreground">{userDetails?.full_name || 'Candidate'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {proctoringRequired && (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-md border ${
                      proctoringStatus === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : proctoringStatus === 'declined'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : proctoringStatus === 'limited'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {proctoringStatus === 'active'
                      ? 'Proctoring Active'
                      : proctoringStatus === 'declined'
                      ? 'Proctoring Declined'
                      : proctoringStatus === 'limited'
                      ? 'Proctoring Limited'
                      : 'Proctoring Pending'}
                  </span>
                  {proctoringStatus !== 'active' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleActivateProctoring}
                      disabled={!antiCheatReady}
                      className="h-8"
                    >
                      Activate Proctoring
                    </Button>
                  )}
                </div>
              )}
              <div
                className={`flex items-center gap-2 p-2 rounded-md ${
                  isTimeLow ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>
              {violations > 0 && (
                <div className="flex items-center text-amber-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>
                    {violations} violation{violations !== 1 ? 's' : ''} recorded
                  </span>
                </div>
              )}
            </span>
          </div>
          {proctoringRequired && proctoringNote && (
            <p className="text-xs text-muted-foreground">{proctoringNote}</p>
          )}
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-4 flex-1 overflow-y-auto lg:overflow-hidden">
          <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex flex-col pr-1 lg:h-full lg:overflow-y-auto">
              <div className="space-y-6">
                <div className="text-lg font-medium">{currentQuestion?.text}</div>

                {currentQuestion ? (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
                    className="space-y-3"
                  >
                    {questionOptions.length > 0 ? (
                      questionOptions.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="text-base">
                            {option}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <div className="text-amber-600">
                        <AlertTriangle className="h-5 w-5 mb-2" />
                        <p>This question has no available options.</p>
                      </div>
                    )}
                  </RadioGroup>
                ) : (
                  <div className="text-amber-600">
                    <AlertTriangle className="h-5 w-5 mb-2" />
                    <p>Question data is not available.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm lg:h-full">
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Questions</h3>
                <span className="text-xs text-muted-foreground">
                  {answeredCount}/{questions.length}
                </span>
              </div>
              <div className="flex-1 pr-1 lg:overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {questions.map((question, index) => {
                    const isCurrent = index === currentQuestionIndex;
                    const isAnswered = Boolean(answers[question.id]);
                    const baseClasses =
                      'h-10 w-10 rounded-lg border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-excelerate-300 focus-visible:ring-offset-2';
                    const stateClasses = isCurrent
                      ? 'border-excelerate-500 bg-white text-excelerate-700 shadow-sm ring-2 ring-excelerate-200'
                      : isAnswered
                      ? 'border-excelerate-100 bg-excelerate-50 text-excelerate-700 hover:border-excelerate-200'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-excelerate-200 hover:text-excelerate-600';

                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`${baseClasses} ${stateClasses}`}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={`Go to question ${index + 1}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
            Previous
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={isLastQuestion ? () => void handleSubmit() : handleNext}
              disabled={isLastQuestion ? submitting : !canAdvance}
              className={isLastQuestion ? 'bg-excelerate-600 hover:bg-excelerate-700' : undefined}
            >
              {isLastQuestion ? (submitting ? 'Submitting...' : 'Submit Exam') : 'Next'}
            </Button>
          </div>
        </CardFooter>
      </Card>
      <AlertDialog open={showProctoringConsentModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Camera and microphone consent</AlertDialogTitle>
            <AlertDialogDescription>
              This assessment requires camera and microphone proctoring to flag suspicious behavior. No audio or
              video recordings are stored. If you continue without permission, the exam continues but the attempt is
              flagged for admin review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => void handleProctoringConsentDecline()}
              disabled={!antiCheatReady}
            >
              Continue Without Proctoring
            </Button>
            <AlertDialogAction disabled={!antiCheatReady} onClick={() => void handleProctoringConsentGrant()}>
              Allow Camera and Microphone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showAutoSubmitWarning} onOpenChange={setShowAutoSubmitWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auto-submit warning</AlertDialogTitle>
            <AlertDialogDescription>
              You are in the final 5 minutes. This exam will be submitted automatically when time reaches zero. Time remaining:{' '}
              <span className="font-mono text-foreground">{formatTime(Math.max(0, timeRemaining))}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAutoSubmitWarning(false)}>
              Continue Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
