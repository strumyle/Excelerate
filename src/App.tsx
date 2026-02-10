
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthLayout } from "./components/auth/AuthLayout";
import { AuthForm } from "./components/auth/AuthForm";
import { AccessDenied } from "./components/auth/AccessDenied";
import { AdminLayout } from "./components/layout/AdminLayout";
import { RequireAuth } from "./components/auth/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Questions from "./pages/Questions";
import QuestionCreate from "./pages/QuestionCreate";
import QuestionUpload from "./pages/QuestionUpload";
import Candidates from "./pages/Candidates";
import Tests from "./pages/Tests";
import TestCreate from "./pages/TestCreate";
import TestAssign from "./pages/TestAssign";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import RoleManagement from "./pages/RoleManagement";
import Tutorials from "./pages/Tutorials";
import Exam from "./pages/Exam";
import CandidateDashboard from "./pages/CandidateDashboard";
import TutorialQuiz from "./pages/TutorialQuiz";
import LearningPath from "./pages/LearningPath";
import CourseDetail from "./pages/CourseDetail";
import VerifyCertificate from "./pages/VerifyCertificate";
import { CourseBuilder } from "./pages/CourseBuilder";
import AdminScorm from "./pages/AdminScorm";
import ScormPlayer from "./pages/ScormPlayer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthLayout><AuthForm /></AuthLayout>} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="/verify/:serial" element={<VerifyCertificate />} />
          
          {/* Candidate routes */}
          <Route path="/candidate-dashboard" element={<RequireAuth allowedRoles={['candidate', 'admin']}><CandidateDashboard /></RequireAuth>} />
          <Route path="/learning-path" element={<RequireAuth allowedRoles={['candidate', 'admin']}><LearningPath /></RequireAuth>} />
          <Route path="/courses/:courseId" element={<RequireAuth allowedRoles={['candidate', 'admin']}><CourseDetail /></RequireAuth>} />
          <Route path="/learn/scorm/:attemptId" element={<RequireAuth allowedRoles={['candidate', 'admin']}><ScormPlayer /></RequireAuth>} />
          <Route path="/exam" element={<RequireAuth allowedRoles={['candidate', 'admin']}><Exam /></RequireAuth>} />
          <Route path="/exam/:testId" element={<RequireAuth allowedRoles={['candidate', 'admin']}><Exam /></RequireAuth>} />
          <Route path="/tutorial-quiz/:tutorialId" element={<RequireAuth allowedRoles={['candidate', 'admin']}><TutorialQuiz /></RequireAuth>} />
          
          {/* Admin routes */}
          <Route path="/dashboard" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Dashboard /></AdminLayout></RequireAuth>} />
          <Route path="/questions" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Questions /></AdminLayout></RequireAuth>} />
          <Route path="/questions/create" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><QuestionCreate /></AdminLayout></RequireAuth>} />
          <Route path="/questions/upload" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><QuestionUpload /></AdminLayout></RequireAuth>} />
          <Route path="/questions/edit/:id" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><QuestionCreate /></AdminLayout></RequireAuth>} />
          <Route path="/candidates" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Candidates /></AdminLayout></RequireAuth>} />
          <Route path="/tests" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Tests /></AdminLayout></RequireAuth>} />
          <Route path="/tests/create" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><TestCreate /></AdminLayout></RequireAuth>} />
          <Route path="/tests/assign" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><TestAssign /></AdminLayout></RequireAuth>} />
          <Route path="/results" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Results /></AdminLayout></RequireAuth>} />
          <Route path="/tutorials" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Tutorials /></AdminLayout></RequireAuth>} />
          <Route path="/course-builder" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><CourseBuilder /></AdminLayout></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><Settings /></AdminLayout></RequireAuth>} />
          <Route path="/admin/scorm" element={<RequireAuth allowedRoles={['admin']}><AdminLayout><AdminScorm /></AdminLayout></RequireAuth>} />
          
          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
