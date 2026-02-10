import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { TutorialCard } from './TutorialCard';
import { TutorialSearch } from './TutorialSearch';
import { CategoryFilter } from './CategoryFilter';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, BookOpen, PlayCircle } from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  video_url: string | null;
  video_type: string;
  created_at: string;
  category_id: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  tutorial_count?: number;
}

export function StudentTutorialsView() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [watchingTutorial, setWatchingTutorial] = useState<Tutorial | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('tutorial_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Fetch tutorials with category relationship
      const { data: tutorialsData, error: tutorialsError } = await supabase
        .from('tutorials')
        .select(`
          *,
          category:tutorial_categories(id, name, color)
        `)
        .eq('is_active', true)
        .order('title', { ascending: true });

      if (tutorialsError) throw tutorialsError;

      // Fetch question counts
      const questionCountsMap: Record<string, number> = {};
      if (tutorialsData && tutorialsData.length > 0) {
        for (const tutorial of tutorialsData) {
          const { count, error: countError } = await supabase
            .from('tutorial_quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('tutorial_id', tutorial.id);

          if (!countError) {
            questionCountsMap[tutorial.id] = count || 0;
          }
        }
      }

      // Calculate tutorial count per category
      const categoriesWithCounts = (categoriesData || []).map(cat => ({
        ...cat,
        tutorial_count: (tutorialsData || []).filter(t => t.category_id === cat.id).length
      }));

      setCategories(categoriesWithCounts);
      setTutorials(tutorialsData || []);
      setQuestionCounts(questionCountsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load tutorials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTutorials = useMemo(() => {
    let filtered = tutorials;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category_id === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(term) ||
        (t.description?.toLowerCase().includes(term)) ||
        (t.category?.name.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [tutorials, selectedCategory, searchTerm]);

  const handleWatch = (tutorialId: string) => {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    if (tutorial) {
      setWatchingTutorial(tutorial);
    }
  };

  const handleQuiz = (tutorialId: string) => {
    navigate(`/tutorial-quiz/${tutorialId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading tutorials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-primary-foreground">
        <div className="flex items-center gap-3 mb-2">
          <PlayCircle className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Learning Hub</h1>
        </div>
        <p className="text-primary-foreground/80 mb-4">
          Explore tutorials and practice quizzes to boost your skills
        </p>
        <TutorialSearch 
          onSearch={setSearchTerm} 
          placeholder="Search by title, description, or category..."
        />
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredTutorials.length} {filteredTutorials.length === 1 ? 'tutorial' : 'tutorials'} found
          {selectedCategory && categories.find(c => c.id === selectedCategory) && (
            <span> in <strong>{categories.find(c => c.id === selectedCategory)?.name}</strong></span>
          )}
          {searchTerm && <span> matching "<strong>{searchTerm}</strong>"</span>}
        </p>
      </div>

      {/* Tutorials Grid */}
      {filteredTutorials.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No tutorials found</h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedCategory 
              ? "Try adjusting your search or filters"
              : "Check back later for new content"
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              questionCount={questionCounts[tutorial.id] || 0}
              onWatch={handleWatch}
              onQuiz={handleQuiz}
            />
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={!!watchingTutorial} onOpenChange={() => setWatchingTutorial(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{watchingTutorial?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {watchingTutorial && (watchingTutorial.video_url || watchingTutorial.youtube_url) && (
              <VideoPlayer
                videoType={(watchingTutorial.video_type as 'youtube' | 'mp4' | 'webm' | 'ogg') || 'youtube'}
                videoUrl={watchingTutorial.video_url || watchingTutorial.youtube_url || ''}
                title={watchingTutorial.title}
                className="w-full aspect-video"
              />
            )}
            {watchingTutorial?.description && (
              <p className="mt-4 text-muted-foreground">{watchingTutorial.description}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
