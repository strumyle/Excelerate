import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Link, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScormUpload } from '@/components/scorm/ScormUpload';

interface ScormPackage {
  id: string;
  title: string;
  version: string;
  created_at: string;
  is_active: boolean;
  entry_point?: string;
}

interface Course {
  id: string;
  title: string;
  modules: { id: string; title: string }[];
}

export default function AdminScorm() {
  const [packages, setPackages] = useState<ScormPackage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [{ data: packagePayload, error: packageError }, { data: coursesData, error: coursesError }] =
        await Promise.all([
          supabase.functions.invoke('admin-scorm-packages', {
            body: { action: 'listPackages' },
          }),
          supabase
            .from('courses')
            .select(`
              id,
              title,
              modules(id, title)
            `)
            .eq('is_active', true)
            .order('title'),
        ]);

      if (packageError) throw packageError;
      if (coursesError) throw coursesError;

      setPackages((packagePayload?.packages || []) as ScormPackage[]);
      setCourses((coursesData || []) as Course[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SCORM packages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachPackage = async () => {
    if (!selectedPackage || !selectedCourse || !selectedModule || !lessonTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-scorm-packages', {
        body: {
          action: 'attachPackage',
          packageId: selectedPackage,
          courseId: selectedCourse,
          moduleId: selectedModule,
          title: lessonTitle.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Success',
        description: 'SCORM package attached to course successfully',
      });

      setAttachDialogOpen(false);
      setSelectedPackage('');
      setSelectedCourse('');
      setSelectedModule('');
      setLessonTitle('');
      await loadData();
    } catch (error) {
      console.error('Error attaching package:', error);
      toast({
        title: 'Error',
        description: 'Failed to attach SCORM package',
        variant: 'destructive',
      });
    }
  };

  const selectedCourseData = courses.find((course) => course.id === selectedCourse);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading SCORM packages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            SCORM Packages
          </h1>
          <p className="text-muted-foreground mt-2">Manage and attach SCORM content to courses</p>
        </div>
        <ScormUpload onPackageUploaded={() => void loadData()} />
      </div>

      {packages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{pkg.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">SCORM {pkg.version}</Badge>
                      <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(pkg.created_at).toLocaleDateString()}
                </div>

                <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSelectedPackage(pkg.id);
                        setLessonTitle(`SCORM: ${pkg.title}`);
                      }}
                      className="w-full"
                      variant="outline"
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Attach to Course
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Attach SCORM Package</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="course">Course</Label>
                        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a course" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((course) => (
                              <SelectItem key={course.id} value={course.id}>
                                {course.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedCourseData && (
                        <div>
                          <Label htmlFor="module">Module</Label>
                          <Select value={selectedModule} onValueChange={setSelectedModule}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a module" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedCourseData.modules.map((module) => (
                                <SelectItem key={module.id} value={module.id}>
                                  {module.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="title">Lesson Title</Label>
                        <Input
                          id="title"
                          value={lessonTitle}
                          onChange={(event) => setLessonTitle(event.target.value)}
                          placeholder="Enter lesson title"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleAttachPackage} className="flex-1">
                          Attach Package
                        </Button>
                        <Button onClick={() => setAttachDialogOpen(false)} variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No SCORM packages</h3>
          <p className="text-muted-foreground mb-4">Upload your first SCORM package to get started.</p>
          <ScormUpload onPackageUploaded={() => void loadData()} />
        </div>
      )}
    </div>
  );
}
