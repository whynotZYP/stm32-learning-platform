import { createHashRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { DeviceConsolePage } from '../pages/DeviceConsolePage';
import { KnowledgeReportPage } from '../pages/KnowledgeReportPage';
import { AssessmentPage } from '../pages/AssessmentPage';
import { LessonPage } from '../pages/LessonPage';
import { LearningMapPage } from '../pages/LearningMapPage';
import { NotesSettingsPage } from '../pages/NotesSettingsPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { WeekPage } from '../pages/WeekPage';

export const routes: RouteObject[] = [{ element: <AppShell />, children: [
  { path: '/', element: <DashboardPage /> },
  { path: '/map', element: <LearningMapPage /> },
  { path: '/week/:week', element: <WeekPage /> },
  { path: '/lesson/:lessonId', element: <LessonPage /> },
  { path: '/assessment/:assessmentId', element: <AssessmentPage /> },
  { path: '/report', element: <KnowledgeReportPage /> },
  { path: '/device', element: <DeviceConsolePage /> },
  { path: '/notes', element: <NotesSettingsPage /> },
  { path: '*', element: <UnavailablePage /> },
]}];

export const router = createHashRouter(routes);
