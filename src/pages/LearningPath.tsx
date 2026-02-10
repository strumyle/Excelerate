import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Award, Download, Plus, Search, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMyEnrollments, getAvailableCourses, enrollInCourse, getMyCertificate, issueCertificate } from '@/lib/learning';
import type { Course, EnrollmentProgress, Certificate } from '@/lib/learning';
import { useToast } from "@/hooks/use-toast";
import CourseSearch from '@/components/learning/CourseSearch';
import ScormLessonsTab from '@/components/learning/ScormLessonsTab';

export default function LearningPath() {
  const [enrollments, setEnrollments] = useState<EnrollmentProgress[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [scormAttempts, setScormAttempts] = useState<any[]>([]);
  const [scormPackages, setScormPackages] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<Record<string, Certificate>>({});
  const [loading, setLoading] = useState(true);
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [enrollmentsData, availableData] = await Promise.all([
        getMyEnrollments(),
        getAvailableCourses()
      ]);
      
      setEnrollments(enrollmentsData);
      setAvailableCourses(availableData);

      // Load certificates for completed courses
      const certPromises = enrollmentsData
        .filter(e => e.percent_complete >= 100)
        .map(async e => {
          const cert = await getMyCertificate(e.course_id);
          return [e.course_id, cert];
        });
      
      const certResults = await Promise.all(certPromises);
      const certMap: Record<string, Certificate> = {};
      certResults.forEach(([courseId, cert]) => {
        if (cert) certMap[courseId as string] = cert as Certificate;
      });
      setCertificates(certMap);
    } catch (error) {
      console.error('Error loading learning path:', error);
      toast({
        title: "Error",
        description: "Failed to load learning path data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      await enrollInCourse(courseId);
      toast({
        title: "Success",
        description: "Successfully enrolled in course"
      });
      loadData(); // Reload data
    } catch (error) {
      console.error('Error enrolling:', error);
      toast({
        title: "Error",
        description: "Failed to enroll in course",
        variant: "destructive"
      });
    }
  };

  const handleGetCertificate = async (courseId: string) => {
    try {
      setGeneratingCert(courseId);
      const result = await issueCertificate(courseId);
      
      // Download the certificate
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }
      
      toast({
        title: "Success",
        description: "Certificate generated successfully!"
      });
      
      loadData(); // Reload to update certificate state
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: "Error",
        description: "Failed to generate certificate",
        variant: "destructive"
      });
    } finally {
      setGeneratingCert(null);
    }
  };

  const handleDownloadCertificate = async (courseId: string) => {
    const certificate = certificates[courseId];
    if (!certificate) return;

    try {
      const result = await issueCertificate(courseId); // This will return existing cert
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast({
        title: "Error",
        description: "Failed to download certificate",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading your learning path...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          My Learning Path
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your progress and earn certificates
        </p>
      </div>

      <Tabs defaultValue="enrolled" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="enrolled" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            My Courses
          </TabsTrigger>
          <TabsTrigger value="scorm" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            SCORM Content
          </TabsTrigger>
          <TabsTrigger value="available" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Available
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* Enrolled Courses Tab */}
        <TabsContent value="enrolled">
          {enrollments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map((enrollment) => {
                const progress = enrollment.percent_complete || 0;
                const isCompleted = progress >= 100;
                const hasCertificate = certificates[enrollment.course_id];
                
                return (
                  <Card key={enrollment.enrollment_id} className="hover:shadow-lg transition-shadow">
                    {enrollment.course_thumbnail_url && (
                      <div className="aspect-video w-full bg-muted rounded-t-lg overflow-hidden">
                        <img 
                          src={enrollment.course_thumbnail_url} 
                          alt={enrollment.course_title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{enrollment.course_title}</CardTitle>
                          <CardDescription className="mt-1">
                            {enrollment.course_description}
                          </CardDescription>
                        </div>
                        <Badge variant={isCompleted ? "default" : "secondary"}>
                          {isCompleted ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Progress</span>
                          <span className="text-sm font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {enrollment.completed_required} of {enrollment.required_modules} required modules
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => navigate(`/courses/${enrollment.course_id}`)}
                          className="flex-1"
                          variant={isCompleted ? "secondary" : "default"}
                        >
                          {isCompleted ? "Review" : "Continue"}
                        </Button>
                        
                        {isCompleted && (
                          <>
                            {hasCertificate ? (
                              <Button
                                onClick={() => handleDownloadCertificate(enrollment.course_id)}
                                variant="outline"
                                size="icon"
                                title="Download Certificate"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleGetCertificate(enrollment.course_id)}
                                variant="outline"
                                size="icon"
                                disabled={generatingCert === enrollment.course_id}
                                title="Get Certificate"
                              >
                                {generatingCert === enrollment.course_id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                ) : (
                                  <Award className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No enrolled courses</h3>
              <p className="text-muted-foreground mb-4">
                Browse available courses to start your learning journey.
              </p>
              <Button onClick={() => navigate('/available')}>
                Browse Courses
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Available Courses Tab */}
        <TabsContent value="available">
          {availableCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCourses.map((course) => (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  {course.thumbnail_url && (
                    <div className="aspect-video w-full bg-muted rounded-t-lg overflow-hidden">
                      <img 
                        src={course.thumbnail_url} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <CardDescription>{course.description}</CardDescription>
                    <div className="flex gap-2 mt-2">
                      {course.category && (
                        <Badge variant="secondary" className="text-xs">
                          {course.category}
                        </Badge>
                      )}
                      {course.level && (
                        <Badge variant="outline" className="text-xs">
                          {course.level}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleEnroll(course.id)}
                      className="w-full"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No available courses</h3>
              <p className="text-muted-foreground">
                All published courses are either enrolled or completed.
              </p>
            </div>
          )}
        </TabsContent>

        {/* SCORM Content Tab */}
        <TabsContent value="scorm">
          <ScormLessonsTab />
        </TabsContent>

        {/* Search Courses Tab */}
        <TabsContent value="search">
          <CourseSearch onEnroll={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}