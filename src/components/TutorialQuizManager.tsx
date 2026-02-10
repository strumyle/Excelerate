
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface QuizQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

interface TutorialQuizManagerProps {
  tutorialId: string;
  tutorialTitle: string;
}

export function TutorialQuizManager({ tutorialId, tutorialTitle }: TutorialQuizManagerProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A'
  });

  useEffect(() => {
    fetchQuestions();
  }, [tutorialId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tutorial_quiz_questions')
        .select('*')
        .eq('tutorial_id', tutorialId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: "Error",
        description: "Failed to load quiz questions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text.trim() || !newQuestion.option_a.trim() || 
        !newQuestion.option_b.trim() || !newQuestion.option_c.trim() || 
        !newQuestion.option_d.trim()) {
      toast({
        title: "Validation Error",
        description: "All fields are required.",
        variant: "destructive"
      });
      return;
    }

    setAdding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('tutorial_quiz_questions')
        .insert({
          tutorial_id: tutorialId,
          question_text: newQuestion.question_text.trim(),
          option_a: newQuestion.option_a.trim(),
          option_b: newQuestion.option_b.trim(),
          option_c: newQuestion.option_c.trim(),
          option_d: newQuestion.option_d.trim(),
          correct_answer: newQuestion.correct_answer,
          created_by: sessionData.session.user.id
        });

      if (error) throw error;

      setNewQuestion({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A'
      });
      
      setShowAddForm(false);
      await fetchQuestions();
      
      toast({
        title: "Question Added",
        description: "Quiz question has been added successfully.",
      });
    } catch (error) {
      console.error('Error adding question:', error);
      toast({
        title: "Error",
        description: "Failed to add quiz question.",
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tutorial_quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== questionId));
      
      toast({
        title: "Question Deleted",
        description: "Quiz question has been deleted.",
      });
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: "Error",
        description: "Failed to delete question.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quiz Questions for "{tutorialTitle}"</span>
          <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Quiz Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="question_text">Question *</Label>
                  <Textarea
                    id="question_text"
                    value={newQuestion.question_text}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, question_text: e.target.value }))}
                    placeholder="Enter the question"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="option_a">Option A *</Label>
                    <Input
                      id="option_a"
                      value={newQuestion.option_a}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, option_a: e.target.value }))}
                      placeholder="Option A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="option_b">Option B *</Label>
                    <Input
                      id="option_b"
                      value={newQuestion.option_b}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, option_b: e.target.value }))}
                      placeholder="Option B"
                    />
                  </div>
                  <div>
                    <Label htmlFor="option_c">Option C *</Label>
                    <Input
                      id="option_c"
                      value={newQuestion.option_c}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, option_c: e.target.value }))}
                      placeholder="Option C"
                    />
                  </div>
                  <div>
                    <Label htmlFor="option_d">Option D *</Label>
                    <Input
                      id="option_d"
                      value={newQuestion.option_d}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, option_d: e.target.value }))}
                      placeholder="Option D"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="correct_answer">Correct Answer *</Label>
                  <Select value={newQuestion.correct_answer} onValueChange={(value) => setNewQuestion(prev => ({ ...prev, correct_answer: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddQuestion} disabled={adding} className="flex-1">
                    {adding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Question'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading questions...</span>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No quiz questions added yet. Add questions to enable the practice quiz for this tutorial.
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Question {index + 1}</h4>
                    <p className="mb-3">{question.question_text}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`p-2 rounded ${question.correct_answer === 'A' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        A. {question.option_a}
                      </div>
                      <div className={`p-2 rounded ${question.correct_answer === 'B' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        B. {question.option_b}
                      </div>
                      <div className={`p-2 rounded ${question.correct_answer === 'C' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        C. {question.option_c}
                      </div>
                      <div className={`p-2 rounded ${question.correct_answer === 'D' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        D. {question.option_d}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
