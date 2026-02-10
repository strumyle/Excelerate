import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Clock, Users, Plus } from 'lucide-react';
import { searchCourses, enrollInCourse } from '@/lib/learning';
import type { Course } from '@/lib/learning';
import { useToast } from '@/hooks/use-toast';
import { debounce } from 'lodash';

interface CourseSearchProps {
  onEnroll?: () => void;
}

export default function CourseSearch({ onEnroll }: CourseSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const { toast } = useToast();

  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const results = await searchCourses(term);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        toast({
          title: "Error",
          description: "Failed to search courses",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
  };

  const handleEnroll = async (courseId: string) => {
    try {
      setEnrolling(courseId);
      await enrollInCourse(courseId);
      toast({
        title: "Success",
        description: "Successfully enrolled in course!"
      });
      onEnroll?.();
      // Remove from search results
      setSearchResults(prev => prev.filter(course => course.id !== courseId));
    } catch (error) {
      console.error('Enrollment error:', error);
      toast({
        title: "Error",
        description: "Failed to enroll in course",
        variant: "destructive"
      });
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search for courses by title, description, or category..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Searching courses...</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                  <BookOpen className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                </div>
                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {course.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
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
                
                <Button
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className="w-full"
                  size="sm"
                >
                  {enrolling === course.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Enroll Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchTerm.trim() && !loading && searchResults.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No courses found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search terms or browse available categories.
          </p>
        </div>
      )}
    </div>
  );
}