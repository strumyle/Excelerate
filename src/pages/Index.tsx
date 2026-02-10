import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  CheckCircle2, 
  Users, 
  BarChart3, 
  Clock, 
  ArrowRight,
  Zap,
  Award,
  ChevronRight,
  Lock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          if (data.session.user.email === 'ameh.oche@babbangona.com' || 
              data.session.user.id === '600a8af2-9ccf-4c55-b351-a14e2b5b2221') {
            navigate('/dashboard');
            return;
          }
          
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('role')
              .eq('id', data.session.user.id)
              .single();
            
            if (error) {
              if (error.message.includes('infinite recursion')) {
                navigate('/candidate-dashboard');
                return;
              }
              navigate('/auth');
              return;
            }
            
            if (userData && userData.role === 'admin') {
              navigate('/dashboard');
            } else {
              navigate('/candidate-dashboard');
            }
          } catch (error) {
            navigate('/auth');
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const features = [
    {
      icon: Shield,
      title: "Anti-Cheat Proctoring",
      description: "Real-time monitoring detects tab switching, screen sharing, and suspicious behavior automatically."
    },
    {
      icon: Zap,
      title: "Randomized Questions",
      description: "Dynamic question pools ensure each candidate receives a unique test, preventing collaboration."
    },
    {
      icon: BarChart3,
      title: "Detailed Analytics",
      description: "Comprehensive dashboards reveal team strengths, skill gaps, and individual performance trends."
    },
    {
      icon: Clock,
      title: "Instant Results",
      description: "Automated grading delivers immediate scores with detailed breakdowns and recommendations."
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Organize candidates by department, manage permissions, and track progress at scale."
    },
    {
      icon: Award,
      title: "Certifications",
      description: "Generate verifiable certificates upon completion with secure validation links."
    }
  ];

  const steps = [
    {
      step: "01",
      title: "Create Your Test",
      description: "Choose from our question bank or upload custom Excel scenarios. Configure timing, difficulty, and proctoring rules."
    },
    {
      step: "02",
      title: "Invite Candidates",
      description: "Send secure test links to your team. Candidates receive clear instructions and can start when ready."
    },
    {
      step: "03",
      title: "Analyze Results",
      description: "Access real-time dashboards, export detailed reports, and identify training opportunities instantly."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-border/60 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Excelerate logo"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xl font-semibold text-foreground">Excelerate</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors link-underline">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors link-underline">
              How it Works
            </a>
            <a href="#access" className="text-sm text-muted-foreground hover:text-foreground transition-colors link-underline">
              Access
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')} className="text-sm">
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Open Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section relative">
        <div className="container mx-auto section-spacing relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 badge-accent mb-6">
              <Lock className="h-3 w-3" />
              <span>Internal skill assessment</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Excel testing that's
              <span className="block text-gradient"> fair and fast</span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Proctored assessments with randomized questions, real-time analytics, 
              and instant results. Measure actual skill, not search ability.
            </p>
            
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="bg-accent hover:bg-accent/90 text-accent-foreground h-12 px-10 text-base font-medium"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="section-spacing bg-secondary/30">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">The Problem</span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-6">
                Traditional testing is broken
              </h2>
              <div className="space-y-4">
                {[
                  "Candidates easily switch tabs to look up answers",
                  "Screen sharing and collaboration go undetected",
                  "Manual grading is slow and inconsistent",
                  "No visibility into team-wide skill gaps"
                ].map((problem, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground">{problem}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-card rounded-2xl p-8 border border-border">
              <span className="text-sm font-medium text-accent uppercase tracking-wider">The Solution</span>
              <h3 className="text-2xl font-bold text-foreground mt-3 mb-6">
                Excelerate fixes this
              </h3>
              <div className="space-y-4">
                {[
                  "Real-time proctoring with violation detection",
                  "Randomized questions prevent collaboration",
                  "Instant automated scoring and feedback",
                  "Comprehensive team analytics dashboard"
                ].map((solution, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <p className="text-foreground">{solution}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section-spacing">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-accent uppercase tracking-wider">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Everything you need to assess skills
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete platform for creating, administering, and analyzing Excel proficiency tests.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="feature-card">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-spacing bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-accent uppercase tracking-wider">Process</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Get started in minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A streamlined workflow from test creation to actionable insights.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-border/50 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-4 h-6 w-6 text-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="access" className="section-spacing bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Internal access only
          </h2>
          <p className="text-xl text-primary-foreground/70 mb-8 max-w-2xl mx-auto">
            Excelerate is used internally to measure skill proficiency across teams.
            Sign in with your company account to continue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate('/auth')}
              className="bg-accent hover:bg-accent/90 text-accent-foreground h-12 px-8"
            >
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background section-spacing-sm">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-background/20 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Excelerate logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="text-lg font-semibold">Excelerate</span>
              </div>
              <p className="text-sm text-background/60">
                Internal Excel skill assessment tool.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li><a href="#features" className="hover:text-background transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-background transition-colors">How it Works</a></li>
                <li><a href="#access" className="hover:text-background transition-colors">Access</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Security</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Internal</h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li><a href="#" className="hover:text-background transition-colors">Teams</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Guidelines</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Admin Help</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li><a href="#" className="hover:text-background transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-background transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-background/10 text-center text-sm text-background/40">
            (c) {new Date().getFullYear()} Excelerate. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;


