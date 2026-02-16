import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, Question } from '@/lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

type EditableTest = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_percentage: number;
  question_ids: string[];
  question_count: number | null;
  test_type: string | null;
};

const TestCreate = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingPercentage, setPassingPercentage] = useState(70);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [questionsPerCandidate, setQuestionsPerCandidate] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const previousBucketRef = useRef('');
  const navigate = useNavigate();

  const filteredQuestions = useMemo(() => {
    if (!selectedBucket || selectedBucket === 'all') {
      return availableQuestions;
    }
    return availableQuestions.filter(
      (question) => (question.test_type || 'Unassigned') === selectedBucket
    );
  }, [availableQuestions, selectedBucket]);

  const selectedBankSize = selectedQuestions.length;
  const allSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((question) =>
      selectedQuestions.some((selectedQuestion) => selectedQuestion.id === question.id)
    );

  const toggleQuestion = (question: Question) => {
    if (selectedQuestions.find((q) => q.id === question.id)) {
      setSelectedQuestions(selectedQuestions.filter((q) => q.id !== question.id));
    } else {
      setSelectedQuestions([...selectedQuestions, question]);
    }
  };

  const saveTest = async () => {
    if (!title) {
      toast({
        title: 'Missing title',
        description: 'Please provide a title for the test.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedBucket) {
      toast({
        title: 'Missing exam bank',
        description: 'Please select an exam bank.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedQuestions.length === 0) {
      toast({
        title: 'No questions selected',
        description: 'Please select at least one question.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast({
        title: 'Invalid duration',
        description: 'Duration must be at least 1 minute.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(passingPercentage) || passingPercentage <= 0 || passingPercentage > 100) {
      toast({
        title: 'Invalid passing percentage',
        description: 'Passing percentage must be between 1 and 100.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(questionsPerCandidate) || questionsPerCandidate <= 0) {
      toast({
        title: 'Invalid question count',
        description: 'Questions per candidate must be at least 1.',
        variant: 'destructive',
      });
      return;
    }

    if (questionsPerCandidate > selectedQuestions.length) {
      toast({
        title: 'Question count too high',
        description: `Select at least ${questionsPerCandidate} questions or reduce the per-candidate count.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const timestamp = new Date().toISOString();
      const payload = {
        title,
        description,
        duration_minutes: durationMinutes,
        passing_percentage: passingPercentage,
        question_ids: selectedQuestions.map((question) => question.id),
        question_count: questionsPerCandidate,
        proctoring_required: true,
        test_type: selectedBucket === 'Unassigned' ? null : selectedBucket,
        updated_at: timestamp,
      };

      if (isEditMode && id) {
        const { error } = await supabase.from('tests').update(payload).eq('id', id);

        if (error) {
          throw error;
        }

        toast({
          title: 'Test updated',
          description: 'Your changes have been saved successfully.',
        });
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          toast({
            title: 'Authentication error',
            description: 'You must be logged in to create a test.',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.from('tests').insert({
          ...payload,
          is_active: true,
          created_by: session.user.id,
        });

        if (error) {
          throw error;
        }

        toast({
          title: 'Test created',
          description: 'Your test has been created successfully.',
        });
      }

      navigate('/tests');
    } catch (error: any) {
      console.error('Error saving test:', error);
      toast({
        title: isEditMode ? 'Error updating test' : 'Error creating test',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchBuilderData = async () => {
      setLoading(true);
      try {
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .order('category', { ascending: true });

        if (questionsError) throw questionsError;

        const processedQuestions = ((questionsData || []).map((question) => ({
          ...question,
          test_type: question.test_type || '',
        })) as unknown) as Question[];

        setAvailableQuestions(processedQuestions);

        const uniqueBuckets = Array.from(
          new Set(processedQuestions.map((question) => question.test_type || 'Unassigned'))
        );

        if (isEditMode && id) {
          const { data: testData, error: testError } = await supabase
            .from('tests')
            .select(
              'id, title, description, duration_minutes, passing_percentage, question_ids, question_count, test_type'
            )
            .eq('id', id)
            .single();

          if (testError) throw testError;

          const editableTest = testData as EditableTest;
          const testBucket = editableTest.test_type || 'Unassigned';
          const bucketOptions = uniqueBuckets.includes(testBucket)
            ? uniqueBuckets
            : [testBucket, ...uniqueBuckets];
          const savedQuestionIds = Array.isArray(editableTest.question_ids)
            ? editableTest.question_ids
            : [];
          const selectedFromDb = processedQuestions.filter((question) =>
            savedQuestionIds.includes(question.id)
          );

          setBuckets(bucketOptions);
          setTitle(editableTest.title || '');
          setDescription(editableTest.description || '');
          setDurationMinutes(editableTest.duration_minutes || 60);
          setPassingPercentage(editableTest.passing_percentage || 70);
          setSelectedBucket(testBucket);
          setSelectedQuestions(selectedFromDb);

          const defaultQuestionCount =
            typeof editableTest.question_count === 'number' && editableTest.question_count > 0
              ? editableTest.question_count
              : savedQuestionIds.length || selectedFromDb.length || 1;

          setQuestionsPerCandidate(
            selectedFromDb.length > 0
              ? Math.min(defaultQuestionCount, selectedFromDb.length)
              : defaultQuestionCount
          );

          if (savedQuestionIds.length !== selectedFromDb.length) {
            toast({
              title: 'Some saved questions are unavailable',
              description:
                'This test references questions that no longer exist. Review question selection before saving.',
              variant: 'destructive',
            });
          }
        } else {
          setBuckets(uniqueBuckets);
          if (uniqueBuckets.length > 0) {
            setSelectedBucket(uniqueBuckets[0]);
          }
          setQuestionsPerCandidate((current) => {
            if (processedQuestions.length === 0 || current <= processedQuestions.length) {
              return current;
            }
            return processedQuestions.length;
          });
        }
      } catch (error) {
        console.error('Error fetching test builder data:', error);
        toast({
          title: 'Error',
          description: isEditMode ? 'Failed to load test for editing.' : 'Failed to load questions.',
          variant: 'destructive',
        });
        if (isEditMode) {
          navigate('/tests');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBuilderData();
  }, [id, isEditMode, navigate]);

  useEffect(() => {
    if (!selectedBucket) {
      previousBucketRef.current = '';
      return;
    }

    if (!previousBucketRef.current) {
      previousBucketRef.current = selectedBucket;
      return;
    }

    if (previousBucketRef.current !== selectedBucket) {
      setSelectedQuestions([]);
      previousBucketRef.current = selectedBucket;
    }
  }, [selectedBucket]);

  useEffect(() => {
    if (filteredQuestions.length > 0 && questionsPerCandidate > filteredQuestions.length) {
      setQuestionsPerCandidate(filteredQuestions.length);
    }
  }, [filteredQuestions, questionsPerCandidate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading test builder...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Test' : 'Create Test'}</CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update test parameters and question selection.'
            : 'Define the test parameters and select questions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Test Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Test Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="60"
                value={durationMinutes.toString()}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setDurationMinutes(Number.isFinite(next) ? next : 0);
                }}
              />
            </div>
            <div>
              <Label htmlFor="passingPercentage">Passing Percentage</Label>
              <Input
                id="passingPercentage"
                type="number"
                placeholder="70"
                value={passingPercentage.toString()}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setPassingPercentage(Number.isFinite(next) ? next : 0);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bucket">Exam Bank</Label>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger id="bucket">
                  <SelectValue placeholder="Select exam bank" />
                </SelectTrigger>
                <SelectContent>
                  {buckets.map((bucketOption) => (
                    <SelectItem key={bucketOption} value={bucketOption}>
                      {bucketOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Questions shown below are filtered by the selected exam bank.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div>
                <Label>Camera/audio proctoring</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Proctoring is required for all tests. Candidates must allow camera and microphone access.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="questionsPerCandidate">Questions per candidate</Label>
              <Input
                id="questionsPerCandidate"
                type="number"
                min={1}
                placeholder="30"
                value={Number.isFinite(questionsPerCandidate) ? questionsPerCandidate.toString() : ''}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setQuestionsPerCandidate(Number.isFinite(next) ? next : 0);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Each candidate will receive this number of random questions from the selected bank.
              </p>
            </div>
            <div>
              <Label htmlFor="bankSize">Selected bank size</Label>
              <Input
                id="bankSize"
                type="text"
                value={`${selectedBankSize} question${selectedBankSize === 1 ? '' : 's'} selected`}
                disabled
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Select Questions</h3>
              <p className="text-sm text-muted-foreground">
                {selectedQuestions.length} of {filteredQuestions.length} selected
                {selectedBankSize > 0 && questionsPerCandidate > 0
                  ? ` - ${Math.min(questionsPerCandidate, selectedBankSize)} questions per candidate`
                  : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                allSelected ? setSelectedQuestions([]) : setSelectedQuestions([...filteredQuestions])
              }
              disabled={filteredQuestions.length === 0}
            >
              {allSelected ? 'Clear Selection' : 'Select All'}
            </Button>
          </div>
          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            <div className="space-y-2">
              {filteredQuestions.map((question) => (
                <div key={question.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`question-${question.id}`}
                    checked={!!selectedQuestions.find((q) => q.id === question.id)}
                    onCheckedChange={() => toggleQuestion(question)}
                  />
                  <Label htmlFor={`question-${question.id}`} className="cursor-pointer">
                    {question.text} ({question.category}, {question.difficulty}, Bank: {question.test_type || 'Unassigned'})
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={saving} className="w-full mt-6">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Update Test' : 'Create Test'
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isEditMode ? 'Save changes to this test?' : 'Are you absolutely sure?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isEditMode
                  ? 'This will overwrite the current test configuration.'
                  : 'This action cannot be undone. Are you sure you want to create this test?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={saveTest} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update' : 'Create'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default TestCreate;
