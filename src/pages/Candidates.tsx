
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Search, Filter, UserPlus, Calendar, Download, Loader2 } from 'lucide-react';
import { User as UserType, Candidate } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const Candidates = () => {
  const [candidates, setCandidates] = useState<UserType[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [isDownloadingCandidates, setIsDownloadingCandidates] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [newCandidate, setNewCandidate] = useState({
    email: '',
    full_name: '',
    user_group: '',
  });
  const { toast } = useToast();

  const downloadCandidateTemplate = () => {
    const csvTemplate = [
      'email,full_name,unit',
      'jane.doe@babbangona.com,Jane Doe,Finance Operations',
      'john.smith@babbangona.com,John Smith,Operator Success',
    ].join('\n');

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'candidate_upload_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Template downloaded',
      description: 'Use this CSV format for bulk candidate uploads.',
    });
  };

  const toCsvField = (value: string | number | null | undefined) => {
    const safeValue = String(value ?? '').replace(/"/g, '""');
    return `"${safeValue}"`;
  };

  const downloadAllCandidates = async () => {
    setIsDownloadingCandidates(true);
    try {
      const pageSize = 1000;
      let from = 0;
      const allCandidates: UserType[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, user_group, unit, created_at, updated_at')
          .eq('role', 'candidate')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data || []) as UserType[];
        allCandidates.push(...page);

        if (page.length < pageSize) break;
        from += pageSize;
      }

      if (allCandidates.length === 0) {
        toast({
          title: 'No candidates found',
          description: 'There are no candidates to export yet.',
          variant: 'destructive',
        });
        return;
      }

      const headers = [
        'S/N',
        'Full Name',
        'Email',
        'User Group',
        'Unit',
        'Date Added',
      ];

      const rows = allCandidates.map((candidate, index) => {
        const createdAt = candidate.created_at ? new Date(candidate.created_at).toLocaleString() : '';
        return [
          index + 1,
          candidate.full_name || '',
          candidate.email || '',
          candidate.user_group || '',
          candidate.unit || '',
          createdAt,
        ]
          .map((value) => toCsvField(value))
          .join(',');
      });

      const csvContent = `${headers.map((value) => toCsvField(value)).join(',')}\n${rows.join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `all-candidates-${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Candidates downloaded',
        description: `Exported ${allCandidates.length} candidate record(s).`,
      });
    } catch (error: any) {
      console.error('Error downloading candidates:', error);
      toast({
        title: 'Download failed',
        description: error.message || 'Unable to download candidates.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [group, activeTab]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // Fetch approved candidates from users table
      let query = supabase.from('users').select('*').eq('role', 'candidate');
      
      if (group !== 'all') {
        query = query.eq('user_group', group);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setCandidates(data as UserType[]);
      
      // Extract unique groups
      if (data) {
        const uniqueGroups = Array.from(
          new Set(data.filter((u: UserType) => u.user_group).map((u: UserType) => u.user_group))
        ).filter(Boolean) as string[];
        setGroups(uniqueGroups);
      }
      
      // If on pending tab, fetch pending registrations from candidates table
      if (activeTab === 'pending') {
        const { data: pendingData, error: pendingError } = await supabase
          .from('candidates')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
          
        if (pendingError) throw pendingError;
        setPendingRegistrations(pendingData as Candidate[] || []);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCandidate = async () => {
    try {
      if (!newCandidate.email.endsWith('@babbangona.com')) {
        toast({
          title: "Invalid email",
          description: "Only @babbangona.com email addresses are allowed.",
          variant: "destructive",
        });
        return;
      }
      
      // First add to candidates table
      const { error: candidateError } = await supabase
        .from('candidates')
        .insert({
          name: newCandidate.full_name,
          unit: newCandidate.user_group,
          email: newCandidate.email,
          status: 'approved'
        });
        
      if (candidateError) throw candidateError;
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', newCandidate.email)
        .single();
        
      if (existingUser) {
        toast({
          title: "User exists",
          description: "This email is already registered in the system.",
          variant: "destructive",
        });
        return;
      }
      
      // Create user in auth
      const { data, error } = await supabase.auth.signUp({
        email: newCandidate.email,
        password: 'temporaryPassword123!',
        options: {
          data: {
            full_name: newCandidate.full_name,
            unit: newCandidate.user_group
          }
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Add user to users table
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email: newCandidate.email,
          full_name: newCandidate.full_name,
          user_group: newCandidate.user_group,
          unit: newCandidate.user_group,
          role: 'candidate',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        if (profileError) throw profileError;
        
        toast({
          title: "Candidate added",
          description: "The candidate has been added successfully.",
        });
        
        // Reset form and reload candidates
        setNewCandidate({
          email: '',
          full_name: '',
          user_group: '',
        });
        setIsAddingCandidate(false);
        fetchCandidates();
      }
    } catch (error: any) {
      console.error('Error adding candidate:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add candidate.",
        variant: "destructive",
      });
    }
  };

  const handleCandidateApprove = async (candidate: Candidate) => {
    try {
      // Update the candidate status to approved
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ status: 'approved' })
        .eq('id', candidate.id);
        
      if (updateError) throw updateError;
      
      toast({
        title: "Candidate approved",
        description: "The registration has been approved successfully.",
      });
      
      fetchCandidates();
    } catch (error: any) {
      console.error('Error approving candidate:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve candidate.",
        variant: "destructive",
      });
    }
  };

  const handleCandidateReject = async (candidate: Candidate) => {
    try {
      // Update the candidate status to rejected
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ status: 'rejected' })
        .eq('id', candidate.id);
        
      if (updateError) throw updateError;
      
      toast({
        title: "Registration rejected",
        description: "The candidate registration has been rejected.",
      });
      
      fetchCandidates();
    } catch (error: any) {
      console.error('Error rejecting candidate:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject candidate.",
        variant: "destructive",
      });
    }
  };

  const filteredCandidates = candidates.filter(candidate => 
    (candidate.email?.toLowerCase().includes(search.toLowerCase()) || 
     candidate.full_name?.toLowerCase().includes(search.toLowerCase()))
  );
  
  const filteredPendingRegistrations = pendingRegistrations.filter(candidate => 
    (candidate.email.toLowerCase().includes(search.toLowerCase()) || 
     candidate.name.toLowerCase().includes(search.toLowerCase()) ||
     candidate.unit.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadCandidateTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download Upload Template
          </Button>
          <Button
            variant="outline"
            onClick={() => void downloadAllCandidates()}
            disabled={isDownloadingCandidates}
          >
            {isDownloadingCandidates ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download All Candidates
              </>
            )}
          </Button>
          <Dialog open={isAddingCandidate} onOpenChange={setIsAddingCandidate}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Add Candidate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Candidate</DialogTitle>
                <DialogDescription>
                  Add a new candidate to the system. They will receive an email to set their password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="candidate@babangona.com"
                    value={newCandidate.email}
                    onChange={(e) => setNewCandidate({...newCandidate, email: e.target.value})}
                  />
                  {newCandidate.email && !newCandidate.email.endsWith('@babbangona.com') && (
                    <p className="text-xs text-red-500">
                      Only @babbangona.com email addresses are allowed
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newCandidate.full_name}
                    onChange={(e) => setNewCandidate({...newCandidate, full_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_group">Unit/Department</Label>
                  <Input
                    id="user_group"
                    placeholder="e.g., Marketing, Finance, HR"
                    value={newCandidate.user_group}
                    onChange={(e) => setNewCandidate({...newCandidate, user_group: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingCandidate(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCandidate}>
                  Add Candidate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Candidates</TabsTrigger>
          <TabsTrigger value="pending">Pending Registrations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Candidates</CardTitle>
              <CardDescription>Manage and organize test candidates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600"></div>
                  <p className="mt-2 text-muted-foreground">Loading candidates...</p>
                </div>
              ) : filteredCandidates.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Unit/Department</TableHead>
                        <TableHead>Tests Taken</TableHead>
                        <TableHead>Avg. Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCandidates.map((candidate) => (
                        <TableRow key={candidate.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <div className="h-8 w-8 bg-excelerate-100 text-excelerate-600 rounded-full flex items-center justify-center mr-2">
                                <User className="h-4 w-4" />
                              </div>
                              {candidate.full_name || 'Unnamed'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-1 text-muted-foreground" />
                              {candidate.email}
                            </div>
                          </TableCell>
                          <TableCell>{candidate.user_group || candidate.unit || 'Unassigned'}</TableCell>
                          <TableCell>0</TableCell>
                          <TableCell>N/A</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No candidates found</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Total: {filteredCandidates.length} candidates
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" /> Advanced Filters
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Registrations</CardTitle>
              <CardDescription>Review and manage user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search registrations..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-excelerate-600"></div>
                  <p className="mt-2 text-muted-foreground">Loading registrations...</p>
                </div>
              ) : filteredPendingRegistrations.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPendingRegistrations.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">
                            {reg.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-1 text-muted-foreground" />
                              {reg.email}
                            </div>
                          </TableCell>
                          <TableCell>{reg.unit}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                              {new Date(reg.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Pending</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleCandidateApprove(reg)}
                              >
                                Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleCandidateReject(reg)}
                              >
                                Reject
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
                  <p className="text-muted-foreground">No pending registrations found</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Total: {filteredPendingRegistrations.length} pending registrations
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Candidates;
