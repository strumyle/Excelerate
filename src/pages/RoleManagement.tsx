
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UserCog, Shield, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, AdminPermission } from '@/lib/supabase';

// Available roles in the system
const AVAILABLE_ROLES = ['admin', 'candidate'];

const RoleManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [canGrantAdmin, setCanGrantAdmin] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) {
          toast({
            title: "Authentication error",
            description: "You must be logged in to access this page.",
            variant: "destructive",
          });
          return;
        }

        // Fetch current user details
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.session.user.id)
          .single();
          
        if (userError) throw userError;
        setCurrentUser(userData as User);
        
        // Check if the user can grant admin privileges
        if (userData.role === 'admin') {
          try {
            // Check if the user has admin permission entry
            const { data: permissionData, error: permError } = await supabase
              .from('admin_permissions')
              .select('*')
              .eq('user_id', userData.id)
              .single();
              
            if (!permError && permissionData) {
              setCanGrantAdmin(permissionData.can_grant_admin);
            } else if (userData.email === 'ameh.oche@babbangona.com') {
              // Special admin always gets can_grant_admin = true
              const { error: createError } = await supabase
                .from('admin_permissions')
                .insert({
                  user_id: userData.id,
                  can_grant_admin: true
                });
                
              if (!createError) {
                setCanGrantAdmin(true);
              }
            }
          } catch (err) {
            console.error('Error checking admin permissions:', err);
            // Default to true for can_grant_admin if user email is the specified admin
            setCanGrantAdmin(userData.email === 'ameh.oche@babbangona.com');
          }
        }

        // Only admin users should be able to fetch other users
        if (userData.role === 'admin') {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (usersError) throw usersError;
          setUsers(usersData as User[] || []);
          
          // Try to fetch admin permissions
          try {
            const { data: adminData, error: adminError } = await supabase
              .from('admin_permissions')
              .select('*');
              
            if (!adminError && adminData) {
              setAdminPermissions(adminData as AdminPermission[]);
            }
          } catch (err) {
            console.error('Error fetching admin permissions:', err);
          }
        }
      } catch (error) {
        console.error('Error loading role management data:', error);
        toast({
          title: "Error",
          description: "Failed to load user data for role management.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, []);

  const handleUserRoleChange = async (userId: string, newRole: string) => {
    try {
      // Update user role
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      
      // If changed to admin, ensure they have an admin_permissions entry
      if (newRole === 'admin') {
        try {
          await supabase
            .from('admin_permissions')
            .upsert({
              user_id: userId,
              can_grant_admin: false,
              updated_at: new Date().toISOString()
            });
        } catch (err) {
          console.error('Error creating admin permission record:', err);
        }
      } else {
        // If role changed from admin, remove from admin_permissions
        try {
          await supabase
            .from('admin_permissions')
            .delete()
            .eq('user_id', userId);
        } catch (err) {
          console.error('Error removing admin permission record:', err);
        }
      }
      
      // Refresh the user list
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (usersData) setUsers(usersData as User[]);
      
      toast({
        title: "Role Updated",
        description: `User role has been changed to ${newRole}.`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    }
  };
  
  const toggleCanGrantAdmin = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_permissions')
        .update({ can_grant_admin: !currentValue })
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Update local state
      setAdminPermissions(prev => 
        prev.map(p => p.user_id === userId ? {...p, can_grant_admin: !currentValue} : p)
      );
      
      toast({
        title: "Permissions Updated",
        description: `Admin permission settings updated.`,
      });
    } catch (error) {
      console.error('Error updating admin permissions:', error);
      toast({
        title: "Error",
        description: "Failed to update admin permissions.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-lg">Loading role management...</span>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Manage user roles and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <p>You don't have permission to access role management. Please contact an administrator.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Management</CardTitle>
        <CardDescription>Manage user roles and permissions in the system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Available Roles</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_ROLES.map(role => (
              <div key={role} className="flex items-center space-x-2 bg-muted px-3 py-1 rounded-md">
                {role === 'admin' ? <Shield className="h-4 w-4 text-blue-500" /> : <UserCog className="h-4 w-4" />}
                <span className="text-sm font-medium capitalize">{role}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">User Role Assignment</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Actions</TableHead>
                {canGrantAdmin && <TableHead>Admin Powers</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? users.map((user) => {
                const userPermission = adminPermissions.find(p => p.user_id === user.id);
                const isCurrentUser = user.id === currentUser.id;
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.full_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                      ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user.role || 'candidate'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {!isCurrentUser && (
                        <Select
                          value={user.role || 'candidate'}
                          onValueChange={(value) => handleUserRoleChange(user.id, value)}
                          disabled={!canGrantAdmin && user.role === 'admin'}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isCurrentUser && (
                        <span className="text-sm text-muted-foreground">Current User</span>
                      )}
                    </TableCell>
                    {canGrantAdmin && (
                      <TableCell>
                        {user.role === 'admin' && !isCurrentUser && (
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`admin-grant-${user.id}`} className="text-sm">
                              Can grant admin:
                            </Label>
                            <Switch 
                              id={`admin-grant-${user.id}`}
                              checked={userPermission?.can_grant_admin || false}
                              onCheckedChange={() => toggleCanGrantAdmin(user.id, userPermission?.can_grant_admin || false)}
                            />
                          </div>
                        )}
                        {isCurrentUser && (
                          <div className="flex items-center space-x-1">
                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                            <span className="text-sm">Super Admin</span>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={canGrantAdmin ? 5 : 4} className="text-center">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleManagement;
