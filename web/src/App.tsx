import { RouterProvider } from 'react-router-dom';
import { ProgressProvider } from './app/ProgressContext';
import { router } from './app/router';
import { createIndexedDbProgressRepository } from './infrastructure/indexedDbProgressRepository';

const repository = createIndexedDbProgressRepository();

export function App() {
  return <ProgressProvider repository={repository}><RouterProvider router={router} /></ProgressProvider>;
}
