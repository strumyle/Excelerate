
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Clock, BookOpen, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
}

export default function TutorialQuiz() {
  const { tutorialId } = useParams<{ tutorialId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [tutorial, setTutorial] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if (tutorialId) {
      fetchTutorialAndQuestions();
    }
  }, [tutorialId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (quizStarted && !quizCompleted && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [quizStarted, quizCompleted, timeLeft]);

  const fetchTutorialAndQuestions = async () => {
    try {
      // Fetch tutorial details
      const { data: tutorialData, error: tutorialError } = await supabase
        .from('tutorials')
        .select('*')
        .eq('id', tutorialId)
        .single();

      if (tutorialError) throw tutorialError;
      setTutorial(tutorialData);

      // Fetch quiz questions for this tutorial
      const { data: questionsData, error: questionsError } = await supabase
        .from('tutorial_quiz_questions')
        .select('*')
        .eq('tutorial_id', tutorialId);

      if (questionsError) throw questionsError;
      
      if (!questionsData || questionsData.length === 0) {
        toast({
          title: "No Questions Available",
          description: "This tutorial doesn't have any quiz questions yet.",
          variant: "destructive"
        });
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Shuffle and take up to 10 questions
      const shuffledQuestions = questionsData
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(10, questionsData.length));
      
      setQuestions(shuffledQuestions);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load quiz data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    setQuizStarted(true);
    setStartTime(new Date());
    setTimeLeft(600); // Reset to 10 minutes
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!startTime) return;

    const endTime = new Date();
    const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    let correctAnswers = 0;
    questions.forEach(question => {
      if (answers[question.id] === question.correct_answer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / questions.length) * 100);

    const quizResult: QuizResult = {
      score,
      totalQuestions: questions.length,
      correctAnswers,
      timeSpent
    };

    // Save attempt to database
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase
          .from('tutorial_quiz_attempts')
          .insert({
            tutorial_id: tutorialId,
            user_id: sessionData.session.user.id,
            score,
            total_questions: questions.length,
            correct_answers: correctAnswers,
            time_spent_seconds: timeSpent,
            answers: answers
          });
      }
    } catch (error) {
      console.error('Error saving quiz attempt:', error);
    }

    setResult(quizResult);
    setQuizCompleted(true);
    setQuizStarted(false);
  };

  const retakeQuiz = () => {
    // Reshuffle questions
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffledQuestions);
    
    setQuizCompleted(false);
    setResult(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTimeLeft(600);
    startQuiz();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getOptionLabel = (option: string, question: Question) => {
    switch (option) {
      case 'A': return question.option_a;
      case 'B': return question.option_b;
      case 'C': return question.option_c;
      case 'D': return question.option_d;
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg text-slate-700">Loading quiz...</span>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-slate-600">Tutorial not found.</p>
            <Button onClick={() => navigate('/candidate-dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold mb-2">Quiz Not Available</h3>
            <p className="text-slate-600 mb-4">
              This tutorial doesn't have any quiz questions available yet.
            </p>
            <Button onClick={() => navigate('/candidate-dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/candidate-dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-slate-800">
            Practice Quiz: {tutorial.title}
          </h1>
          <p className="text-slate-600 mt-2">{tutorial.description}</p>
        </div>

        {!quizStarted && !quizCompleted && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-6 h-6 mr-2" />
                Ready to Start?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-600" />
                  <span>10 minutes</span>
                </div>
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
                  <span>{questions.length} questions</span>
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  This is a practice quiz based on the tutorial content. You can retake it multiple times 
                  to improve your understanding. Questions will be shuffled each time.
                </p>
              </div>
              <Button onClick={startQuiz} className="w-full bg-blue-600 hover:bg-blue-700">
                Start Practice Quiz
              </Button>
            </CardContent>
          </Card>
        )}

        {quizStarted && !quizCompleted && questions.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Badge>
                <div className="flex items-center text-sm text-slate-600">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTime(timeLeft)}
                </div>
              </div>
              <Progress 
                value={((currentQuestionIndex + 1) / questions.length) * 100} 
                className="w-32"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {questions[currentQuestionIndex].question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {['A', 'B', 'C', 'D'].map((option) => (
                    <Button
                      key={option}
                      variant={answers[questions[currentQuestionIndex].id] === option ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto p-4"
                      onClick={() => handleAnswerSelect(questions[currentQuestionIndex].id, option)}
                    >
                      <span className="font-medium mr-3">{option}.</span>
                      {getOptionLabel(option, questions[currentQuestionIndex])}
                    </Button>
                  ))}
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  
                  {currentQuestionIndex === questions.length - 1 ? (
                    <Button
                      onClick={handleSubmitQuiz}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={Object.keys(answers).length !== questions.length}
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={nextQuestion}
                      disabled={!answers[questions[currentQuestionIndex].id]}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {quizCompleted && result && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Quiz Results</span>
                  <Badge 
                    variant={result.score >= 70 ? "default" : "destructive"}
                    className={result.score >= 70 ? "bg-green-600" : ""}
                  >
                    {result.score >= 70 ? (
                      <><CheckCircle className="w-4 h-4 mr-1" /> Passed</>
                    ) : (
                      <><XCircle className="w-4 h-4 mr-1" /> Needs Improvement</>
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{result.score}%</div>
                    <div className="text-sm text-slate-600">Overall Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {result.correctAnswers}/{result.totalQuestions}
                    </div>
                    <div className="text-sm text-slate-600">Correct Answers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">
                      {formatTime(result.timeSpent)}
                    </div>
                    <div className="text-sm text-slate-600">Time Spent</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={retakeQuiz}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake Quiz
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/candidate-dashboard')}
                    className="flex-1"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
