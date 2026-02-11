
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [bucket, setBucket] = useState('all');
  const [buckets, setBuckets] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [renaming, setRenaming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [category, bucket]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data: metadataData, error: metadataError } = await supabase
        .from('questions')
        .select('category, test_type');

      if (metadataError) throw metadataError;

      let query = supabase.from('questions').select('*');
      
      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (bucket !== 'all') {
        if (bucket === 'Unassigned') {
          query = query.is('test_type', null);
        } else {
          query = query.eq('test_type', bucket);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Ensure questions have the test_type field
      const processedData = data?.map(q => ({
        ...q,
        test_type: q.test_type || ''  // Keep empty for unassigned display
      })) as Question[];
      
      setQuestions(processedData);
      
      const uniqueCategories = Array.from(
        new Set((metadataData || []).map((q) => q.category).filter(Boolean))
      );
      setCategories(uniqueCategories);

      const uniqueBuckets = Array.from(
        new Set((metadataData || []).map((q) => q.test_type || 'Unassigned'))
      );
      setBuckets(uniqueBuckets);
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

  const handleRenameBucket = async () => {
    const trimmed = renameTo.trim();
    if (!renameFrom) {
      toast({
        title: 'Select a bucket',
        description: 'Choose a bucket to rename.',
        variant: 'destructive',
      });
      return;
    }
    if (!trimmed) {
      toast({
        title: 'Missing bucket name',
        description: 'Enter the new bucket name.',
        variant: 'destructive',
      });
      return;
    }
    if (renameFrom === trimmed) {
      toast({
        title: 'No changes',
        description: 'The new bucket name matches the current one.',
      });
      return;
    }

    setRenaming(true);
    try {
      let updateQuery = supabase.from('questions').update({ test_type: trimmed });
      if (renameFrom === 'Unassigned') {
        updateQuery = updateQuery.is('test_type', null);
      } else {
        updateQuery = updateQuery.eq('test_type', renameFrom);
      }

      const { error } = await updateQuery;
      if (error) throw error;

      toast({
        title: 'Bucket renamed',
        description: `Updated ${renameFrom} to ${trimmed}.`,
      });

      if (bucket === renameFrom) {
        setBucket(trimmed);
      }

      setRenameOpen(false);
      setRenameTo('');
      await fetchQuestions();
    } catch (error) {
      console.error('Error renaming bucket:', error);
      toast({
        title: 'Rename failed',
        description: 'Unable to rename the bucket right now.',
        variant: 'destructive',
      });
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Questions Library</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={renameOpen}
            onOpenChange={(open) => {
              setRenameOpen(open);
              if (open && !renameFrom) {
                setRenameFrom(bucket !== 'all' ? bucket : buckets[0] || '');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Rename Bucket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Assessment Bucket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rename-from">Current Bucket</Label>
                  <Select value={renameFrom} onValueChange={setRenameFrom}>
                    <SelectTrigger id="rename-from">
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
                </div>
                <div>
                  <Label htmlFor="rename-to">New Bucket Name</Label>
                  <Input
                    id="rename-to"
                    value={renameTo}
                    onChange={(event) => setRenameTo(event.target.value)}
                    placeholder="Enter new bucket name"
                  />
                </div>
                <Button onClick={handleRenameBucket} disabled={renaming}>
                  {renaming ? 'Renaming...' : 'Rename Bucket'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
          <Select value={bucket} onValueChange={setBucket}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Assessment Bucket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buckets</SelectItem>
              {buckets.map((bucketOption) => (
                <SelectItem key={bucketOption} value={bucketOption}>
                  {bucketOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  <TableHead>Assessment Bucket</TableHead>
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
                    <TableCell>{question.test_type || 'Unassigned'}</TableCell>
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
