
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, PlayCircle, Trash2, Eye, EyeOff, Folder } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { TutorialQuizManager } from '@/components/TutorialQuizManager';
import { VideoPlayer } from '@/components/VideoPlayer';
import { TutorialCategoryManager } from '@/components/admin/TutorialCategoryManager';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  video_type: 'youtube' | 'mp4' | 'webm' | 'ogg';
  video_url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  category_id: string | null;
  category?: Category | null;
}

export default function Tutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_type: 'youtube' as 'youtube' | 'mp4' | 'webm' | 'ogg',
    video_url: '',
    youtube_url: '',
    category_id: '' as string
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchTutorials(), fetchCategories()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('tutorial_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTutorials = async () => {
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .select(`
          *,
          category:tutorial_categories(id, name, color)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTutorials((data as Tutorial[]) || []);
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      toast({
        title: "Error",
        description: "Failed to load tutorials.",
        variant: "destructive"
      });
    }
  };

  const updateTutorialCategory = async (tutorialId: string, categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('tutorials')
        .update({ category_id: categoryId })
        .eq('id', tutorialId);

      if (error) throw error;

      await fetchTutorials();
      toast({
        title: "Success",
        description: "Tutorial category updated"
      });
    } catch (error) {
      console.error('Error updating tutorial category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const videoUrl = formData.video_type === 'youtube' ? formData.youtube_url : formData.video_url;
    
    if (!formData.title.trim() || !videoUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and video URL are required.",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('tutorials')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim(),
          video_type: formData.video_type,
          video_url: videoUrl.trim(),
          youtube_url: formData.video_type === 'youtube' ? formData.youtube_url.trim() : null,
          created_by: sessionData.session.user.id,
          category_id: formData.category_id || null
        });

      if (error) throw error;

      setFormData({ title: '', description: '', video_type: 'youtube', video_url: '', youtube_url: '', category_id: '' });
      await fetchTutorials();
      
      toast({
        title: "Tutorial Created",
        description: "Tutorial has been sent to all candidates.",
      });
    } catch (error) {
      console.error('Error creating tutorial:', error);
      toast({
        title: "Error",
        description: "Failed to create tutorial.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleTutorialStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tutorials')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setTutorials(prev => prev.map(tutorial => 
        tutorial.id === id 
          ? { ...tutorial, is_active: !currentStatus }
          : tutorial
      ));

      toast({
        title: "Tutorial Updated",
        description: `Tutorial has been ${!currentStatus ? 'activated' : 'deactivated'}.`,
      });
    } catch (error) {
      console.error('Error updating tutorial:', error);
      toast({
        title: "Error",
        description: "Failed to update tutorial status.",
        variant: "destructive"
      });
    }
  };

  const deleteTutorial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tutorial?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tutorials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTutorials(prev => prev.filter(tutorial => tutorial.id !== id));
      
      toast({
        title: "Tutorial Deleted",
        description: "Tutorial has been permanently deleted.",
      });
    } catch (error) {
      console.error('Error deleting tutorial:', error);
      toast({
        title: "Error",
        description: "Failed to delete tutorial.",
        variant: "destructive"
      });
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading tutorials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tutorials Management</h1>
      </div>

      {/* Category Manager */}
      <TutorialCategoryManager onCategoryChange={fetchCategories} />

      {/* Create Tutorial Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlayCircle className="h-5 w-5 mr-2" />
            Create New Tutorial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="title">Tutorial Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter tutorial title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="video_type">Video Type *</Label>
                <Select
                  value={formData.video_type}
                  onValueChange={(value: 'youtube' | 'mp4' | 'webm' | 'ogg') => 
                    setFormData(prev => ({ ...prev, video_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select video type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="mp4">MP4 Video</SelectItem>
                    <SelectItem value="webm">WebM Video</SelectItem>
                    <SelectItem value="ogg">OGG Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="video_url">
                  {formData.video_type === 'youtube' ? 'YouTube URL *' : 'Video URL *'}
                </Label>
                <Input
                  id="video_url"
                  value={formData.video_type === 'youtube' ? formData.youtube_url : formData.video_url}
                  onChange={(e) => {
                    if (formData.video_type === 'youtube') {
                      setFormData(prev => ({ ...prev, youtube_url: e.target.value }));
                    } else {
                      setFormData(prev => ({ ...prev, video_url: e.target.value }));
                    }
                  }}
                  placeholder={
                    formData.video_type === 'youtube' 
                      ? "https://www.youtube.com/watch?v=..." 
                      : "https://example.com/video.mp4"
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the tutorial"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="category">Category (Folder)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Send to All Candidates'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tutorials List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Tutorials</CardTitle>
        </CardHeader>
        <CardContent>
          {tutorials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tutorials created yet.</p>
          ) : (
            <div className="space-y-4">
              {tutorials.map((tutorial) => {
                // Display preview if a video URL is available
                return (
                  <div key={tutorial.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{tutorial.title}</h3>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={tutorial.is_active}
                              onCheckedChange={() => toggleTutorialStatus(tutorial.id, tutorial.is_active)}
                            />
                            {tutorial.is_active ? (
                              <Eye className="h-4 w-4 text-green-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-muted-foreground mb-3">{tutorial.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span>Created: {format(new Date(tutorial.created_at), 'MMM d, yyyy HH:mm')}</span>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            <Select
                              value={tutorial.category_id || 'none'}
                              onValueChange={(value) => updateTutorialCategory(tutorial.id, value === 'none' ? null : value)}
                            >
                              <SelectTrigger className="h-7 w-40">
                                <SelectValue placeholder="No category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Category</SelectItem>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                      {cat.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {(tutorial.video_url || tutorial.youtube_url) && (
                          <div className="mb-3">
                            <VideoPlayer
                              videoType={tutorial.video_type || 'youtube'}
                              videoUrl={tutorial.video_url || tutorial.youtube_url}
                              title={tutorial.title}
                              width="300"
                              height="169"
                            />
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedTutorial(expandedTutorial === tutorial.id ? null : tutorial.id)}
                          className="mb-3"
                        >
                          {expandedTutorial === tutorial.id ? 'Hide Quiz Questions' : 'Manage Quiz Questions'}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTutorial(tutorial.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {expandedTutorial === tutorial.id && (
                      <TutorialQuizManager tutorialId={tutorial.id} tutorialTitle={tutorial.title} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
