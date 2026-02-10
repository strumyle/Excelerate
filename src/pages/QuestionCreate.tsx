
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Trash, Plus, Save } from 'lucide-react';

const QuestionCreate = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [question, setQuestion] = useState({
    text: '',
    options: ['', '', '', ''],
    correct_answer: '',
    category: '',
    difficulty: 'Medium',
    points: 5,
    test_type: 'A', // Default test type
  });
  
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  
  // Fetch existing categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('Fetching categories...');
        const { data, error } = await supabase
          .from('questions')
          .select('category')
          .order('category');
          
        if (error) {
          console.error('Error fetching categories:', error);
          throw error;
        }
        
        console.log('Categories data:', data);
        const uniqueCategories = Array.from(
          new Set(data.map((item: any) => item.category))
        ).filter(Boolean);
        
        console.log('Unique categories:', uniqueCategories);
        setCategories(uniqueCategories as string[]);
      } catch (error) {
        console.error('Error in fetchCategories:', error);
        toast({
          title: "Error",
          description: "Failed to load categories. Please try again.",
          variant: "destructive",
        });
      }
    };
    
    fetchCategories();
  }, [toast]);
  
  // Fetch question if editing
  useEffect(() => {
    if (id) {
      const fetchQuestion = async () => {
        setLoading(true);
        try {
          console.log(`Fetching question with ID: ${id}`);
          const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', id)
            .single();
            
          if (error) {
            console.error('Error fetching question:', error);
            throw error;
          }
          
          console.log('Question data:', data);
          if (data) {
            setQuestion({
              ...data,
              test_type: data.test_type || 'A' // Ensure test_type has default
            });
          }
        } catch (error) {
          console.error('Error in fetchQuestion:', error);
          toast({
            title: 'Error',
            description: 'Failed to load question for editing.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };
      
      fetchQuestion();
    }
  }, [id, toast]);
  
  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...question.options];
    updatedOptions[index] = value;
    setQuestion({ ...question, options: updatedOptions });
  };
  
  const addOption = () => {
    setQuestion({
      ...question,
      options: [...question.options, '']
    });
  };
  
  const removeOption = (index: number) => {
    if (question.options.length <= 2) {
      toast({
        title: 'Cannot remove option',
        description: 'A question must have at least 2 options.',
        variant: 'destructive',
      });
      return;
    }
    
    const updatedOptions = question.options.filter((_, i) => i !== index);
    let updatedCorrectAnswer = question.correct_answer;
    
    if (question.correct_answer === question.options[index]) {
      updatedCorrectAnswer = '';
    }
    
    setQuestion({
      ...question,
      options: updatedOptions,
      correct_answer: updatedCorrectAnswer
    });
  };
  
  const handleCategoryAdd = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setQuestion({ ...question, category: newCategory });
      setNewCategory('');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.text || !question.category || !question.correct_answer) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    // Make sure options array doesn't contain any empty strings
    const cleanedOptions = question.options.filter(opt => opt.trim() !== '');
    if (cleanedOptions.length < 2) {
      toast({
        title: 'Validation error',
        description: 'Please provide at least two valid options.',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const timestamp = new Date().toISOString();
      const questionData = {
        ...question,
        options: cleanedOptions,
        updated_at: timestamp
      };
      
      console.log('Submitting question data:', questionData);
      
      if (id) {
        // Update existing question
        const { error } = await supabase
          .from('questions')
          .update(questionData)
          .eq('id', id);
          
        if (error) {
          console.error('Error updating question:', error);
          throw error;
        }
        
        toast({
          title: 'Question updated',
          description: 'The question has been updated successfully.',
        });
      } else {
        // Create new question
        const { data, error } = await supabase
          .from('questions')
          .insert({
            ...questionData,
            created_at: timestamp
          });
          
        if (error) {
          console.error('Error creating question:', error);
          throw error;
        }
        
        console.log('Question created:', data);
        
        toast({
          title: 'Question created',
          description: 'The new question has been added to the database.',
        });
      }
      
      navigate('/questions');
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save question.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          {id ? 'Edit Question' : 'Create New Question'}
        </h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="question-text">Question Text</Label>
              <Textarea
                id="question-text"
                placeholder="Enter the question here..."
                value={question.text}
                onChange={(e) => setQuestion({ ...question, text: e.target.value })}
                rows={3}
                required
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Answer Options</Label>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  onClick={addOption}
                  disabled={question.options.length >= 6}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Option
                </Button>
              </div>
              
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOption(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="correct-answer">Correct Answer</Label>
                <Select
                  value={question.correct_answer}
                  onValueChange={(value) => setQuestion({ ...question, correct_answer: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option, index) => (
                      <SelectItem key={index} value={option || `placeholder-${index}`} disabled={!option.trim()}>
                        {option || `Option ${index + 1} (empty)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={question.difficulty}
                  onValueChange={(value) => setQuestion({ ...question, difficulty: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={question.category}
                    onValueChange={(value) => setQuestion({ ...question, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  max="100"
                  value={question.points}
                  onChange={(e) => setQuestion({ ...question, points: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-type">Test Type</Label>
                <Select
                  value={question.test_type}
                  onValueChange={(value) => setQuestion({ ...question, test_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Type A</SelectItem>
                    <SelectItem value="B">Type B</SelectItem>
                    <SelectItem value="C">Type C</SelectItem>
                    <SelectItem value="D">Type D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label>New Category</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter new category name"
                  />
                  <Button 
                    type="button"
                    onClick={handleCategoryAdd}
                    disabled={!newCategory.trim() || categories.includes(newCategory)}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/questions')}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitting || !question.text || !question.category || !question.correct_answer}
          >
            <Save className="mr-2 h-4 w-4" />
            {submitting ? 'Saving...' : id ? 'Update Question' : 'Create Question'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuestionCreate;
