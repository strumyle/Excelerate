
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ClipboardList, 
  Search, 
  Clock, 
  Eye, 
  Copy, 
  Link, 
  Edit, 
  ToggleLeft, 
  ToggleRight,
  Plus
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

interface Test {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  passing_percentage: number;
  question_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  groups: string[];
  proctoring_required: boolean;
}

const Tests = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setTests(data as Test[]);
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTestStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tests')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      setTests(tests.map(test => 
        test.id === id ? { ...test, is_active: !currentStatus } : test
      ));
      
      toast({
        title: `Test ${!currentStatus ? 'activated' : 'deactivated'}`,
        description: `The test has been ${!currentStatus ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error toggling test status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update test status.',
        variant: 'destructive',
      });
    }
  };

  const copyTestLink = (id: string) => {
    const testUrl = `${window.location.origin}/exam/${id}`;
    navigator.clipboard.writeText(testUrl).then(() => {
      toast({
        title: 'Link copied',
        description: 'Test link has been copied to clipboard',
      });
    });
  };

  const filteredTests = tests.filter(test => 
    test.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tests</h1>
        <Button asChild>
          <RouterLink to="/tests/create">
            <Plus className="mr-2 h-4 w-4" /> Create Test
          </RouterLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tests Library</CardTitle>
          <CardDescription>
            Manage your Excel proficiency tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600"></div>
              <p className="mt-2 text-muted-foreground">Loading tests...</p>
            </div>
          ) : filteredTests.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Test Title</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Proctoring</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{test.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {test.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{test.question_ids.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                          <span>{test.duration_minutes} min</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-600">Required</Badge>
                      </TableCell>
                      <TableCell>
                        {test.is_active ? (
                          <Badge className="bg-green-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="icon" asChild>
                            <RouterLink to={`/tests/edit/${test.id}`}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </RouterLink>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyTestLink(test.id)}>
                            <Link className="h-4 w-4" />
                            <span className="sr-only">Copy Link</span>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <RouterLink to={`/exam/${test.id}`} target="_blank">
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Preview</span>
                            </RouterLink>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTestStatus(test.id, test.is_active)}
                          >
                            {test.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="sr-only">
                              {test.is_active ? 'Deactivate' : 'Activate'}
                            </span>
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No tests found</p>
              <Button asChild>
                <RouterLink to="/tests/create">Create your first test</RouterLink>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Tests;
