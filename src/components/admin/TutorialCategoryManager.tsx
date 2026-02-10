import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Folder, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  GripVertical,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
}

interface CategoryManagerProps {
  onCategoryChange?: () => void;
}

export function TutorialCategoryManager({ onCategoryChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#003296'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

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
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setCreating(true);
    try {
      const maxSortOrder = Math.max(...categories.map(c => c.sort_order), -1);
      const { error } = await supabase
        .from('tutorial_categories')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          sort_order: maxSortOrder + 1
        });

      if (error) throw error;

      setFormData({ name: '', description: '', color: '#003296' });
      await fetchCategories();
      onCategoryChange?.();
      toast({
        title: "Success",
        description: "Category created successfully"
      });
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditFormData({
      name: category.name,
      description: category.description || '',
      color: category.color
    });
  };

  const handleSaveEdit = async (categoryId: string) => {
    if (!editFormData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('tutorial_categories')
        .update({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || null,
          color: editFormData.color
        })
        .eq('id', categoryId);

      if (error) throw error;

      setEditingId(null);
      await fetchCategories();
      onCategoryChange?.();
      toast({
        title: "Success",
        description: "Category updated successfully"
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Delete this category? Tutorials in this category will become uncategorized.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tutorial_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      await fetchCategories();
      onCategoryChange?.();
      toast({
        title: "Success",
        description: "Category deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive"
      });
    }
  };

  const colorPresets = [
    '#003296', // Blue
    '#329632', // Green
    '#F8DF3F', // Yellow
    '#9333ea', // Purple
    '#ec4899', // Pink
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
  ];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center text-lg">
              <Folder className="h-5 w-5 mr-2" />
              Tutorial Categories (Folders)
            </CardTitle>
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Create Form */}
            <form onSubmit={handleCreate} className="space-y-3 p-4 bg-secondary/50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="cat-name">Category Name *</Label>
                  <Input
                    id="cat-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Safety Training"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-desc">Description</Label>
                  <Input
                    id="cat-desc"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-1 mt-1">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <Button type="submit" disabled={creating || !formData.name.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Category
              </Button>
            </form>

            {/* Categories List */}
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading categories...</p>
            ) : categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No categories yet. Create one above to organize your tutorials.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div 
                    key={category.id} 
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: category.color }}
                    />
                    
                    {editingId === category.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editFormData.name}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="h-8"
                        />
                        <div className="flex gap-1">
                          {colorPresets.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-5 h-5 rounded-full border ${
                                editFormData.color === color ? 'border-foreground' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditFormData(prev => ({ ...prev, color }))}
                            />
                          ))}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(category.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="font-medium">{category.name}</p>
                          {category.description && (
                            <p className="text-sm text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(category)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
