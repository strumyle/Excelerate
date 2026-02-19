
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Download, Loader2, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Test, User } from '@/lib/supabase';

type AssignmentMode = 'unit' | 'csv';

type AssignmentStatus = 'not_started' | 'in_progress' | 'failed' | 'submitted';

interface AssignmentRow {
  id: string;
  user_id: string;
  test_id: string;
  question_count: number;
  is_active: boolean;
  available_until: string | null;
  assigned_via: string;
  source_unit: string | null;
  source_file_name: string | null;
  created_at: string;
  updated_at?: string;
}

interface SubmissionRow {
  id: string;
  assignment_id: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  violations_count: number | null;
  violations: any[] | null;
}

interface RetakePermissionRow {
  user_id: string;
  test_id: string;
  remaining_attempts: number | null;
}

interface LegacyRetakePermissionRow {
  user_id: string;
  test_id: string;
}

interface AssignmentResult {
  created: number;
  updated: number;
  skippedStarted: number;
}

const GRACE_MINUTES = 15;

export default function TestAssign() {
  const [tests, setTests] = useState<Test[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [retakePermissions, setRetakePermissions] = useState<Map<string, number>>(new Map());
  const [retakeDrafts, setRetakeDrafts] = useState<Record<string, string>>({});

  const [selectedUnitTestId, setSelectedUnitTestId] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [unitQuestionCount, setUnitQuestionCount] = useState<string>('20');
  const [unitAvailabilityMinutes, setUnitAvailabilityMinutes] = useState<string>('1440');

  const [selectedCsvTestId, setSelectedCsvTestId] = useState<string>('');
  const [csvQuestionCount, setCsvQuestionCount] = useState<string>('20');
  const [csvAvailabilityMinutes, setCsvAvailabilityMinutes] = useState<string>('1440');
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');

  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentTestFilter, setAssignmentTestFilter] = useState('all');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isAssigningUnit, setIsAssigningUnit] = useState(false);
  const [isAssigningCsv, setIsAssigningCsv] = useState(false);
  const [isExportingAssignments, setIsExportingAssignments] = useState(false);
  const [isDeletingAssignments, setIsDeletingAssignments] = useState(false);
  const [busyAssignmentIds, setBusyAssignmentIds] = useState<Set<string>>(new Set());
  const [busyRetakeKeys, setBusyRetakeKeys] = useState<Set<string>>(new Set());
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());

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

  const normalizeComparable = (value?: string | null) => (value || '').trim().toLowerCase();
  const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();
  const isMissingRetryColumnError = (error: unknown) => {
    const message = String((error as { message?: string })?.message || '').toLowerCase();
    return (
      message.includes('remaining_attempts') ||
      message.includes('granted_attempts') ||
      (message.includes('column') && message.includes('does not exist'))
    );
  };

  const fetchAllUsers = async (): Promise<User[]> => {
    const pageSize = 1000;
    let from = 0;
    const collected: User[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, unit, user_group')
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = (data || []) as unknown as User[];
      collected.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    return collected;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ data: testsData, error: testsError }, usersData] = await Promise.all([
        supabase.from('tests').select('*').order('created_at', { ascending: false }),
        fetchAllUsers(),
      ]);

      if (testsError) throw new Error(testsError.message);
      const typedUsers = usersData;
      setUsers(typedUsers);

      const unitSet = new Set<string>();
      typedUsers.forEach((user) => {
        if (user.unit?.trim()) unitSet.add(user.unit.trim());
        if (user.user_group?.trim()) unitSet.add(user.user_group.trim());
      });
      setUnits(Array.from(unitSet).sort((a, b) => a.localeCompare(b)));

      setTests((testsData || []) as unknown as Test[]);
      await fetchAssignments();
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

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('test_assignments')
        .select(
          'id, user_id, test_id, question_count, is_active, available_until, assigned_via, source_unit, source_file_name, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const assignmentRows = (data || []) as AssignmentRow[];
      setAssignments(assignmentRows);

      const assignmentIds = assignmentRows.map((row) => row.id);
      const userIds = Array.from(new Set(assignmentRows.map((row) => row.user_id)));
      const testIds = Array.from(new Set(assignmentRows.map((row) => row.test_id)));

      if (assignmentIds.length > 0) {
        const { data: submissionData, error: submissionsError } = await supabase
          .from('test_submissions')
          .select('id, assignment_id, status, start_time, end_time, created_at, violations_count, violations')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false });

        if (submissionsError) {
          console.error('Error fetching submissions:', submissionsError);
          setSubmissions([]);
        } else {
          setSubmissions((submissionData || []) as SubmissionRow[]);
        }
      } else {
        setSubmissions([]);
      }

      if (userIds.length > 0 && testIds.length > 0) {
        const { data: retakeData, error: retakeError } = await supabase
          .from('test_retake_permissions')
          .select('user_id, test_id, remaining_attempts')
          .in('user_id', userIds)
          .in('test_id', testIds);

        if (!retakeError) {
          const next = new Map<string, number>();
          (retakeData as RetakePermissionRow[] | null)?.forEach((row) => {
            const attempts =
              Number.isFinite(row.remaining_attempts) && (row.remaining_attempts || 0) > 0
                ? Number(row.remaining_attempts)
                : 0;
            if (attempts > 0) {
              next.set(`${row.user_id}:${row.test_id}`, attempts);
            }
          });
          setRetakePermissions(next);
          setRetakeDrafts((prev) => {
            const draftEntries = Object.entries(prev).filter(([key]) =>
              next.has(key) || assignmentRows.some((row) => `${row.user_id}:${row.test_id}` === key)
            );
            return Object.fromEntries(draftEntries);
          });
        } else if (isMissingRetryColumnError(retakeError)) {
          const { data: legacyRetakeData, error: legacyRetakeError } = await supabase
            .from('test_retake_permissions')
            .select('user_id, test_id')
            .in('user_id', userIds)
            .in('test_id', testIds);

          if (legacyRetakeError) {
            console.error('Error fetching legacy retake permissions:', legacyRetakeError);
            setRetakePermissions(new Map());
          } else {
            const next = new Map<string, number>();
            (legacyRetakeData as LegacyRetakePermissionRow[] | null)?.forEach((row) => {
              next.set(`${row.user_id}:${row.test_id}`, 1);
            });
            setRetakePermissions(next);
          }
        } else {
          console.error('Error fetching retake permissions:', retakeError);
          setRetakePermissions(new Map());
        }
      } else {
        setRetakePermissions(new Map());
        setRetakeDrafts({});
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const extractEmails = (text: string) => {
    const tokens = text
      .split(/[,;\n\r\t]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = tokens
      .map((value) => normalizeEmail(value))
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

  const parseAvailabilityWindow = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return parsed;
  };

  const parseDateMs = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };

  const isWindowExpired = (availableUntil: string | null) => {
    const availableUntilMs = parseDateMs(availableUntil);
    if (availableUntilMs === null) return false;
    return Date.now() > availableUntilMs;
  };

  const getRetryWindowMs = (
    assignment: Pick<AssignmentRow, 'available_until' | 'created_at' | 'updated_at'>,
    testDurationMinutes: number
  ) => {
    const minimumMs = Math.max(1, testDurationMinutes || 1) * 60 * 1000;
    const maxReasonableMs = 30 * 24 * 60 * 60 * 1000;
    const availableUntilMs = parseDateMs(assignment.available_until);
    if (availableUntilMs === null) return minimumMs;

    const baseCandidates = [parseDateMs(assignment.updated_at), parseDateMs(assignment.created_at)];
    for (const baseMs of baseCandidates) {
      if (baseMs === null || baseMs >= availableUntilMs) continue;
      const windowMs = availableUntilMs - baseMs;
      if (windowMs >= minimumMs && windowMs <= maxReasonableMs) {
        return windowMs;
      }
    }

    return minimumMs;
  };

  const reopenAssignmentWindowOnRetry = async (userId: string, testId: string) => {
    const { data, error } = await supabase
      .from('test_assignments')
      .select('id, user_id, test_id, available_until, created_at, updated_at')
      .eq('user_id', userId)
      .eq('test_id', testId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const assignment = (data || [])[0] as AssignmentRow | undefined;
    if (!assignment) {
      return { reopened: false };
    }

    if (!isWindowExpired(assignment.available_until)) {
      return { reopened: false };
    }

    const testDurationMinutes = Number(testsById.get(testId)?.duration_minutes || 0);
    const retryWindowMs = getRetryWindowMs(assignment, testDurationMinutes);
    const nowIso = new Date().toISOString();
    const reopenedUntil = new Date(Date.now() + retryWindowMs).toISOString();

    const { error: updateError } = await supabase
      .from('test_assignments')
      .update({
        available_until: reopenedUntil,
        updated_at: nowIso,
      })
      .eq('id', assignment.id)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    setAssignments((prev) =>
      prev.map((row) =>
        row.id === assignment.id
          ? { ...row, available_until: reopenedUntil, updated_at: nowIso }
          : row
      )
    );

    return {
      reopened: true,
      reopenedUntil,
    };
  };

  const getWindowRemainingLabel = (availableUntil: string | null) => {
    if (!availableUntil) return 'No expiry';
    const parsed = new Date(availableUntil);
    if (Number.isNaN(parsed.getTime())) return 'No expiry';
    const diffMs = parsed.getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const toCsvField = (value: string | number) => {
    const safe = String(value).replace(/"/g, '""');
    return `"${safe}"`;
  };

  const assignToUsers = async (
    userIds: string[],
    test: Test,
    questionCount: number,
    mode: AssignmentMode,
    availabilityWindowMinutes: number,
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
    const availableUntil = new Date(Date.now() + availabilityWindowMinutes * 60 * 1000).toISOString();
    const insertRows: Array<{
      user_id: string;
      test_id: string;
      question_count: number;
      is_active: boolean;
      available_until: string;
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
          available_until: availableUntil,
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
          available_until: availableUntil,
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
    const availabilityWindow = parseAvailabilityWindow(unitAvailabilityMinutes);
    if (!availabilityWindow) {
      toast({
        title: 'Invalid availability window',
        description: 'Set availability window to at least 1 minute.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedSelectedUnit = normalizeComparable(selectedUnit);
    const unitUsers = users.filter((user) => {
      const sameUnit =
        normalizeComparable(user.unit) === normalizedSelectedUnit ||
        normalizeComparable(user.user_group) === normalizedSelectedUnit;
      return sameUnit && user.role !== 'admin';
    });

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
        availabilityWindow,
        { sourceUnit: selectedUnit }
      );

      await fetchAssignments();

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
    const availabilityWindow = parseAvailabilityWindow(csvAvailabilityMinutes);
    if (!availabilityWindow) {
      toast({
        title: 'Invalid availability window',
        description: 'Set availability window to at least 1 minute.',
        variant: 'destructive',
      });
      return;
    }
    const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
    const matchedUsers = csvEmails
      .map((email) => usersByEmail.get(normalizeEmail(email)))
      .filter((user): user is User => Boolean(user))
      .filter((user) => user.role !== 'admin');

    const matchedEmailSet = new Set(matchedUsers.map((user) => normalizeEmail(user.email)));
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
        availabilityWindow,
        { sourceFileName: csvFileName || null }
      );

      await fetchAssignments();

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

  const latestSubmissionByAssignment = useMemo(() => {
    const map = new Map<string, SubmissionRow>();
    submissions.forEach((row) => {
      if (!row.assignment_id) return;
      if (!map.has(row.assignment_id)) {
        map.set(row.assignment_id, row);
      }
    });
    return map;
  }, [submissions]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    try {
      return format(new Date(value), 'MMM d, yyyy HH:mm');
    } catch {
      return 'N/A';
    }
  };

  const getStatus = (submission: SubmissionRow | undefined, test: Test | undefined): AssignmentStatus => {
    if (!submission) return 'not_started';
    if (submission.status === 'completed') return 'submitted';
    if (submission.status === 'in_progress') {
      const start = submission.start_time || submission.created_at;
      const durationMinutes = test?.duration_minutes || 0;
      if (start && durationMinutes > 0) {
        const deadline =
          new Date(start).getTime() + durationMinutes * 60 * 1000 + GRACE_MINUTES * 60 * 1000;
        if (Date.now() > deadline) return 'failed';
      }
      return 'in_progress';
    }
    return 'not_started';
  };

  const statusLabels: Record<AssignmentStatus, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    failed: 'Failed to submit',
    submitted: 'Submitted',
  };

  const statusStyles: Record<AssignmentStatus, string> = {
    not_started: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-700',
    submitted: 'bg-emerald-100 text-emerald-800',
  };

  const assignmentRows = useMemo(() => {
    return assignments.map((assignment) => {
      const user = usersById.get(assignment.user_id);
      const test = testsById.get(assignment.test_id);
      const latestSubmission = latestSubmissionByAssignment.get(assignment.id);
      const status = getStatus(latestSubmission, test);
      const lastActivity =
        latestSubmission?.end_time ||
        latestSubmission?.start_time ||
        latestSubmission?.created_at ||
        assignment.created_at;
      const key = `${assignment.user_id}:${assignment.test_id}`;
      const retakeRemaining = retakePermissions.get(key) || 0;

      return {
        assignment,
        user,
        test,
        status,
        lastActivity,
        retakeRemaining,
      };
    });
  }, [assignments, usersById, testsById, latestSubmissionByAssignment, retakePermissions]);

  const filteredAssignments = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    return assignmentRows.filter((row) => {
      if (!showInactive && !row.assignment.is_active) return false;
      if (assignmentTestFilter !== 'all' && row.assignment.test_id !== assignmentTestFilter) {
        return false;
      }
      if (assignmentStatusFilter !== 'all' && row.status !== assignmentStatusFilter) {
        return false;
      }
      if (!query) return true;
      const name = row.user?.full_name?.toLowerCase() || '';
      const email = row.user?.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    });
  }, [assignmentRows, assignmentSearch, assignmentTestFilter, assignmentStatusFilter, showInactive]);

  useEffect(() => {
    const availableIds = new Set(assignments.map((assignment) => assignment.id));
    setSelectedAssignmentIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [assignments]);

  const selectableVisibleAssignmentIds = useMemo(
    () =>
      filteredAssignments
        .map((row) => row.assignment)
        .filter((assignment) => assignment.is_active && !busyAssignmentIds.has(assignment.id))
        .map((assignment) => assignment.id),
    [filteredAssignments, busyAssignmentIds]
  );

  const selectedVisibleCount = useMemo(
    () =>
      selectableVisibleAssignmentIds.reduce(
        (count, assignmentId) => count + (selectedAssignmentIds.has(assignmentId) ? 1 : 0),
        0
      ),
    [selectableVisibleAssignmentIds, selectedAssignmentIds]
  );

  const allVisibleSelected =
    selectableVisibleAssignmentIds.length > 0 &&
    selectedVisibleCount === selectableVisibleAssignmentIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleAssignmentSelection = (assignmentId: string, checked: boolean) => {
    setSelectedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(assignmentId);
      } else {
        next.delete(assignmentId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableVisibleAssignmentIds.forEach((assignmentId) => next.delete(assignmentId));
      } else {
        selectableVisibleAssignmentIds.forEach((assignmentId) => next.add(assignmentId));
      }
      return next;
    });
  };

  const handleDeleteSelectedAssignments = async () => {
    const selectedIds = Array.from(selectedAssignmentIds);
    if (selectedIds.length === 0) {
      toast({
        title: 'No candidates selected',
        description: 'Select at least one assignment to delete.',
        variant: 'destructive',
      });
      return;
    }

    const activeSelectedIds = selectedIds.filter((assignmentId) =>
      assignments.some((assignment) => assignment.id === assignmentId && assignment.is_active)
    );

    if (activeSelectedIds.length === 0) {
      toast({
        title: 'Nothing to delete',
        description: 'Selected assignments are already inactive.',
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${activeSelectedIds.length} selected assignment(s)? Candidates will no longer see them on their dashboard.`
    );
    if (!confirmed) return;

    setIsDeletingAssignments(true);
    setBusyAssignmentIds((prev) => {
      const next = new Set(prev);
      activeSelectedIds.forEach((assignmentId) => next.add(assignmentId));
      return next;
    });

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('test_assignments')
        .update({ is_active: false, updated_at: nowIso })
        .in('id', activeSelectedIds);

      if (error) throw error;

      const activeSet = new Set(activeSelectedIds);
      setAssignments((prev) =>
        prev.map((assignment) =>
          activeSet.has(assignment.id)
            ? { ...assignment, is_active: false, updated_at: nowIso }
            : assignment
        )
      );

      setSelectedAssignmentIds((prev) => {
        const next = new Set(prev);
        activeSelectedIds.forEach((assignmentId) => next.delete(assignmentId));
        return next;
      });

      toast({
        title: 'Assignments deleted',
        description: `${activeSelectedIds.length} assignment(s) removed from candidate dashboards.`,
      });
    } catch (error) {
      console.error('Error deleting selected assignments:', error);
      toast({
        title: 'Delete failed',
        description: 'Unable to delete selected assignments.',
        variant: 'destructive',
      });
    } finally {
      setBusyAssignmentIds((prev) => {
        const next = new Set(prev);
        activeSelectedIds.forEach((assignmentId) => next.delete(assignmentId));
        return next;
      });
      setIsDeletingAssignments(false);
    }
  };

  const toggleAssignmentActive = async (assignmentId: string, currentValue: boolean) => {
    const nextValue = !currentValue;
    setBusyAssignmentIds((prev) => new Set(prev).add(assignmentId));
    try {
      const { error } = await supabase
        .from('test_assignments')
        .update({ is_active: nextValue, updated_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) throw error;

      setAssignments((prev) =>
        prev.map((row) => (row.id === assignmentId ? { ...row, is_active: nextValue } : row))
      );

      toast({
        title: nextValue ? 'Assignment reactivated' : 'Assignment withdrawn',
        description: nextValue
          ? 'The assessment is active again for the candidate.'
          : 'The assessment has been withdrawn for the candidate.',
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: 'Update failed',
        description: 'Unable to update assignment status.',
        variant: 'destructive',
      });
    } finally {
      setBusyAssignmentIds((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
    }
  };

  const handleRetakeDraftChange = (key: string, nextValue: string) => {
    if (nextValue !== '' && !/^\d+$/.test(nextValue)) return;
    setRetakeDrafts((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  const saveRetakePermission = async (userId: string, testId: string, currentValue: number) => {
    const key = `${userId}:${testId}`;
    setBusyRetakeKeys((prev) => new Set(prev).add(key));
    try {
      const rawValue = retakeDrafts[key] ?? String(currentValue);
      const parsed = Number.parseInt(rawValue, 10);
      const nextValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

      if (nextValue === currentValue) {
        if (nextValue > 0) {
          const reopenResult = await reopenAssignmentWindowOnRetry(userId, testId);
          if (reopenResult.reopened) {
            toast({
              title: 'Assessment window reopened',
              description: 'The candidate can access the assessment immediately.',
            });
          }
        }
        return;
      }

      if (nextValue === 0) {
        const { error } = await supabase
          .from('test_retake_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('test_id', testId);

        if (error) throw error;

        setRetakePermissions((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        setRetakeDrafts((prev) => ({ ...prev, [key]: '0' }));

        toast({
          title: 'Retries removed',
          description: 'Retry count has been set to 0.',
        });
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const grantedBy = sessionData.session?.user.id;
        if (!grantedBy) throw new Error('Missing admin session.');

        const { error } = await supabase
          .from('test_retake_permissions')
          .upsert({
            user_id: userId,
            test_id: testId,
            granted_by: grantedBy,
            granted_attempts: nextValue,
            remaining_attempts: nextValue,
            granted_at: new Date().toISOString(),
            reason: `Admin set retries to ${nextValue}`,
          }, {
            onConflict: 'user_id,test_id',
          });

        let persistedAttempts = nextValue;

        if (error) {
          if (!isMissingRetryColumnError(error)) {
            throw error;
          }

          const { error: legacyError } = await supabase
            .from('test_retake_permissions')
            .upsert(
              {
                user_id: userId,
                test_id: testId,
                granted_by: grantedBy,
                granted_at: new Date().toISOString(),
                reason:
                  nextValue > 1
                    ? `Admin requested ${nextValue} retries (legacy schema allows 1)`
                    : `Admin set retries to ${nextValue}`,
              },
              {
                onConflict: 'user_id,test_id',
              }
            );

          if (legacyError) {
            throw legacyError;
          }

          persistedAttempts = 1;
          if (nextValue > 1) {
            toast({
              title: 'Legacy retry mode',
              description:
                'Your database has not applied retry-count columns yet. Saved as 1 retry until migrations are applied.',
              variant: 'destructive',
            });
          }
        }

        let reopenedWindow = false;
        let reopenErrorMessage = '';
        try {
          const reopenResult = await reopenAssignmentWindowOnRetry(userId, testId);
          reopenedWindow = reopenResult.reopened;
        } catch (reopenError) {
          reopenErrorMessage = String((reopenError as { message?: string })?.message || '');
          console.error('Error reopening assignment window:', reopenError);
        }

        setRetakePermissions((prev) => {
          const next = new Map(prev);
          next.set(key, persistedAttempts);
          return next;
        });
        setRetakeDrafts((prev) => ({ ...prev, [key]: String(persistedAttempts) }));

        if (reopenErrorMessage) {
          toast({
            title: 'Retries updated with warning',
            description:
              'Retry count was saved, but reopening the expired assessment window failed. Please try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: reopenedWindow ? 'Retries updated and window reopened' : 'Retries updated',
            description: reopenedWindow
              ? `Candidate can retry ${persistedAttempts} time${persistedAttempts === 1 ? '' : 's'} and can access the assessment now.`
              : `Candidate can retry ${persistedAttempts} time${persistedAttempts === 1 ? '' : 's'}.`,
          });
        }
      }
    } catch (error) {
      console.error('Error updating retake permission:', error);
      const message = String((error as { message?: string })?.message || '');
      toast({
        title: 'Update failed',
        description: message || 'Unable to update retry count.',
        variant: 'destructive',
      });
    } finally {
      setBusyRetakeKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const downloadAssignmentsCsv = () => {
    if (filteredAssignments.length === 0) {
      toast({
        title: 'No rows to export',
        description: 'Adjust filters or assign tests before exporting.',
        variant: 'destructive',
      });
      return;
    }

    setIsExportingAssignments(true);
    try {
      const headers = [
        'S/N',
        'Staff Name',
        'Email',
        'Assessment',
        'Date Assigned',
        'Status',
        'Participation',
        'Last Activity',
        'Available Until',
        'Window Remaining',
        'Assignment Active',
      ];

      const participationMap: Record<AssignmentStatus, string> = {
        not_started: 'Yet to start',
        in_progress: 'Started',
        failed: 'Failed to submit',
        submitted: 'Taken',
      };

      const rows = filteredAssignments.map((row, index) => {
        const availableUntil = row.assignment.available_until;
        return [
          index + 1,
          row.user?.full_name || 'Unknown',
          row.user?.email || row.assignment.user_id,
          row.test?.title || 'Unknown Test',
          formatDateTime(row.assignment.created_at),
          statusLabels[row.status],
          participationMap[row.status],
          formatDateTime(row.lastActivity),
          formatDateTime(availableUntil),
          getWindowRemainingLabel(availableUntil),
          row.assignment.is_active ? 'Yes' : 'No',
        ]
          .map((value) => toCsvField(value))
          .join(',');
      });

      const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const testName =
        assignmentTestFilter !== 'all'
          ? testsById.get(assignmentTestFilter)?.title || 'filtered'
          : 'all-tests';
      const safeTestName = testName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `assigned-assessments-${safeTestName}-${format(new Date(), 'yyyy-MM-dd')}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: `Downloaded ${filteredAssignments.length} filtered assignment rows.`,
      });
    } catch (error) {
      console.error('Error exporting assignments CSV:', error);
      toast({
        title: 'Export failed',
        description: 'Unable to export assignment status.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingAssignments(false);
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
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Assign Tests</h1>
      {tests.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No tests found. Create a test first.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assign Test to Unit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div>
              <label className="text-sm font-medium mb-2 block">Availability Window (minutes)</label>
              <Input
                type="number"
                min={1}
                value={unitAvailabilityMinutes}
                onChange={(event) => setUnitAvailabilityMinutes(event.target.value)}
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

      <Card>
        <CardHeader>
          <CardTitle>Assign Test to Individuals (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div>
              <label className="text-sm font-medium mb-2 block">Availability Window (minutes)</label>
              <Input
                type="number"
                min={1}
                value={csvAvailabilityMinutes}
                onChange={(event) => setCsvAvailabilityMinutes(event.target.value)}
              />
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

      <Card>
        <CardHeader>
          <CardTitle>Assigned Assessments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff by name or email..."
                className="pl-8"
                value={assignmentSearch}
                onChange={(event) => setAssignmentSearch(event.target.value)}
              />
            </div>
            <Select value={assignmentTestFilter} onValueChange={setAssignmentTestFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filter by test" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tests</SelectItem>
                {tests.map((test) => (
                  <SelectItem key={test.id} value={test.id}>
                    {test.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignmentStatusFilter} onValueChange={setAssignmentStatusFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="failed">Failed to submit</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <span>Show inactive</span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectAllVisible}
              disabled={selectableVisibleAssignmentIds.length === 0 || isDeletingAssignments}
              className="w-full lg:w-auto"
            >
              {allVisibleSelected ? 'Clear selection' : 'Select all'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteSelectedAssignments()}
              disabled={selectedVisibleCount === 0 || isDeletingAssignments}
              className="w-full lg:w-auto"
            >
              {isDeletingAssignments ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedVisibleCount})
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadAssignmentsCsv}
              disabled={isExportingAssignments || filteredAssignments.length === 0}
              className="w-full lg:w-auto"
            >
              {isExportingAssignments ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Status
                </>
              )}
            </Button>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No assignments found.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                          onCheckedChange={() => handleSelectAllVisible()}
                          disabled={selectableVisibleAssignmentIds.length === 0 || isDeletingAssignments}
                          aria-label="Select all assignments"
                        />
                      </TableHead>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Test</TableHead>
                      <TableHead>Date Assigned</TableHead>
                      <TableHead>Available Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Withdraw</TableHead>
                      <TableHead>Retry Attempts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((row, index) => {
                      const assignment = row.assignment;
                      const user = row.user;
                      const test = row.test;
                      const statusLabel = statusLabels[row.status];
                      const statusClass = statusStyles[row.status];
                      const withdrawBusy = busyAssignmentIds.has(assignment.id);
                      const retakeKey = `${assignment.user_id}:${assignment.test_id}`;
                      const retakeBusy = busyRetakeKeys.has(retakeKey);
                      const currentRetries = row.retakeRemaining;
                      const draftRetries = retakeDrafts[retakeKey] ?? String(currentRetries);
                      const isSelected = selectedAssignmentIds.has(assignment.id);
                      const checkboxDisabled =
                        isDeletingAssignments || withdrawBusy || !assignment.is_active;
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleAssignmentSelection(assignment.id, checked === true)
                              }
                              disabled={checkboxDisabled}
                              aria-label={`Select ${user?.full_name || user?.email || assignment.user_id}`}
                            />
                          </TableCell>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{user?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">
                              {user?.email || assignment.user_id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{test?.title || 'Unknown Test'}</div>
                            {!assignment.is_active && (
                              <div className="text-xs text-muted-foreground">Inactive</div>
                            )}
                          </TableCell>
                          <TableCell>{formatDateTime(assignment.created_at)}</TableCell>
                          <TableCell>{formatDateTime(assignment.available_until)}</TableCell>
                          <TableCell>
                            <Badge className={statusClass}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(row.lastActivity)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={!assignment.is_active}
                              onCheckedChange={() =>
                                toggleAssignmentActive(assignment.id, assignment.is_active)
                              }
                              disabled={withdrawBusy}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                value={draftRetries}
                                onChange={(event) =>
                                  handleRetakeDraftChange(retakeKey, event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void saveRetakePermission(
                                      assignment.user_id,
                                      assignment.test_id,
                                      currentRetries
                                    );
                                  }
                                }}
                                className="h-8 w-20"
                                disabled={retakeBusy}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void saveRetakePermission(
                                    assignment.user_id,
                                    assignment.test_id,
                                    currentRetries
                                  )
                                }
                                disabled={retakeBusy}
                              >
                                {retakeBusy ? 'Saving...' : 'Set'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
