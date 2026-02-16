
import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Info, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface ExamLandingProps {
  testId: string;
  test: any;
  userDetails: any;
  onStart: () => void;
}

export function ExamLanding({ testId, test, userDetails, onStart }: ExamLandingProps) {
  const navigate = useNavigate();
  const [initializing, setInitializing] = useState(false);

  const handleStartTest = async () => {
    setInitializing(true);
    
    try {
      // Submission creation/resume is handled by the parent Exam page.
      onStart();
    } catch (error) {
      console.error('Error starting test:', error);
      setInitializing(false);
    }
  };

  // Get candidate initials for the avatar fallback
  const getInitials = () => {
    if (!userDetails?.full_name) return 'C';
    
    return userDetails.full_name
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card className="shadow-lg border-border">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-babban-blue-200">
                <AvatarFallback className="bg-babban-blue-50 text-babban-blue-700">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{test?.title || "Excel Proficiency Test"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Welcome, {userDetails?.full_name || "Candidate"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-babban-blue-50 p-2 rounded-md text-babban-blue-700">
                <Clock className="h-5 w-5" />
                <span className="font-mono">{test?.duration_minutes || 30} minutes</span>
              </div>
              <Button
                onClick={handleStartTest}
                disabled={initializing}
                className="inline-flex bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {initializing ? "Preparing..." : "Start Test"}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6">
          <div className="rounded-lg bg-blue-50 p-4 flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-700 mb-2">Test Instructions</h3>
              <ul className="space-y-2 text-sm">
                <li>This test consists of multiple-choice questions about {test?.description || "Excel functions and operations"}.</li>
                <li>You have <span className="font-semibold">{test?.duration_minutes || 30} minutes</span> to complete the test.</li>
                <li>Read each question carefully and select the best answer.</li>
                <li>You must answer a question before moving to the next one.</li>
                <li>Your test will be automatically submitted when the time expires.</li>
              </ul>
            </div>
          </div>
          
          <Separator />
          
          <div className="rounded-lg bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-700 mb-2">Important Notice</h3>
              <ul className="space-y-2 text-sm">
                <li>Switching browser tabs or windows is not permitted and will be recorded.</li>
                <li>Attempts to copy questions or use external resources will be flagged.</li>
                <li>Camera and microphone access is required for proctoring throughout the assessment.</li>
                <li>Ensure you have a stable internet connection before starting.</li>
                <li>Once you start the test, you must complete it in one sitting.</li>
              </ul>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t p-4">
          <Button 
            className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg"
            disabled={initializing}
            onClick={handleStartTest}
          >
            {initializing ? "Preparing Test..." : "Start Test Now"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
