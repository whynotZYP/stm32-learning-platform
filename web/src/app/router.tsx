import { createHashRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { KnowledgeReportPage } from '../pages/KnowledgeReportPage';
import { LearningMapPage } from '../pages/LearningMapPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { WeekPage } from '../pages/WeekPage';

export const routes: RouteObject[] = [{ element: <AppShell />, children: [
  { path: '/', element: <DashboardPage /> },
  { path: '/map', element: <LearningMapPage /> },
  { path: '/week/:week', element: <WeekPage /> },
  { path: '/report', element: <KnowledgeReportPage /> },
  { path: '*', element: <UnavailablePage /> },
]}];

export const router = createHashRouter(routes);
