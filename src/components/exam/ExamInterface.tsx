import { useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Question } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { AntiCheat } from '@/utils/antiCheat';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ExamProps {
  testId?: string;
  submissionId?: string;
  questionIds?: string[];
  userDetails?: any;
}

type AnswerRecord = Record<string, string>;

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
            supabase.from('test_submissions').select('question_ids').eq('id', submissionId).single(),
          ]);

        if (testError || !test) {
          throw new Error(testError?.message || 'Test not found');
        }

        if (submissionError || !submissionRow) {
          throw new Error(submissionError?.message || 'Submission not found');
        }

        setTestData(test);
        setTimeRemaining(test.duration_minutes * 60);

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

        const initialAnswers: AnswerRecord = {};
        questionsWithShuffledOptions.forEach((question) => {
          initialAnswers[question.id] = '';
        });
        setAnswers(initialAnswers);
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

    const setupAntiCheat = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;

      if (!userId) {
        navigate('/auth');
        return;
      }

      const antiCheat = new AntiCheat(submissionId, userId, {
        maxTabSwitches: 3,
        onViolation: () => {
          setViolations((prev) => prev + 1);
          toast({
            title: 'Warning',
            description: (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Suspicious activity detected. This will be recorded.</span>
              </div>
            ),
            variant: 'destructive',
          });
        },
      });

      antiCheat.initialize();
    };

    void setupAntiCheat();
  }, [loading, submissionId, navigate, toast]);

  useEffect(() => {
    if (loading || timeRemaining <= 0 || !isFullscreen) return;

    const timer = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          void handleSubmit(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, timeRemaining]);

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

  const gradeOnServer = async (isAutoSubmit: boolean) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL || 'https://xrfiltyxdviefanplykg.supabase.co'}/functions/v1/grade-submission`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          answers,
          violations,
          autoSubmit: isAutoSubmit,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to grade submission');
    }

    return response.json();
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (submitting) return;
    if (!submissionId) return;

    setSubmitting(true);
    try {
      const { success, result } = await gradeOnServer(isAutoSubmit);

      if (!success) {
        throw new Error('Grading failed');
      }

      toast({
        title: isAutoSubmit ? "Time's up!" : 'Test submitted',
        description: `Your answers have been recorded. Score: ${result.percentageScore.toFixed(1)}%`,
      });

      navigate('/results');
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
            <div className={`flex items-center gap-2 p-2 rounded-md ${isTimeLow ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono">{formatTime(timeRemaining)}</span>
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
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-4 flex-1 overflow-y-auto">
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
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
            Previous
          </Button>
          <div className="flex gap-2">
            {currentQuestionIndex === questions.length - 1 ? (
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting || !currentQuestion || !answers[currentQuestion.id]}
                className="bg-excelerate-600 hover:bg-excelerate-700"
              >
                {submitting ? 'Submitting...' : 'Submit Test'}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!currentQuestion || !answers[currentQuestion.id]}>
                Next
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
