import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import SetterDashboard from "./pages/setter/SetterDashboard.tsx";
import QuestionnaireEditor from "./pages/setter/QuestionnaireEditor.tsx";
import Analytics from "./pages/setter/Analytics.tsx";
import SetterManual from "./pages/setter/SetterManual.tsx";
import StudentDashboard from "./pages/student/StudentDashboard.tsx";
import QuestionnaireTake from "./pages/student/QuestionnaireTake.tsx";
import ResultsPage from "./pages/student/ResultsPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/setter/dashboard" element={<ProtectedRoute requireRole="setter"><SetterDashboard /></ProtectedRoute>} />
            <Route path="/setter/questionnaire/:id/edit" element={<ProtectedRoute requireRole="setter"><QuestionnaireEditor /></ProtectedRoute>} />
            <Route path="/setter/questionnaire/:id/analytics" element={<ProtectedRoute requireRole="setter"><Analytics /></ProtectedRoute>} />
            <Route path="/setter/manual" element={<ProtectedRoute requireRole="setter"><SetterManual /></ProtectedRoute>} />

            <Route path="/student/dashboard" element={<ProtectedRoute requireRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/questionnaire/:id/take" element={<ProtectedRoute requireRole="student"><QuestionnaireTake /></ProtectedRoute>} />
            <Route path="/student/results/:responseId" element={<ProtectedRoute requireRole="student"><ResultsPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
