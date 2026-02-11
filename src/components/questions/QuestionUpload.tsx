import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileJson, FileSpreadsheet, Check, Download, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ParsedQuestion {
  text: string;
  options: string[];
  correct_answer: string;
  category: string;
  difficulty: string;
  test_type: string;
  points: number;
}

interface QuestionUploadProps {
  forcedBank?: string;
}

export function QuestionUpload({ forcedBank }: QuestionUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const sampleBank = forcedBank || 'Assessment 1';

  // CSV Template content
  const csvTemplate = `text,option_a,option_b,option_c,option_d,correct_answer,category,difficulty,test_type,points
"What is the keyboard shortcut to copy cells in Excel?","Ctrl+C","Ctrl+V","Ctrl+X","Ctrl+Z","Ctrl+C","Shortcuts","Easy","${sampleBank}",5
"Which function returns the average of a range?","SUM","AVERAGE","COUNT","MAX","AVERAGE","Functions","Easy","${sampleBank}",5
"What does the VLOOKUP function do?","Counts cells","Looks up values vertically","Sums values","Finds maximum","Looks up values vertically","Functions","Medium","${sampleBank}",10`;

  const downloadCsvTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'questions_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Template downloaded",
      description: "Fill in the CSV template and upload it to add questions.",
    });
  };

  const parseCsv = (csvText: string): { questions: ParsedQuestion[]; errors: string[] } => {
    const errors: string[] = [];
    const questions: ParsedQuestion[] = [];
    
    // Split by newlines and handle potential Windows line endings
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      errors.push('CSV must have at least a header row and one data row');
      return { questions, errors };
    }
    
    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    const requiredHeaders = ['text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'category', 'difficulty'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
      return { questions, errors };
    }
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const values = parseCSVLine(line);
        
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index]?.trim() || '';
        });
        
        // Validate required fields
        if (!rowData.text) {
          errors.push(`Row ${i + 1}: Missing question text`);
          continue;
        }
        
        if (!rowData.correct_answer) {
          errors.push(`Row ${i + 1}: Missing correct answer`);
          continue;
        }
        
        // Build options array
        const options = [
          rowData.option_a,
          rowData.option_b,
          rowData.option_c,
          rowData.option_d
        ].filter(o => o);
        
        if (options.length < 2) {
          errors.push(`Row ${i + 1}: At least 2 options are required`);
          continue;
        }
        
        // Verify correct answer is one of the options
        if (!options.includes(rowData.correct_answer)) {
          errors.push(`Row ${i + 1}: Correct answer must match one of the options`);
          continue;
        }
        
        questions.push({
          text: rowData.text,
          options,
          correct_answer: rowData.correct_answer,
          category: rowData.category || 'General',
          difficulty: rowData.difficulty || 'Medium',
          test_type: forcedBank || rowData.test_type || 'General',
          points: parseInt(rowData.points) || 5
        });
      } catch (err) {
        errors.push(`Row ${i + 1}: Failed to parse - ${err}`);
      }
    }
    
    return { questions, errors };
  };

  // Parse a single CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  };

  const validateJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!Array.isArray(parsed)) {
        return 'JSON must be an array of questions';
      }
      
      for (const item of parsed) {
        if (!item.text || !item.options || !item.correct_answer || !item.category || !item.difficulty) {
          return 'Each question must have text, options, correct_answer, category, and difficulty fields';
        }
        
        if (!Array.isArray(item.options)) {
          return 'Options must be an array for each question';
        }
      }
      
      return null;
    } catch (e) {
      return 'Invalid JSON format';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParseErrors([]);
    
    // Read file content
    const content = await selectedFile.text();
    
    if (selectedFile.name.endsWith('.json')) {
      setJsonContent(content);
    } else if (selectedFile.name.endsWith('.csv')) {
      // Preview CSV parse
      const { errors } = parseCsv(content);
      if (errors.length > 0) {
        setParseErrors(errors);
      }
    }
  };

  const handleJsonContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonContent(e.target.value);
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    setParseErrors([]);
    
    try {
      const content = await file.text();
      let preparedQuestions: ParsedQuestion[] = [];
      
      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const { questions, errors } = parseCsv(content);
        
        if (errors.length > 0) {
          setParseErrors(errors);
          if (questions.length === 0) {
            toast({
              title: "CSV validation failed",
              description: `${errors.length} error(s) found. Please fix them and try again.`,
              variant: "destructive",
            });
            setUploading(false);
            return;
          }
          // Allow partial upload with warnings
          toast({
            title: "Warning",
            description: `${errors.length} row(s) skipped due to errors. ${questions.length} valid questions will be uploaded.`,
          });
        }
        
        preparedQuestions = questions;
      } else if (file.name.endsWith('.json')) {
        const validationError = validateJson(content);
        
        if (validationError) {
          toast({
            title: "JSON validation error",
            description: validationError,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }
        
        const parsed = JSON.parse(content);
        preparedQuestions = parsed.map((q: any) => ({
          text: q.text,
          options: q.options,
          correct_answer: q.correct_answer,
          category: q.category,
          difficulty: q.difficulty || 'Medium',
          test_type: forcedBank || q.test_type || 'General',
          points: q.points || 5,
        }));
      } else {
        toast({
          title: "Unsupported file format",
          description: "Please upload a JSON or CSV file.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      
      if (preparedQuestions.length === 0) {
        toast({
          title: "No questions found",
          description: "The file contains no valid questions to upload.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      
      // Add timestamps
      const questionsWithTimestamps = preparedQuestions.map(q => ({
        ...q,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      
      console.log('Uploading questions:', questionsWithTimestamps);
      
      const { error } = await supabase.from('questions').insert(questionsWithTimestamps);
      
      if (error) throw error;
      
      toast({
        title: "Upload successful",
        description: (
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{questionsWithTimestamps.length} questions have been added to the database.</span>
          </div>
        ),
      });
      
      // Reset form
      setFile(null);
      setJsonContent('');
      setParseErrors([]);
      
      // Reset file input
      const fileInput = document.getElementById('file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleJsonUpload = async () => {
    if (!jsonContent.trim()) {
      toast({
        title: "No JSON content",
        description: "Please enter valid JSON content.",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      const validationError = validateJson(jsonContent);
      
      if (validationError) {
        toast({
          title: "JSON validation error",
          description: validationError,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      
      const questions = JSON.parse(jsonContent);
      
      const preparedQuestions = questions.map((q: any) => ({
        text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
        category: q.category,
        difficulty: q.difficulty || 'Medium',
        points: q.points || 5,
        test_type: forcedBank || q.test_type || 'General',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      
      console.log('Uploading questions from JSON editor:', preparedQuestions);
      
      const { error } = await supabase.from('questions').insert(preparedQuestions);
      
      if (error) throw error;
      
      toast({
        title: "Upload successful",
        description: (
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{preparedQuestions.length} questions have been added to the database.</span>
          </div>
        ),
      });
      
      setJsonContent('');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const jsonExample = JSON.stringify([
    {
      "text": "Which Excel function is used to find the highest value in a range?",
      "options": ["MAX", "SUM", "AVERAGE", "COUNT"],
      "correct_answer": "MAX",
      "category": "Functions",
      "difficulty": "Easy",
      "test_type": "${sampleBank}",
      "points": 5
    }
  ], null, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upload Questions</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadCsvTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download CSV Template
          </Button>
        </CardTitle>
        <CardDescription>
          Bulk upload questions from CSV or JSON files. Download the template to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forcedBank && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload target is locked to <strong>{forcedBank}</strong>. Uploaded questions will be saved to this exam bank.
            </AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Upload File</TabsTrigger>
            <TabsTrigger value="json">JSON Editor</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file">Select File (CSV or JSON)</Label>
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Input 
                  id="file" 
                  type="file" 
                  accept=".json,.csv" 
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CSV or JSON (max 5MB)
                    </p>
                    {file && (
                      <div className="mt-4 text-sm font-medium text-accent flex items-center">
                        {file.name.endsWith('.json') ? (
                          <FileJson className="h-4 w-4 mr-2" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                        )}
                        {file.name}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
            
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Validation errors found:</div>
                  <ul className="text-sm space-y-1 max-h-32 overflow-auto">
                    {parseErrors.slice(0, 5).map((error, i) => (
                      <li key={i}>- {error}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...and {parseErrors.length - 5} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label>CSV Format Guide</Label>
              <div className="p-4 border rounded-md bg-muted/50">
                <p className="text-sm mb-2">Your CSV should include these columns:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="font-mono bg-secondary px-1 rounded">text</span> - Question text (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">option_a</span> - First option (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">option_b</span> - Second option (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">option_c</span> - Third option (optional)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">option_d</span> - Fourth option (optional)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">correct_answer</span> - Must match an option (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">category</span> - e.g., Functions, Shortcuts (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">difficulty</span> - Easy, Medium, Hard (required)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">test_type</span> - e.g., Assessment 1 (optional)</div>
                  <div><span className="font-mono bg-secondary px-1 rounded">points</span> - Point value (optional, default: 5)</div>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="json" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="json-content">JSON Content</Label>
              <Textarea 
                id="json-content" 
                placeholder="Paste your JSON content here..."
                className="font-mono min-h-[300px]"
                value={jsonContent}
                onChange={handleJsonContentChange}
              />
              <p className="text-xs text-muted-foreground">
                Enter a valid JSON array of question objects.
              </p>
            </div>
            <div className="p-4 border rounded-md">
              <div className="flex items-center mb-2">
                <FileJson className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">JSON Example</span>
              </div>
              <pre className="text-xs overflow-auto p-2 bg-muted rounded-sm max-h-40">
                {jsonExample}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          variant="default" 
          onClick={jsonContent ? handleJsonUpload : handleFileUpload}
          disabled={uploading || (!file && !jsonContent)}
        >
          {uploading ? (
            <>
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Questions
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
