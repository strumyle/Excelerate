import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Download, Loader2, UserCheck } from 'lucide-react';
import { Test, User } from '@/lib/supabase';

type AssignmentMode = 'unit' | 'csv';

interface AssignmentRow {
  id: string;
  user_id: string;
  test_id: string;
  question_count: number;
  is_active: boolean;
  assigned_via: string;
  source_unit: string | null;
  source_file_name: string | null;
  created_at: string;
}

interface AssignmentResult {
  created: number;
  updated: number;
  skippedStarted: number;
}

export default function TestAssign() {
  const [tests, setTests] = useState<Test[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<AssignmentRow[]>([]);

  const [selectedUnitTestId, setSelectedUnitTestId] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [unitQuestionCount, setUnitQuestionCount] = useState<string>('20');

  const [selectedCsvTestId, setSelectedCsvTestId] = useState<string>('');
  const [csvQuestionCount, setCsvQuestionCount] = useState<string>('20');
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isAssigningUnit, setIsAssigningUnit] = useState(false);
  const [isAssigningCsv, setIsAssigningCsv] = useState(false);

  const testsById = useMemo(
    () => new Map(tests.map((test) => [test.id, test])),
    [tests]
  );

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  );

  useEffect(() => {
    void fetchData();
  }, []);

  const getDefaultQuestionCount = (testId: string) => {
    const test = testsById.get(testId);
    if (!test) return null;
    const bankSize = test.question_ids?.length || 0;
    if (bankSize === 0) return null;
    const preferred = test.question_count ?? bankSize;
    return Math.min(preferred, bankSize);
  };

  useEffect(() => {
    if (!selectedUnitTestId) return;
    const defaultCount = getDefaultQuestionCount(selectedUnitTestId);
    if (defaultCount !== null) {
      setUnitQuestionCount(String(defaultCount));
    }
  }, [selectedUnitTestId, testsById]);

  useEffect(() => {
    if (!selectedCsvTestId) return;
    const defaultCount = getDefaultQuestionCount(selectedCsvTestId);
    if (defaultCount !== null) {
      setCsvQuestionCount(String(defaultCount));
    }
  }, [selectedCsvTestId, testsById]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ data: testsData, error: testsError }, { data: usersData, error: usersError }] =
        await Promise.all([
          supabase.from('tests').select('*').order('created_at', { ascending: false }),
          supabase.from('users').select('id, email, full_name, role, unit, user_group'),
        ]);

      if (testsError) throw new Error(testsError.message);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        setUsers([]);
        setUnits([]);
      } else {
        const typedUsers = (usersData || []) as unknown as User[];
        setUsers(typedUsers);

        const unitSet = new Set<string>();
        typedUsers.forEach((user) => {
          if (user.unit) unitSet.add(user.unit);
          if (user.user_group) unitSet.add(user.user_group);
        });
        setUnits(Array.from(unitSet).sort((a, b) => a.localeCompare(b)));
      }

      setTests((testsData || []) as unknown as Test[]);
      await fetchRecentAssignments();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load test assignment data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentAssignments = async () => {
    const { data, error } = await supabase
      .from('test_assignments')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    setRecentAssignments((data || []) as AssignmentRow[]);
  };

  const extractEmails = (text: string) => {
    const tokens = text
      .split(/[,;\n\r\t]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = tokens
      .map((value) => value.toLowerCase())
      .filter((value) => emailRegex.test(value));

    return Array.from(new Set(emails));
  };

  const handleCsvUpload = async (file: File | null) => {
    if (!file) {
      setCsvEmails([]);
      setCsvFileName('');
      return;
    }

    try {
      const text = await file.text();
      const emails = extractEmails(text);
      setCsvEmails(emails);
      setCsvFileName(file.name);

      if (emails.length === 0) {
        toast({
          title: 'No emails found',
          description: 'Upload a CSV with at least one valid email.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reading CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to read CSV file.',
        variant: 'destructive',
      });
    }
  };

  const downloadCsvTemplate = () => {
    const csvTemplate = ['email', 'jane.doe@babbangona.com', 'john.smith@babbangona.com'].join('\n');
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'assign_test_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Template downloaded',
      description: 'Use this CSV to assign tests to individuals.',
    });
  };

  const parseQuestionCount = (raw: string, available: number) => {
    const requested = Number.parseInt(raw, 10);
    const minCount = 1;
    const sanitized = Number.isFinite(requested) ? requested : minCount;
    const bounded = Math.max(minCount, sanitized);
    const capped = Math.min(bounded, available);
    return {
      requested: bounded,
      finalCount: capped,
      capped: bounded > available,
    };
  };

  const assignToUsers = async (
    userIds: string[],
    test: Test,
    questionCount: number,
    mode: AssignmentMode,
    metadata?: { sourceUnit?: string; sourceFileName?: string }
  ): Promise<AssignmentResult> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const assignedBy = sessionData.session?.user.id ?? null;

    const { data: existingAssignments, error: existingError } = await supabase
      .from('test_assignments')
      .select('id, user_id')
      .eq('test_id', test.id)
      .eq('is_active', true)
      .in('user_id', userIds);

    if (existingError) throw new Error(existingError.message);

    const existingMap = new Map((existingAssignments || []).map((row) => [row.user_id, row]));
    const assignmentIds = (existingAssignments || []).map((row) => row.id);

    let startedAssignmentIds = new Set<string>();
    if (assignmentIds.length > 0) {
      const { data: startedRows, error: startedError } = await supabase
        .from('test_submissions')
        .select('assignment_id')
        .in('assignment_id', assignmentIds);

      if (startedError) throw new Error(startedError.message);
      startedAssignmentIds = new Set(
        (startedRows || [])
          .map((row) => row.assignment_id)
          .filter((value): value is string => Boolean(value))
      );
    }

    const updateIds: string[] = [];
    const insertRows: Array<{
      user_id: string;
      test_id: string;
      question_count: number;
      is_active: boolean;
      assigned_by: string | null;
      assigned_via: AssignmentMode;
      source_unit: string | null;
      source_file_name: string | null;
    }> = [];

    let skippedStarted = 0;

    userIds.forEach((userId) => {
      const existing = existingMap.get(userId);
      if (!existing) {
        insertRows.push({
          user_id: userId,
          test_id: test.id,
          question_count: questionCount,
          is_active: true,
          assigned_by: assignedBy,
          assigned_via: mode,
          source_unit: metadata?.sourceUnit || null,
          source_file_name: metadata?.sourceFileName || null,
        });
        return;
      }

      if (startedAssignmentIds.has(existing.id)) {
        skippedStarted += 1;
        return;
      }

      updateIds.push(existing.id);
    });

    if (updateIds.length > 0) {
      const { error: updateError } = await supabase
        .from('test_assignments')
        .update({
          question_count: questionCount,
          assigned_by: assignedBy,
          assigned_via: mode,
          source_unit: metadata?.sourceUnit || null,
          source_file_name: metadata?.sourceFileName || null,
          updated_at: new Date().toISOString(),
        })
        .in('id', updateIds);

      if (updateError) throw new Error(updateError.message);
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase.from('test_assignments').insert(insertRows);
      if (insertError) throw new Error(insertError.message);
    }

    return {
      created: insertRows.length,
      updated: updateIds.length,
      skippedStarted,
    };
  };

  const handleAssignToUnit = async () => {
    if (!selectedUnitTestId || !selectedUnit) {
      toast({
        title: 'Missing inputs',
        description: 'Select both test and unit.',
        variant: 'destructive',
      });
      return;
    }

    const selectedTest = testsById.get(selectedUnitTestId);
    if (!selectedTest) {
      toast({
        title: 'Invalid test',
        description: 'Selected test was not found.',
        variant: 'destructive',
      });
      return;
    }

    const availableCount = selectedTest.question_ids?.length || 0;
    if (availableCount < 1) {
      toast({
        title: 'No question bank',
        description: 'Selected test has no questions.',
        variant: 'destructive',
      });
      return;
    }

    const { requested, finalCount, capped } = parseQuestionCount(unitQuestionCount, availableCount);

    let unitUsers = users.filter(
      (user) =>
        (user.unit === selectedUnit || user.user_group === selectedUnit) &&
        user.role !== 'admin'
    );

    if (unitUsers.length === 0) {
      const safeUnit = selectedUnit.replace(/"/g, '\\"');
      const { data: fetchedUnitUsers, error: fetchedUnitUsersError } = await supabase
        .from('users')
        .select('id, email, full_name, role, unit, user_group')
        .or(`unit.eq."${safeUnit}",user_group.eq."${safeUnit}"`);

      if (!fetchedUnitUsersError && fetchedUnitUsers) {
        unitUsers = (fetchedUnitUsers as User[]).filter((user) => user.role !== 'admin');
      }
    }

    if (unitUsers.length === 0) {
      toast({
        title: 'No users found',
        description: `No candidate users found in ${selectedUnit}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsAssigningUnit(true);
    try {
      const result = await assignToUsers(
        unitUsers.map((user) => user.id),
        selectedTest,
        finalCount,
        'unit',
        { sourceUnit: selectedUnit }
      );

      await fetchRecentAssignments();

      toast({
        title: 'Assignment complete',
        description: `Created: ${result.created}, updated: ${result.updated}, skipped (started): ${result.skippedStarted}.${capped ? ` Requested ${requested}, capped to ${finalCount}.` : ''}`,
      });
    } catch (error) {
      console.error('Error assigning unit:', error);
      const message = error instanceof Error ? error.message : 'Failed to assign test to unit.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAssigningUnit(false);
    }
  };

  const handleAssignToCsv = async () => {
    if (!selectedCsvTestId) {
      toast({
        title: 'Missing test',
        description: 'Select a test first.',
        variant: 'destructive',
      });
      return;
    }

    if (csvEmails.length === 0) {
      toast({
        title: 'Missing CSV emails',
        description: 'Upload a CSV with valid emails.',
        variant: 'destructive',
      });
      return;
    }

    const selectedTest = testsById.get(selectedCsvTestId);
    if (!selectedTest) {
      toast({
        title: 'Invalid test',
        description: 'Selected test was not found.',
        variant: 'destructive',
      });
      return;
    }

    const availableCount = selectedTest.question_ids?.length || 0;
    if (availableCount < 1) {
      toast({
        title: 'No question bank',
        description: 'Selected test has no questions.',
        variant: 'destructive',
      });
      return;
    }

    const { requested, finalCount, capped } = parseQuestionCount(csvQuestionCount, availableCount);
    const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    let matchedUsers = csvEmails
      .map((email) => usersByEmail.get(email))
      .filter((user): user is User => Boolean(user))
      .filter((user) => user.role !== 'admin');

    if (matchedUsers.length < csvEmails.length) {
      const { data: fetchedUsers, error: fetchedUsersError } = await supabase
        .from('users')
        .select('id, email, full_name, role, unit, user_group')
        .in('email', csvEmails);

      if (!fetchedUsersError && fetchedUsers) {
        const fetchedByEmail = new Map(
          (fetchedUsers as User[]).map((user) => [user.email.toLowerCase(), user])
        );
        matchedUsers = csvEmails
          .map((email) => fetchedByEmail.get(email) || usersByEmail.get(email))
          .filter((user): user is User => Boolean(user))
          .filter((user) => user.role !== 'admin');
      }
    }

    const matchedEmailSet = new Set(matchedUsers.map((user) => user.email.toLowerCase()));
    const missingEmails = csvEmails.filter((email) => !matchedEmailSet.has(email));

    if (matchedUsers.length === 0) {
      toast({
        title: 'No matching users',
        description: `None of the ${csvEmails.length} emails matched candidate users.`,
        variant: 'destructive',
      });
      return;
    }

    setIsAssigningCsv(true);
    try {
      const result = await assignToUsers(
        matchedUsers.map((user) => user.id),
        selectedTest,
        finalCount,
        'csv',
        { sourceFileName: csvFileName || null }
      );

      await fetchRecentAssignments();

      toast({
        title: 'CSV assignment complete',
        description: `Created: ${result.created}, updated: ${result.updated}, skipped (started): ${result.skippedStarted}, missing emails: ${missingEmails.length}.${capped ? ` Requested ${requested}, capped to ${finalCount}.` : ''}`,
      });
    } catch (error) {
      console.error('Error assigning CSV:', error);
      const message = error instanceof Error ? error.message : 'Failed to assign test from CSV.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAssigningCsv(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Assign Tests</h1>
      {tests.length === 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          No tests found. Create a test first.
        </p>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Assign Test to Unit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Select Test</label>
              <Select value={selectedUnitTestId} onValueChange={setSelectedUnitTestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a test" />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Select Unit/Department</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Question Count</label>
              <Input
                type="number"
                min={1}
                value={unitQuestionCount}
                onChange={(event) => setUnitQuestionCount(event.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full md:w-auto"
            onClick={handleAssignToUnit}
            disabled={isAssigningUnit || !selectedUnitTestId || !selectedUnit}
          >
            {isAssigningUnit ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign to Unit'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Assign Test to Individuals (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Select Test</label>
              <Select value={selectedCsvTestId} onValueChange={setSelectedCsvTestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a test" />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Question Count</label>
              <Input
                type="number"
                min={1}
                value={csvQuestionCount}
                onChange={(event) => setCsvQuestionCount(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Upload CSV Emails</label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleCsvUpload(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={downloadCsvTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </div>
          </div>

          {csvFileName && (
            <p className="text-xs text-muted-foreground">
              Loaded {csvEmails.length} valid emails from {csvFileName}.
            </p>
          )}

          <Button
            className="w-full md:w-auto"
            onClick={handleAssignToCsv}
            disabled={isAssigningCsv || !selectedCsvTestId || csvEmails.length === 0}
          >
            {isAssigningCsv ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign from CSV'
            )}
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-4">Recent Active Assignments</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentAssignments.map((assignment) => {
          const test = testsById.get(assignment.test_id);
          const user = usersById.get(assignment.user_id);

          return (
            <Card key={assignment.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  {test?.title || 'Unknown Test'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Candidate:</span>{' '}
                  {user?.full_name || user?.email || assignment.user_id}
                </div>
                <div>
                  <span className="text-muted-foreground">Question Count:</span>{' '}
                  {assignment.question_count}
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned Via:</span>{' '}
                  {assignment.assigned_via}
                </div>
                {assignment.source_unit && (
                  <div>
                    <span className="text-muted-foreground">Unit:</span> {assignment.source_unit}
                  </div>
                )}
                {assignment.source_file_name && (
                  <div>
                    <span className="text-muted-foreground">CSV:</span> {assignment.source_file_name}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {recentAssignments.length === 0 && (
          <div className="col-span-full text-gray-500 text-center py-4">
            No active assignments found.
          </div>
        )}
      </div>
    </div>
  );
}
