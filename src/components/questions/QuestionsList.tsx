
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Question } from '@/lib/supabase';
import { Edit, Trash2, Search, Plus, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export function QuestionsList() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [category]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let query = supabase.from('questions').select('*');
      
      if (category !== 'all') {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Ensure questions have the test_type field
      const processedData = data?.map(q => ({
        ...q,
        test_type: q.test_type || 'A'  // Provide default if not present
      })) as Question[];
      
      setQuestions(processedData);
      
      // Extract unique categories
      if (processedData) {
        const uniqueCategories = Array.from(
          new Set(processedData.map(q => q.category))
        );
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuestions = questions.filter(question => 
    question.text.toLowerCase().includes(search.toLowerCase())
  );

  const truncateText = (text: string, maxLength = 50) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const downloadAllQuestions = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: true });
      if (error) throw error;

      const rows = (data || []).map((question) => {
        const options = Array.isArray(question.options) ? question.options : [];
        const [optionA, optionB, optionC, optionD] = options;
        return [
          question.text,
          optionA || '',
          optionB || '',
          optionC || '',
          optionD || '',
          question.correct_answer || '',
          question.category || '',
          question.difficulty || '',
          question.test_type || '',
          question.points ?? '',
        ];
      });

      const header = [
        'text',
        'option_a',
        'option_b',
        'option_c',
        'option_d',
        'correct_answer',
        'category',
        'difficulty',
        'test_type',
        'points',
      ];

      const csvLines = [header, ...rows]
        .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
        .join('\n');

      const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'question_bank.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download ready',
        description: `Exported ${rows.length} questions.`,
      });
    } catch (error) {
      console.error('Error downloading questions:', error);
      toast({
        title: 'Download failed',
        description: 'Unable to export questions right now.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Questions Library</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadAllQuestions}
            disabled={downloading}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Preparing...' : 'Download All'}
          </Button>
          <Button asChild>
            <Link to="/questions/create">
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600"></div>
            <p className="mt-2 text-muted-foreground">Loading questions...</p>
          </div>
        ) : filteredQuestions.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell>{truncateText(question.text)}</TableCell>
                    <TableCell>{question.category}</TableCell>
                    <TableCell>{question.test_type || 'A'}</TableCell>
                    <TableCell>{question.difficulty}</TableCell>
                    <TableCell>{question.points}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/questions/edit/${question.id}`}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No questions found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
