import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import { BackupSchema, exportBackup } from '../domain/backup/backup';
import { loadCourseMap } from '../domain/content/loadCourseMap';
import { toMarkdownNote } from '../domain/notes/toMarkdown';

export function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function NotesSettingsPage() {
  const { error: progressError, loading, restoreBackup, state } = useProgress();
  const [candidate, setCandidate] = useState<{ filename: string; json: string }>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const mountedRef = useRef(true);
  const restoringRef = useRef(false);
  const selectionTokenRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) return <section className="page"><h1>笔记与备份</h1><p>正在读取本机学习进度。</p></section>;
  if (progressError === '暂时无法读取本机学习进度，请刷新页面后重试。') return <section className="page"><h1>笔记与备份</h1><p role="alert" className="status status--danger">{progressError}</p></section>;

  const week = loadCourseMap().weeks[state.currentWeek - 1];
  const lessonId = week.lessonIds[0] ?? `week-${week.week}`;
  const date = state.updatedAt.slice(0, 10);

  function exportMarkdown() {
    const tags = [...new Set(state.evidence.filter((record) => record.lessonId === lessonId).flatMap((record) => record.tagIds))];
    const note = toMarkdownNote({
      lessonId, week: week.week, date, tags, objectives: [], cubeMxDecisions: '', wiringAndSafety: '', codeAndDataFlow: '',
      faults: '', evidence: '', reflection: state.notes[lessonId] ?? '',
    });
    download(note.markdown, note.filename, 'text/markdown;charset=utf-8');
  }

  function exportProgress() {
    download(exportBackup(state), `stm32-learning-platform-${date}.json`, 'application/json;charset=utf-8');
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const token = ++selectionTokenRef.current;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setCandidate(undefined); setNotice(undefined); setError(undefined);
    try {
      const json = await file.text();
      BackupSchema.parse(JSON.parse(json));
      if (!mountedRef.current || token !== selectionTokenRef.current) return;
      setCandidate({ filename: file.name, json });
      setNotice('备份文件已验证。确认后会用它恢复本机学习进度。');
    } catch {
      if (mountedRef.current && token === selectionTokenRef.current) setError('备份文件无法读取或格式不正确，请选择本平台导出的备份文件。');
    }
  }

  async function restoreSelected() {
    if (!candidate || restoringRef.current || !window.confirm(`确认用“${candidate.filename}”恢复本机学习进度吗？`)) return;
    restoringRef.current = true;
    if (mountedRef.current) setRestoring(true);
    try {
      setNotice(undefined); setError(undefined);
      const result = await restoreBackup(candidate.json);
      if (!mountedRef.current) return;
      if (result === 'restored') {
        setCandidate(undefined);
        setNotice('备份已恢复。');
      } else if (result === 'restored-unverified' || result === 'restore-unknown') {
        setCandidate(undefined);
      } else if (result === 'failed') {
        setError('恢复备份时出现问题，原有学习进度未改变。');
      }
    } finally {
      restoringRef.current = false;
      if (mountedRef.current) setRestoring(false);
    }
  }

  return <section className="page"><h1>笔记与备份</h1><p>{`当前导出：第 ${week.week} 周`}</p>
    <p>导出的 Markdown 可直接保存到 GitHub 笔记仓库；备份文件只保存在你选择的位置。</p>
    <p><button type="button" onClick={exportMarkdown}>导出 Markdown</button>{' '}<button type="button" onClick={exportProgress}>导出全部进度</button></p>
    <section aria-label="备份恢复区域"><h2>恢复备份</h2><label>导入备份<input type="file" accept="application/json,.json" disabled={restoring} onChange={(event) => { void chooseFile(event); }} /></label>
      {candidate && <p><button type="button" disabled={restoring} onClick={() => { void restoreSelected(); }}>恢复已选备份</button></p>}
    </section>
    {(error ?? progressError) && <p role="alert" className="status status--danger">{error ?? progressError}</p>}
    {notice && <p role="status" className="status status--success">{notice}</p>}
  </section>;
}
