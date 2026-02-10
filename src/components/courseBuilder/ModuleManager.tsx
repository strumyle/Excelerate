import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, GripVertical, Video, FileText, HelpCircle, ExternalLink } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { CourseModule, createModule, updateModule, deleteModule, reorderModules } from '@/lib/courseBuilder';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ModuleManagerProps {
  chapterId: string;
  modules: CourseModule[];
  onModuleChange: () => void;
}

const moduleTypeIcons = {
  video: Video,
  article: FileText,
  quiz: HelpCircle,
  embed: ExternalLink,
};

const moduleTypeLabels = {
  video: 'Video',
  article: 'Article',
  quiz: 'Quiz',
  embed: 'Embed',
};

export function ModuleManager({ chapterId, modules, onModuleChange }: ModuleManagerProps) {
  const [showNewModuleDialog, setShowNewModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [newModuleData, setNewModuleData] = useState({
    title: '',
    type: 'video' as CourseModule['type'],
    content_url: '',
    duration_minutes: 0,
    is_required: true,
  });
  const { toast } = useToast();

  const handleCreateModule = async () => {
    if (!newModuleData.title.trim()) return;

    try {
      const position = modules.length;
      await createModule({
        chapter_id: chapterId,
        ...newModuleData,
        position
      });

      setNewModuleData({
        title: '',
        type: 'video',
        content_url: '',
        duration_minutes: 0,
        is_required: true,
      });
      setShowNewModuleDialog(false);
      onModuleChange();
      
      toast({
        title: "Module created",
        description: "New module has been added successfully.",
      });
    } catch (error) {
      toast({
        title: "Error creating module",
        description: "Failed to create module. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateModule = async (moduleId: string, updates: Partial<CourseModule>) => {
    try {
      await updateModule(moduleId, updates);
      onModuleChange();
      setEditingModule(null);
      
      toast({
        title: "Module updated",
        description: "Module has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error updating module",
        description: "Failed to update module. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) {
      return;
    }

    try {
      await deleteModule(moduleId);
      onModuleChange();
      
      toast({
        title: "Module deleted",
        description: "Module has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error deleting module",
        description: "Failed to delete module. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(modules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    try {
      await reorderModules(chapterId, items.map(item => item.id));
      onModuleChange();
    } catch (error) {
      toast({
        title: "Error reordering modules",
        description: "Failed to save new order. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Modules</h4>
        <Dialog open={showNewModuleDialog} onOpenChange={setShowNewModuleDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Module</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="module-title">Title *</Label>
                <Input
                  id="module-title"
                  value={newModuleData.title}
                  onChange={(e) => setNewModuleData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter module title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-type">Type</Label>
                <Select 
                  value={newModuleData.type} 
                  onValueChange={(value: CourseModule['type']) => setNewModuleData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="embed">Embed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-url">Content URL</Label>
                <Input
                  id="module-url"
                  value={newModuleData.content_url}
                  onChange={(e) => setNewModuleData(prev => ({ ...prev, content_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-duration">Duration (minutes)</Label>
                <Input
                  id="module-duration"
                  type="number"
                  value={newModuleData.duration_minutes}
                  onChange={(e) => setNewModuleData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="module-required">Required</Label>
                <Switch
                  id="module-required"
                  checked={newModuleData.is_required}
                  onCheckedChange={(checked) => setNewModuleData(prev => ({ ...prev, is_required: checked }))}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewModuleDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateModule} disabled={!newModuleData.title.trim()}>
                  Create Module
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No modules yet. Add your first module to get started.
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`modules-${chapterId}`}>
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {modules.map((module, index) => {
                  const Icon = moduleTypeIcons[module.type];
                  return (
                    <Draggable key={module.id} draggableId={module.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded border ${
                            snapshot.isDragging ? 'shadow-lg bg-background' : 'bg-muted/30'
                          }`}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {index + 1}. {module.title}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {moduleTypeLabels[module.type]}
                              </Badge>
                              {module.is_required && (
                                <Badge variant="secondary" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                            {module.duration_minutes > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {module.duration_minutes} min
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingModule(module)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteModule(module.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Edit Module Dialog */}
      {editingModule && (
        <Dialog open={!!editingModule} onOpenChange={() => setEditingModule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Module</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-module-title">Title *</Label>
                <Input
                  id="edit-module-title"
                  defaultValue={editingModule.title}
                  onBlur={(e) => {
                    if (e.target.value !== editingModule.title) {
                      handleUpdateModule(editingModule.id, { title: e.target.value });
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-module-type">Type</Label>
                <Select 
                  defaultValue={editingModule.type}
                  onValueChange={(value: CourseModule['type']) => 
                    handleUpdateModule(editingModule.id, { type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="embed">Embed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-module-url">Content URL</Label>
                <Input
                  id="edit-module-url"
                  defaultValue={editingModule.content_url || ''}
                  onBlur={(e) => {
                    if (e.target.value !== editingModule.content_url) {
                      handleUpdateModule(editingModule.id, { content_url: e.target.value });
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-module-duration">Duration (minutes)</Label>
                <Input
                  id="edit-module-duration"
                  type="number"
                  defaultValue={editingModule.duration_minutes || 0}
                  onBlur={(e) => {
                    const duration = parseInt(e.target.value) || 0;
                    if (duration !== editingModule.duration_minutes) {
                      handleUpdateModule(editingModule.id, { duration_minutes: duration });
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-module-required">Required</Label>
                <Switch
                  id="edit-module-required"
                  defaultChecked={editingModule.is_required}
                  onCheckedChange={(checked) => 
                    handleUpdateModule(editingModule.id, { is_required: checked })
                  }
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}