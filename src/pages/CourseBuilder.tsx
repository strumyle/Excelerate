import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, BookOpen, GripVertical, Upload } from 'lucide-react';
import { getAllCourses, Course } from '@/lib/courseBuilder';
import { CourseEditor } from '@/components/courseBuilder/CourseEditor';
import { ScormUpload } from '@/components/scorm/ScormUpload';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export function CourseBuilder() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showScormUpload, setShowScormUpload] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const coursesData = await getAllCourses();
      setCourses(coursesData);
    } catch (error) {
      toast({
        title: "Error loading courses",
        description: "Failed to load courses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = () => {
    setSelectedCourse(null);
    setShowEditor(true);
  };

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedCourse(null);
    loadCourses();
  };

  if (showScormUpload) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setShowScormUpload(false)}
          >
            ← Back to Courses
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Upload SCORM Package</h1>
            <p className="text-muted-foreground">
              Import SCORM 1.2 or 2004 content packages
            </p>
          </div>
        </div>
        <ScormUpload 
          onPackageUploaded={() => {
            toast({
              title: "SCORM Package Uploaded",
              description: "Your SCORM package has been uploaded and is ready for learners.",
            });
            setShowScormUpload(false);
          }}
        />
      </div>
    );
  }

  if (showEditor) {
    return (
      <CourseEditor 
        course={selectedCourse} 
        onClose={handleCloseEditor}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading courses...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Course Builder</h1>
          <p className="text-muted-foreground">
            Create and manage courses with chapters and modules
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateCourse}>
            <Plus className="h-4 w-4 mr-2" />
            New Course
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowScormUpload(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload SCORM
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first course
            </p>
            <Button onClick={handleCreateCourse}>
              <Plus className="h-4 w-4 mr-2" />
              Create Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              {course.thumbnail_url && (
                <div className="aspect-video w-full bg-muted rounded-t-lg overflow-hidden">
                  <img 
                    src={course.thumbnail_url} 
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-lg line-clamp-2">
                      {course.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={course.is_published ? "default" : "secondary"}>
                        {course.is_published ? "Published" : "Draft"}
                      </Badge>
                      {course.level && (
                        <Badge variant="outline">{course.level}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {course.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {course.description}
                  </p>
                )}
                {course.category && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Category: {course.category}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditCourse(course)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}