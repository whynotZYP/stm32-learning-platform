import rawCourseMap from '../../../../curriculum/course-map.json';
import { CourseMapSchema } from './schemas';
import type { CourseMap } from './types';

export function loadCourseMap(): CourseMap {
  return CourseMapSchema.parse(rawCourseMap);
}
