
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Calendar, User, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  full_name: string;
  email: string;
  unit: string;
}

interface Test {
  id: string;
  title: string;
}

interface RetakePermission {
  id: string;
  user_id: string;
  test_id: string;
  granted_by: string;
  granted_at: string;
  reason: string;
  user?: User;
  test?: Test;
  granted_by_user?: User;
}

export function RetakePermissionsManager() {
  const [permissions, setPermissions] = useState<RetakePermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch existing permissions
      const { data: permissionsData } = await supabase
        .from('test_retake_permissions')
        .select('*')
        .order('granted_at', { ascending: false });

      // Fetch users and tests for the permission data
      if (permissionsData) {
        const enhancedPermissions = await Promise.all(
          permissionsData.map(async (permission) => {
            const [userResult, testResult, grantedByResult] = await Promise.all([
              supabase.from('users').select('id, full_name, email, unit').eq('id', permission.user_id).single(),
              supabase.from('tests').select('id, title').eq('id', permission.test_id).single(),
              supabase.from('users').select('id, full_name, email, unit').eq('id', permission.granted_by).single()
            ]);

            return {
              ...permission,
              user: userResult.data,
              test: testResult.data,
              granted_by_user: grantedByResult.data
            };
          })
        );
        setPermissions(enhancedPermissions);
      }

      // Fetch all users for the dropdown
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, unit')
        .order('full_name');
      setUsers(usersData || []);

      // Fetch all tests for the dropdown
      const { data: testsData } = await supabase
        .from('tests')
        .select('id, title')
        .eq('is_active', true)
        .order('title');
      setTests(testsData || []);

    } catch (error) {
      console.error('Error fetching retake permissions data:', error);
      toast({
        title: "Error",
        description: "Failed to load retake permissions data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const grantRetakePermission = async () => {
    if (!selectedUserId || !selectedTestId) {
      toast({
        title: "Missing Information",
        description: "Please select both a user and a test.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('test_retake_permissions')
        .insert({
          user_id: selectedUserId,
          test_id: selectedTestId,
          granted_by: session.user.id,
          reason: reason || 'No reason provided'
        });

      if (error) throw error;

      toast({
        title: "Permission Granted",
        description: "Retake permission has been successfully granted.",
      });

      // Reset form and close dialog
      setSelectedUserId('');
      setSelectedTestId('');
      setReason('');
      setDialogOpen(false);
      
      // Refresh data
      fetchData();

    } catch (error) {
      console.error('Error granting retake permission:', error);
      toast({
        title: "Error",
        description: "Failed to grant retake permission.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div>Loading retake permissions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <UserPlus className="h-5 w-5 mr-2" />
            Retake Permissions
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Grant Permission</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Retake Permission</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="test">Select Test</Label>
                  <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a test" />
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
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for granting retake permission..."
                  />
                </div>
                
                <Button onClick={grantRetakePermission} className="w-full">
                  Grant Permission
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {permissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No retake permissions granted yet.</p>
        ) : (
          <div className="space-y-4">
            {permissions.map((permission) => (
              <div key={permission.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        {permission.user?.full_name || 'Unknown User'}
                      </span>
                      <Badge variant="outline">
                        {permission.user?.unit || 'No Unit'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {permission.test?.title || 'Unknown Test'}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(permission.granted_at), 'MMM d, yyyy')}
                    </div>
                    <div>
                      by {permission.granted_by_user?.full_name || 'Unknown'}
                    </div>
                  </div>
                </div>
                {permission.reason && (
                  <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                    <strong>Reason:</strong> {permission.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
