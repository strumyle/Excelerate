
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  ClipboardList,
  BarChart4,
  Settings,
  LogOut,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

export function CollapsibleSidebar() {
  const { pathname } = useLocation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      navigate('/auth');
    }
  };

  const navItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Questions',
      href: '/questions',
      icon: FileSpreadsheet,
      children: [
        {
          title: 'All Questions',
          href: '/questions',
        },
        {
          title: 'Upload Questions',
          href: '/questions/upload',
        },
        {
          title: 'Create Question',
          href: '/questions/create',
        },
      ],
    },
    {
      title: 'Candidates',
      href: '/candidates',
      icon: Users,
    },
    {
      title: 'Tests',
      href: '/tests',
      icon: ClipboardList,
      children: [
        {
          title: 'All Tests',
          href: '/tests',
        },
        {
          title: 'Create Test',
          href: '/tests/create',
        },
        {
          title: 'Assign Tests',
          href: '/tests/assign',
        },
      ],
    },
    {
      title: 'Results',
      href: '/results',
      icon: BarChart4,
    },
    {
      title: 'Tutorials',
      href: '/tutorials',
      icon: PlayCircle,
    },
    {
      title: 'Course Builder',
      href: '/course-builder',
      icon: BookOpen,
    },
    {
      title: 'Role Management',
      href: '/role-management',
      icon: UserCheck,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <div className={cn(
      "h-screen flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-sidebar-foreground" />
            <h1 className="font-bold text-xl text-sidebar-foreground">Excelerate</h1>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navItems.map((item) => (
            <div key={item.title}>
              <Link to={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground",
                    isCollapsed && "px-2"
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && item.title}
                </Button>
              </Link>
              {item.children && pathname.startsWith(item.href) && !isCollapsed && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link to={child.href} key={child.title}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                          pathname === child.href && "bg-sidebar-accent/50 text-sidebar-foreground"
                        )}
                      >
                        {child.title}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
      
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed && "px-2"
          )}
          onClick={handleSignOut}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
          {!isCollapsed && "Sign Out"}
        </Button>
      </div>
    </div>
  );
}
