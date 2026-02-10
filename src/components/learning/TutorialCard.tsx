import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TutorialCardProps {
  tutorial: {
    id: string;
    title: string;
    description: string | null;
    video_url: string | null;
    youtube_url: string | null;
    video_type: string;
    created_at: string;
    category?: {
      name: string;
      color: string;
    } | null;
  };
  questionCount: number;
  onWatch: (id: string) => void;
  onQuiz: (id: string) => void;
  isCompleted?: boolean;
}

export function TutorialCard({ tutorial, questionCount, onWatch, onQuiz, isCompleted }: TutorialCardProps) {
  const thumbnailUrl = tutorial.youtube_url 
    ? `https://img.youtube.com/vi/${extractYouTubeId(tutorial.youtube_url)}/mqdefault.jpg`
    : '/placeholder.svg';

  function extractYouTubeId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  }

  return (
    <Card className="group overflow-hidden border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 bg-card">
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img 
          src={thumbnailUrl} 
          alt={tutorial.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Button 
            size="lg" 
            className="bg-white/90 text-primary hover:bg-white"
            onClick={() => onWatch(tutorial.id)}
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Watch Now
          </Button>
        </div>
        {isCompleted && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-accent text-accent-foreground">
              <CheckCircle className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          </div>
        )}
        {tutorial.category && (
          <div className="absolute top-2 left-2">
            <Badge 
              variant="secondary" 
              className="text-xs font-medium"
              style={{ backgroundColor: `${tutorial.category.color}20`, color: tutorial.category.color }}
            >
              {tutorial.category.name}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {tutorial.title}
        </h3>
        {tutorial.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {tutorial.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(tutorial.created_at), 'MMM d, yyyy')}
          </div>
          {questionCount > 0 && (
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {questionCount} questions
            </div>
          )}
        </div>
        {questionCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            onClick={() => onQuiz(tutorial.id)}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Take Practice Quiz
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
