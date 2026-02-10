import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Chapter, CourseModule, createChapter, updateChapter, deleteChapter, reorderChapters, getCourseWithStructure } from '@/lib/courseBuilder';
import { ModuleManager } from './ModuleManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ChapterManagerProps {
  courseId: string;
  onStructureChange: () => void;
}

export function ChapterManager({ courseId, onStructureChange }: ChapterManagerProps) {
  const [chapters, setChapters] = useState<(Chapter & { modules: CourseModule[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showNewChapterDialog, setShowNewChapterDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadChapters();
  }, [courseId]);

  const loadChapters = async () => {
    if (!courseId) return;
    
    try {
      const courseStructure = await getCourseWithStructure(courseId);
      setChapters(courseStructure.chapters);
    } catch (error) {
      toast({
        title: "Error loading chapters",
        description: "Failed to load chapters. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return;

    try {
      const position = chapters.length;
      await createChapter({
        course_id: courseId,
        title: newChapterTitle,
        position
      });

      setNewChapterTitle('');
      setShowNewChapterDialog(false);
      loadChapters();
      onStructureChange();
      
      toast({
        title: "Chapter created",
        description: "New chapter has been added successfully.",
      });
    } catch (error) {
      toast({
        title: "Error creating chapter",
        description: "Failed to create chapter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateChapter = async (chapter: Chapter, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateChapter(chapter.id, { title: newTitle });
      loadChapters();
      onStructureChange();
      setEditingChapter(null);
      
      toast({
        title: "Chapter updated",
        description: "Chapter has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error updating chapter",
        description: "Failed to update chapter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm('Are you sure you want to delete this chapter? This will also delete all modules in this chapter.')) {
      return;
    }

    try {
      await deleteChapter(chapterId);
      loadChapters();
      onStructureChange();
      
      toast({
        title: "Chapter deleted",
        description: "Chapter and all its modules have been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error deleting chapter",
        description: "Failed to delete chapter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(chapters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setChapters(items);

    try {
      await reorderChapters(courseId, items.map(item => item.id));
      onStructureChange();
    } catch (error) {
      // Revert on error
      loadChapters();
      toast({
        title: "Error reordering chapters",
        description: "Failed to save new order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleChapterExpanded = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  if (loading) {
    return <div className="text-center py-4">Loading chapters...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Chapters</h3>
        <Dialog open={showNewChapterDialog} onOpenChange={setShowNewChapterDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Chapter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Chapter</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Enter chapter title"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateChapter()}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewChapterDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateChapter} disabled={!newChapterTitle.trim()}>
                  Create Chapter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No chapters yet. Create your first chapter to get started.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="chapters">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {chapters.map((chapter, index) => (
                  <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      >
                        <Collapsible 
                          open={expandedChapters.has(chapter.id)}
                          onOpenChange={() => toggleChapterExpanded(chapter.id)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              
                              <CollapsibleTrigger className="flex-1 flex items-center gap-2 text-left">
                                {expandedChapters.has(chapter.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <div className="flex-1">
                                  {editingChapter?.id === chapter.id ? (
                                    <Input
                                      defaultValue={chapter.title}
                                      onBlur={(e) => handleUpdateChapter(chapter, e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          handleUpdateChapter(chapter, e.currentTarget.value);
                                        }
                                      }}
                                      className="text-base font-medium"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-base">
                                        {index + 1}. {chapter.title}
                                      </CardTitle>
                                      <Badge variant="secondary">
                                        {chapter.modules?.length || 0} modules
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleTrigger>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingChapter(editingChapter?.id === chapter.id ? null : chapter)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteChapter(chapter.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <ModuleManager 
                                chapterId={chapter.id}
                                modules={chapter.modules || []}
                                onModuleChange={loadChapters}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}