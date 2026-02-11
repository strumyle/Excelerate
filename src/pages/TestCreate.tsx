import { useState, useEffect, useMemo } from 'react';
import { supabase, Question } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from 'lucide-react';

const TestCreate = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingPercentage, setPassingPercentage] = useState(70);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [questionsPerCandidate, setQuestionsPerCandidate] = useState(20);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
    selectedQuestions.length === filteredQuestions.length;

  const toggleQuestion = (question: Question) => {
    if (selectedQuestions.find((q) => q.id === question.id)) {
      setSelectedQuestions(selectedQuestions.filter((q) => q.id !== question.id));
    } else {
      setSelectedQuestions([...selectedQuestions, question]);
    }
  };

  const createTest = async () => {
    if (!title) {
      toast({
        title: "Missing title",
        description: "Please provide a title for the test.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBucket) {
      toast({
        title: "Missing bucket",
        description: "Please select an assessment bucket.",
        variant: "destructive",
      });
      return;
    }

    if (selectedQuestions.length === 0) {
      toast({
        title: "No questions selected",
        description: "Please select at least one question.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(questionsPerCandidate) || questionsPerCandidate <= 0) {
      toast({
        title: "Invalid question count",
        description: "Questions per candidate must be at least 1.",
        variant: "destructive",
      });
      return;
    }

    if (questionsPerCandidate > selectedQuestions.length) {
      toast({
        title: "Question count too high",
        description: `Select at least ${questionsPerCandidate} questions or reduce the per-candidate count.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication error",
          description: "You must be logged in to create a test.",
          variant: "destructive",
        });
        return;
      }
      
      // Ensure question_ids is always an array
      const questionIds = selectedQuestions.map(q => q.id);
      
      const { data: test, error } = await supabase
        .from('tests')
        .insert({
          title,
          description,
          duration_minutes: durationMinutes,
          passing_percentage: passingPercentage,
          is_active: true,
          created_by: session.user.id,
          question_ids: questionIds,
          question_count: questionsPerCandidate,
          test_type: selectedBucket === 'Unassigned' ? null : selectedBucket,
        })
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Test created",
        description: "Your test has been created successfully.",
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setDurationMinutes(60);
      setPassingPercentage(70);
      setSelectedQuestions([]);
      setQuestionsPerCandidate(20);
      
      // Redirect to tests page
      navigate('/tests');
      
    } catch (error: any) {
      console.error('Error creating test:', error);
      toast({
        title: "Error creating test",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        // Fetch all questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .order('category', { ascending: true });
          
        if (questionsError) throw questionsError;
        
        // Process questions to ensure test_type is present
        const processedQuestions = questionsData?.map(q => ({
          ...q,
          test_type: q.test_type || ''  // Keep empty for unassigned bucket
        })) as Question[];
        
        setAvailableQuestions(processedQuestions);
        
        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(processedQuestions.map(q => q.category))
        );
        setCategories(uniqueCategories);

        const uniqueBuckets = Array.from(
          new Set(processedQuestions.map(q => q.test_type || 'Unassigned'))
        );
        setBuckets(uniqueBuckets);
        if (!selectedBucket && uniqueBuckets.length > 0) {
          setSelectedBucket(uniqueBuckets[0]);
        }
        
        // Extract unique difficulty levels
        const uniqueDifficulties = Array.from(
          new Set(processedQuestions.map(q => q.difficulty))
        );
        setDifficulties(uniqueDifficulties);

        if (processedQuestions.length > 0 && questionsPerCandidate > processedQuestions.length) {
          setQuestionsPerCandidate(processedQuestions.length);
        }
        
      } catch (error) {
        console.error('Error fetching questions:', error);
        toast({
          title: "Error",
          description: "Failed to load questions.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      setSelectedQuestions([]);
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
        <span className="ml-2 text-xl font-medium">Loading questions...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Test</CardTitle>
        <CardDescription>Define the test parameters and select questions.</CardDescription>
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
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="passingPercentage">Passing Percentage</Label>
              <Input
                id="passingPercentage"
                type="number"
                placeholder="70"
                value={passingPercentage.toString()}
                onChange={(e) => setPassingPercentage(parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bucket">Assessment Bucket</Label>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger id="bucket">
                  <SelectValue placeholder="Select bucket" />
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
                Questions shown below are filtered by the selected bucket.
              </p>
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
                    {question.text} ({question.category}, {question.difficulty}, Bucket: {question.test_type || 'Unassigned'})
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={creating} className="w-full mt-6">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Test"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Are you sure you want to create this test?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={createTest} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
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
