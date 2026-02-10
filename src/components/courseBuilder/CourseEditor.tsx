import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Upload, Save, Eye } from 'lucide-react';
import { Course, CourseWithStructure, createCourse, updateCourse, getCourseWithStructure, uploadCourseThumbnail } from '@/lib/courseBuilder';
import { ChapterManager } from './ChapterManager';
import { CoursePreview } from './CoursePreview';

interface CourseEditorProps {
  course: Course | null;
  onClose: () => void;
}

export function CourseEditor({ course, onClose }: CourseEditorProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    level: '',
    is_published: false,
    slug: '',
    thumbnail_url: ''
  });
  const [courseStructure, setCourseStructure] = useState<CourseWithStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title,
        description: course.description || '',
        category: course.category || '',
        level: course.level || '',
        is_published: course.is_published,
        slug: course.slug || '',
        thumbnail_url: course.thumbnail_url || ''
      });
      loadCourseStructure();
    }
  }, [course]);

  const loadCourseStructure = async () => {
    if (!course) return;
    
    try {
      const structure = await getCourseWithStructure(course.id);
      setCourseStructure(structure);
    } catch (error) {
      toast({
        title: "Error loading course structure",
        description: "Failed to load chapters and modules.",
        variant: "destructive",
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title)
    }));
  };

  const handleThumbnailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, thumbnail_url: previewUrl }));
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Course title is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let thumbnailUrl = formData.thumbnail_url;
      
      // Upload thumbnail if a new file was selected
      if (thumbnailFile) {
        const courseId = course?.id || 'temp-' + Date.now();
        thumbnailUrl = await uploadCourseThumbnail(thumbnailFile, courseId);
      }

      const courseData = {
        ...formData,
        thumbnail_url: thumbnailUrl
      };

      if (course) {
        await updateCourse(course.id, courseData);
        toast({
          title: "Course updated",
          description: "Course has been updated successfully.",
        });
      } else {
        const newCourse = await createCourse(courseData);
        toast({
          title: "Course created",
          description: "Course has been created successfully.",
        });
        // Update courseStructure with new course data
        setCourseStructure({
          ...newCourse,
          chapters: []
        });
      }
      
      if (!course) {
        // Reload structure for new course
        await loadCourseStructure();
      }
    } catch (error) {
      toast({
        title: "Error saving course",
        description: "Failed to save course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showPreview && courseStructure) {
    return (
      <CoursePreview 
        course={courseStructure} 
        onClose={() => setShowPreview(false)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {course ? 'Edit Course' : 'Create Course'}
            </h1>
            <p className="text-muted-foreground">
              {course ? 'Update course details and structure' : 'Set up your new course'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {courseStructure && (
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Course'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Details */}
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter course title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter course description"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Technology"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select value={formData.level} onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="course-url-slug"
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="cursor-pointer"
                  />
                </div>
                {formData.thumbnail_url && (
                  <img 
                    src={formData.thumbnail_url} 
                    alt="Thumbnail preview" 
                    className="w-16 h-16 object-cover rounded border"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="published">Published</Label>
                <p className="text-sm text-muted-foreground">
                  Make this course visible to students
                </p>
              </div>
              <Switch
                id="published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Course Structure */}
        <Card>
          <CardHeader>
            <CardTitle>Course Structure</CardTitle>
          </CardHeader>
          <CardContent>
            {courseStructure || course ? (
              <ChapterManager 
                courseId={course?.id || courseStructure?.id || ''}
                onStructureChange={loadCourseStructure}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Save the course first to manage chapters and modules</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}