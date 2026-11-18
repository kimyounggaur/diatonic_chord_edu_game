import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Hand, HelpCircle, Music2, RotateCcw, Sparkles, Star, Volume2 } from 'lucide-react';
import type { LevelDefinition } from '../domain/theory';
import { buildAllDiatonicTriads, buildDiatonicTriad, getTriadIntervals } from '../domain/theory';
import { getKey, LEVELS, WORLDS } from '../data/worlds';
import { adaptiveChoices, calculateAttemptScore, calculateStars } from '../domain/learning';
import type { ReviewItem } from '../domain/learning';
import { resolutionProgression } from '../domain/questions';
import { makeTasks, qualityNames, conceptFor, conceptDescriptions, noteLabels, solfege, type Task } from '../domain/tasks';
import { useGameStore } from '../storage/store';
import { audio } from '../audio/AudioService';

export default function LevelPlayer({ level, review, onExit, onNext, onPhaseChange }: { level: LevelDefinition; review?: ReviewItem | null; onExit: () => void; onNext: (level: LevelDefinition) => void; onPhaseChange?: (playing:boolean) => void }) {
  const { settings, completeLevel, addReview, markReviewCorrect } = useGameStore();
  const key = getKey(level.keyId);
  const baseTasks = useMemo(() => {
    const all = makeTasks(level);
    if (!review) return all;
    const matched = (review.taskId ? all.find(task => task.id === review.taskId) : undefined) || (!review.taskId ? (all.find(task => task.degree === review.degree) || all.find(task => !task.degree)) : undefined);
    return [matched || all[0]];
  }, [level.id, review?.id]);
  const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
  const tasks = useMemo(() => [...baseTasks, ...reviewTasks], [baseTasks, reviewTasks]);
  const initialReviews = useRef(useGameStore.getState().progress.reviewQueue);
  const scheduledReviewIds = useRef(new Set<string>());
  const [screen, setScreen] = useState<'intro' | 'game' | 'result'>('intro');
  useEffect(() => { onPhaseChange?.(screen === 'game'); return () => onPhaseChange?.(false); }, [screen, onPhaseChange]);
  const [index, setIndex] = useState(0);
  const task = tasks[Math.min(index, tasks.length - 1)];
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [hints, setHints] = useState(0);
  const [assisted, setAssisted] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [assistedEver, setAssistedEver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showNotes, setShowNotes] = useState(!task.audioOnly || settings.visualAudio);
  const [rhythm, setRhythm] = useState<'block' | 'arpeggio'>('block');
  const [listened, setListened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragRef = useRef<{ value: string; x: number; y: number; moved: boolean } | null>(null);
  const completedRef = useRef(false);
  const alive = useRef(true);
  const signatureNotes = Object.entries(key.keySignature).map(([letter, accidental]) => letter + (accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental === '##' ? '##' : accidental === 'bb' ? 'bb' : ''));
  const triads = useMemo(() => buildAllDiatonicTriads(key), [key.id]);
  const progression = key.progression.map(d => triads[d - 1]);
  const relative = key.relativeKeyId ? getKey(key.relativeKeyId) : undefined;
  const world = WORLDS.find(w => w.id === level.worldId);
  const isSlots = ['scale', 'tower', 'timeline'].includes(task.kind);
  const highlightedNotes = new Set(task.kind === 'halfsteps'
    ? task.correct.flatMap(i => [key.scale[Number(i)].display, key.scale[(Number(i) + 1) % 7].display])
    : task.notes?.map(n => n.display) || task.correct);

  useEffect(() => { alive.current = true; return () => { alive.current = false; audio.stop(); }; }, []);
  useEffect(() => {
    audio.stop();
    setScreen('intro'); setIndex(0); setScores([]); setCorrectStreak(0); setAssistedEver(false); setLeaveConfirm(false); completedRef.current = false;
    setReviewTasks([]); scheduledReviewIds.current.clear();
    initialReviews.current = useGameStore.getState().progress.reviewQueue;
  }, [level.id]);
  useEffect(() => {
    setAnswers(task.prefill || []); setSelectedSlot(null); setErrors(0); setHints(0); setAssisted(false); setAutoReveal(false); setSuccess(false); setFeedback(''); setShowNotes(!task.audioOnly || settings.visualAudio); setListened(false);
  }, [index, task.id]);
  useEffect(() => {
    if (!leaveConfirm) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>('.confirm-modal');
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setLeaveConfirm(false); }
      if (event.key !== 'Tab' || !panel) return;
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); before?.focus(); };
  }, [leaveConfirm]);

  const label = (value: string) => settings.ascii ? value.replaceAll('♯', '#').replaceAll('♭', 'b') : value;
  const answerLabel = (value: string) => task.kind === 'halfsteps' ? `${label(key.scale[Number(value)].display)}–${label(key.scale[(Number(value) + 1) % 7].display)}` : value === 'listened' ? '진행 전체 확인' : label(value);
  const noteSub = (value: string) => settings.noteLabels === 'korean' ? noteLabels[value[0]] || '' : settings.noteLabels === 'solfege' ? (solfege[value[0]] || '') + value.slice(1) : '';
  const place = (value: string, slot?: number) => {
    if (success || autoReveal) return;
    if (task.kind === 'halfsteps') {
      setAnswers(old => old.includes(value) ? old.filter(v => v !== value) : old.length < task.correct.length ? [...old, value] : [...old.slice(1), value]);
      return;
    }
    if (!isSlots) { setAnswers([value]); return; }
    const fixed = task.prefill?.length || 0;
    const target = slot ?? selectedSlot ?? answers.findIndex((a, i) => i >= fixed && !a);
    const effective = target === -1 || target === null ? Math.max(fixed, answers.length) : target;
    if (effective >= task.correct.length || effective < fixed) return;
    setAnswers(old => { const next = [...old]; next[effective] = value; return next; });
    setSelectedSlot(null);
    if (task.kind !== 'timeline') { const n = key.scale.find(n => n.display === value); if (n) void audio.playNotes([n]); }
  };
  const removeSlot = (slot: number) => {
    if (success || autoReveal || slot < (task.prefill?.length || 0)) return;
    setAnswers(old => { const next = [...old]; next[slot] = ''; return next; });
    setSelectedSlot(slot);
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, value: string) => {
    if (event.button !== 0 || !isSlots || autoReveal || success) return;
    dragRef.current = { value, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && Math.hypot(event.clientX - d.x, event.clientY - d.y) > 8) { d.moved = true; setDragging(d.value); }
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.moved) {
      const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      if (el) place(d.value, Number(el.dataset.slot));
      event.preventDefault();
    }
    setDragging(null);
    // Keep this flag until the synthetic click has been suppressed.
    if (d.moved) window.setTimeout(() => { dragRef.current = null; }, 0); else dragRef.current = null;
  };
  const play = async (mode: 'block' | 'arpeggio' | 'scale' = 'block') => {
    if (playing) return;
    setPlaying(true);
    try {
      await audio.unlock();
      if (task.kind === 'timeline' || task.kind === 'playback') await audio.playProgression(progression, 80, rhythm);
      else if (task.kind === 'resolution') await audio.playProgression(resolutionProgression(triads, progression, level.templateId), 80, rhythm);
      else await audio.playNotes(task.notes || key.scale, mode, 80);
      if (alive.current) setListened(true);
    } finally { if (alive.current) setPlaying(false); }
  };
  const correctNow = () => task.kind === 'playback' ? listened : task.kind === 'halfsteps' ? answers.length === task.correct.length && [...answers].sort().join('|') === [...task.correct].sort().join('|') : answers.length === task.correct.length && answers.every((a, i) => a === task.correct[i]);
  const validate = () => {
    if (success || autoReveal) return;
    if (correctNow()) {
      const concept = review?.concept || conceptFor[level.templateId] || 'stackedThirds';
      const degree = review?.degree || task.degree || 1;
      const matchingReview = review || initialReviews.current.find(item => item.keyId === key.id && item.concept === concept && item.degree === degree && (!item.levelId || (item.levelId === level.id && item.taskId === task.id)));
      // Only an independently correct answer without hints counts for the exact earlier item.
      if (!task.reviewOf && errors === 0 && hints === 0 && matchingReview && initialReviews.current.some(item => item.id === matchingReview.id)) {
        markReviewCorrect(matchingReview.id);
        initialReviews.current = initialReviews.current.filter(item => item.id !== matchingReview.id);
      }
      setSuccess(true); setFeedback(task.explanation); audio.success();
      if (settings.vibration && navigator.vibrate) navigator.vibrate(30);
      if (task.kind === 'scale') void play('scale');
      if (task.kind === 'tower' || task.kind === 'resolution') void play();
      return;
    }
    const nextErrors = errors + 1;
    setErrors(nextErrors);
    const concept = review?.concept || conceptFor[level.templateId] || 'stackedThirds';
    const reviewId = review?.id || `${key.id}:${concept}:${task.degree || 1}:${level.id}:${task.id}`;
    // A retry of this item is immediate; append a different degree for the session's end.
    if (!review && !task.reviewOf && !scheduledReviewIds.current.has(reviewId)) {
      const alternative = baseTasks.find(candidate => candidate.kind === task.kind && candidate.degree && candidate.degree !== task.degree);
      if (alternative) {
        scheduledReviewIds.current.add(reviewId);
        setReviewTasks(old => [...old, { ...alternative, id: `review-${task.id}`, reviewOf: task.id, sourceTaskId: alternative.id, title: `복습 · ${alternative.title}` }]);
      }
    }
    addReview(key.id, concept, review?.degree || task.degree || 1, review ? review.levelId : level.id, review ? review.taskId : (task.sourceTaskId || task.id));
    if (nextErrors >= 3) {
      setAssisted(true); setAssistedEver(true); setAutoReveal(true); setAnswers(task.correct);
      setFeedback('완성 경로를 함께 확인해요. 아래의 ‘직접 다시 만들기’를 눌러 같은 문제를 다시 완성하면 통과할 수 있어요.');
    } else {
      setFeedback(nextErrors === 1 ? task.rule : `${task.rule} 조표와 강조된 음계 위치를 한 번 더 살펴보세요.`);
    }
  };
  const next = () => {
    const score = calculateAttemptScore(errors, hints, assisted);
    const updated = [...scores, score];
    setScores(updated);
    setCorrectStreak(streak => errors === 0 && hints === 0 && !assisted ? streak + 1 : 0);
    if (index < tasks.length - 1) { setIndex(index + 1); return; }
    if (!review && !completedRef.current) { completeLevel(level, updated, assistedEver || assisted); completedRef.current = true; }
    setScreen('result');
  };
  const replay = () => { setAutoReveal(false); setAnswers(task.prefill || []); setSelectedSlot(null); setFeedback('이제 직접 같은 문제를 재현해 주세요. 천천히 해도 괜찮아요.'); };
  const hint = () => { if (success || autoReveal) return; setHints(hints + 1); setFeedback(`${task.rule}${hints > 0 ? ` ${task.explanation}` : ''}`); };
  const exit = () => screen === 'game' && !leaveConfirm ? setLeaveConfirm(true) : onExit();
  const candidateNextLevel = LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];
  const nextLevel = candidateNextLevel && (!WORLDS.find(w => w.id === candidateNextLevel.worldId)?.advanced || settings.advanced) ? candidateNextLevel : undefined;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const stars = calculateStars(scores, assistedEver);

  if (review?.taskId && task.id !== review.taskId) return <section className="result-panel"><h1>복습 문제를 불러올 수 없어요.</h1><p>저장된 문제 정보가 현재 콘텐츠와 맞지 않아요. 다른 복습을 선택해 주세요.</p><button className="secondary-button" onClick={onExit}>복습 목록으로 돌아가기</button></section>;

  if (screen === 'intro') return <section className="level-intro">
    <button className="text-button" onClick={onExit}><ArrowLeft size={18} /> 지도 돌아가기</button>
    <div className="level-eyebrow">{world?.name || '톤테라'} · {key.mode === 'major' ? '태양 도시' : '달 동굴'}</div>
    <div className="intro-card">
      <div className="intro-symbol"><Music2 size={42}/></div>
      <span className="eyebrow">{review ? '기억을 되살리는 복습' : '새로운 복원 임무'}</span>
      <h1>{level.title}</h1><p>{key.koreanName} · 약 {level.templateId === 'progression' ? '5' : '3'}분</p>
      <div className="signature-panel"><span>{key.tonic.display} {key.mode === 'major' ? 'Major' : 'Natural minor'}</span><strong>{signatureNotes.length ? signatureNotes.join(' · ') : '조표 없음 ♮'}</strong></div>
      {key.mode === 'naturalMinor' && <p className="input-help">자연단조의 v는 {label(triads[4].symbol)}인 단화음이에요. 7음을 올리는 화성단음계는 자유 연습의 별도 모드에서 다뤄요.</p>}
      <ul className="objective-list">{level.learningObjectives.map((o, i) => <li key={i}><Check size={17}/>{conceptDescriptions[o] || o}</li>)}</ul>
      <div className="npc-dialogue"><span className="npc-avatar">✦</span><div><strong>루미</strong><p>답을 외우지 않아도 괜찮아. 음계에서 하나씩 건너뛰면 화음이 보여!</p></div></div>
      <button className="primary-button" onClick={() => { void audio.unlock(); setScreen('game'); }}>복원 시작하기 <ArrowRight size={19}/></button>
      <small>듣기는 감점 없음 · 목숨과 시간 제한 없음</small>
    </div>
  </section>;

  if (screen === 'result') return <section className="result-panel">
    <span className="eyebrow">RESTORATION COMPLETE</span><div className="result-stars" aria-label={`별 ${stars}개`}>{[1, 2, 3].map(n => <Star key={n} size={52} fill={n <= stars ? 'currentColor' : 'none'} className={n <= stars ? 'earned' : ''}/>)}</div>
    <h1>{review ? '복습을 마쳤어요!' : '빛이 다시 연결됐어요!'}</h1><p>{key.koreanName} · {level.title}</p>
    <div className="result-stats"><div><strong>{avg}</strong><span>평균 점수</span></div><div><strong>{tasks.length}</strong><span>완성한 과제</span></div><div><strong>{assistedEver ? '함께' : '스스로'}</strong><span>이번 복원</span></div></div>
    <div className="npc-dialogue"><span className="npc-avatar">✦</span><div><strong>루미</strong><p>만든 원리를 기억해 둬. 다른 조성에서도 같은 규칙으로 다시 만들 수 있어!</p></div></div>
    <p className="saved-note"><Check size={16}/>{review ? (errors === 0 && hints === 0 ? '복습 기록을 저장했어요.' : '틀린 문제는 다음에 다시 연습할 수 있어요.') : '별과 개념별 숙련도를 저장했어요.'}</p>
    {!review && nextLevel && <button className="primary-button" onClick={() => onNext(nextLevel)}>다음 임무 <ArrowRight size={19}/></button>}
    <button className="secondary-button" onClick={onExit}>{review ? '복습 목록으로 돌아가기' : '왕국 지도로 돌아가기'}</button>
    <details open={level.templateId === 'quality'}><summary>이번 조성의 일곱 화음</summary><div className="completed-chords">{triads.map(t => <button key={t.degree} className="choice-card" onClick={() => void audio.playNotes(t.notes)} aria-label={`${t.symbol}, ${t.romanNumeral}, ${qualityNames[t.quality]} 화음 듣기`}><strong>{label(t.symbol)}</strong><span>{t.romanNumeral} · {qualityNames[t.quality].split(' · ')[0]}</span></button>)}</div><p><strong>발견한 품질 패턴</strong><br/>{triads.map(t => qualityNames[t.quality].split(' · ')[0]).join(' – ')}</p></details>
  </section>;

  return <section className="level-game">
    <div className="level-header"><button className="icon-button" aria-label="스테이지 나가기" onClick={exit}><ArrowLeft size={21}/></button><div><span className="eyebrow">{key.koreanName}</span><h2>{level.title}</h2></div><span className="question-counter">{index + 1}<span> / {tasks.length}</span></span></div>
    <div className="level-progress" role="progressbar" aria-label="스테이지 진행" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={tasks.length}><span style={{width: `${(index + (success ? 1 : 0)) / tasks.length * 100}%`}}/></div>
    <div className="game-layout">
      <div className="puzzle-panel">
        <div className="signature-panel compact"><span>{signatureNotes.length ? signatureNotes.join(' · ') : '♮ 조표 없음'}</span><span>학습 모드 · 시간 제한 없음</span></div>
        {key.mode === 'naturalMinor' && <p className="input-help">자연단조 유지: v = {label(triads[4].symbol)} · 7음을 임의로 올리지 않아요.</p>}
        <div className="puzzle-title"><span className="eyebrow">{String(index + 1).padStart(2, '0')} / DISCOVER THE PATTERN</span><h1>{task.title}</h1><p>{task.prompt}</p></div>
        <div className="scale-rail" aria-label="현재 조성 음계">{key.scale.map((n, i) => <span key={n.display} className={`${(errors >= 2 || hints > 0) && highlightedNotes.has(n.display) ? 'highlighted' : ''}`}><b>{label(n.display)}</b><small>{i + 1}도</small></span>)}</div>

        {level.templateId === 'relative' && relative && <div className="relative-comparison">{[key, relative].map(k => <div className="comparison-card" key={k.id}><span className="eyebrow">{k.mode === 'major' ? '태양 도시' : '달 동굴'}</span><strong>{k.koreanName}</strong><p>{k.scale.map(n => label(n.display)).join(' · ')}</p><button className="secondary-button" onClick={async () => { await audio.unlock(); await audio.playProgression(k.progression.map(d => buildDiatonicTriad(k, d as 1 | 2 | 3 | 4 | 5 | 6 | 7)), 80); }}><Volume2 size={16}/>진행 비교 듣기</button></div>)}</div>}

        {isSlots && <>
          <div className={task.kind === 'tower' ? 'chord-tower' : task.kind === 'timeline' ? 'timeline-slots' : 'scale-slots'} aria-label="음 배치 슬롯">
            {task.correct.map((_, slot) => <button type="button" data-slot={slot} className={`note-slot ${answers[slot] ? 'filled' : ''} ${selectedSlot === slot ? 'selected' : ''} ${autoReveal || success ? 'correct' : ''}`} key={slot} aria-label={`${task.kind === 'tower' ? ['루트', '3음', '5음'][slot] : `${slot + 1}번째`} 슬롯${answers[slot] ? ` ${answers[slot]}` : ' 비어 있음'}`} aria-pressed={selectedSlot === slot} onClick={() => removeSlot(slot)} disabled={slot < (task.prefill?.length || 0)}><small>{task.kind === 'tower' ? ['Root · 1', 'Third · 3', 'Fifth · 5'][slot] : task.kind === 'timeline' ? progression[slot]?.romanNumeral : `${slot + 1}`}</small><strong>{answers[slot] ? label(answers[slot]) : '+'}</strong></button>)}
          </div>
          {task.kind === 'tower' && <p className="hint-path">1음 <span>↗ +2칸</span> 3음 <span>↗ +2칸</span> 5음</p>}
          <div className="note-deck" aria-label="배치할 카드">{task.options.map((value, i) => <button key={`${value}-${i}`} className={`note-card ${dragging === value ? 'dragging' : ''}`} aria-label={`${label(value)} 카드 배치`} onPointerDown={e => pointerDown(e, value)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; setDragging(null); }} onClick={() => { if (!dragRef.current?.moved) place(value); }} disabled={success || autoReveal} style={{touchAction:'none'}}><strong>{label(value)}</strong>{noteSub(value) && <small>{noteSub(value)}</small>}</button>)}</div>
          <p className="input-help"><Hand size={15}/>카드를 탭하면 다음 칸에 놓여요. 슬롯을 탭하면 바꿀 수 있어요.</p>
        </>}

        {task.kind === 'halfsteps' && <><div className="halfstep-options" aria-label="반음 구간 선택">{task.options.map(i => <button key={i} className={`choice-card ${answers.includes(i) ? 'selected' : ''}`} aria-label={`${label(key.scale[+i].display)}에서 ${label(key.scale[(+i + 1) % 7].display)} 구간 선택`} aria-pressed={answers.includes(i)} onClick={() => place(i)} disabled={success || autoReveal}><strong>{label(key.scale[+i].display)} → {label(key.scale[(+i + 1) % 7].display)}{+i === 6 ? ' ↑' : ''}</strong><span>{+i + 1} → {+i === 6 ? '8' : +i + 2}도</span></button>)}</div><p className="input-help">선택한 구간 {answers.length} / {task.correct.length}</p></>}

        {task.triad && !isSlots && <div className="chord-display">
          {task.audioOnly && !showNotes ? <><div className="ear-symbol"><Volume2 size={40}/></div><button className="text-button" onClick={() => setShowNotes(true)}>눈으로 보기 · 구성음 확인</button></> : <div className="chord-notes">{task.triad.notes.map((n, i) => <span key={n.display}><small>{['1음', '3음', '5음'][i]}</small><strong>{label(n.display)}</strong></span>)}</div>}
          {task.kind === 'quality' && <div className="interval-meter">{getTriadIntervals(task.triad.notes).map((gap, i) => <div key={i}><span>{i === 0 ? '아래' : '위'} 3도</span><div className="semitone-beads">{Array.from({length:gap}, (_, j) => <i key={j}/>)}</div><strong>{gap}반음</strong></div>)}</div>}
        </div>}

        {!isSlots && !['halfsteps', 'playback'].includes(task.kind) && <div className={`choice-grid ${task.kind === 'function' ? 'function-islands' : ''}`} aria-label="정답 선택">{adaptiveChoices(task.options, task.correct, correctStreak).map(value => <button className={`choice-card ${answers.includes(value) ? 'selected' : ''} ${autoReveal && task.correct.includes(value) ? 'correct' : ''}`} key={value} aria-pressed={answers.includes(value)} onClick={() => place(value)} disabled={success || autoReveal}>{task.kind === 'function' && <span className="function-icon">{value.startsWith('집') ? '⌂' : value.startsWith('길') ? '↝' : '♜'}</span>}<strong>{label(value)}</strong></button>)}</div>}

        {task.kind === 'playback' && <div className="playback-panel"><div className="completed-chords">{progression.map((t, i) => <div className="progression-chord" key={i}><span>{t.romanNumeral}</span><strong>{label(t.symbol)}</strong></div>)}</div><div className="rhythm-picker" role="group" aria-label="연주 리듬"><button className={`choice-card ${rhythm === 'block' ? 'selected' : ''}`} aria-pressed={rhythm === 'block'} onClick={() => setRhythm('block')}>동시에 · 블록 코드</button><button className={`choice-card ${rhythm === 'arpeggio' ? 'selected' : ''}`} aria-pressed={rhythm === 'arpeggio'} onClick={() => setRhythm('arpeggio')}>차례로 · 아르페지오</button></div><button className="primary-button" onClick={() => void play()} disabled={playing}><Volume2 size={20}/>{playing ? '진행이 연주되고 있어요…' : listened ? '진행 다시 듣기' : '진행 연주하기'}</button>{listened && <p className="saved-note"><Check size={17}/>전체 진행을 들었어요.</p>}</div>}

        <div className="npc-dialogue"><span className="npc-avatar" aria-hidden="true">{task.npc === '테르티' ? '▦' : task.npc === '센토' ? '◈' : task.npc === '로마' ? 'Ⅳ' : '✦'}</span><div aria-live="polite" aria-atomic="true"><strong>{task.npc || '루미'}</strong><p>{feedback || (index === 0 ? '천천히 직접 만들어 보자. 듣기는 몇 번 해도 감점이 없어!' : correctStreak >= 3 ? '스스로 생각해 보고 필요하면 힌트를 눌러요.' : task.rule)}</p></div></div>
        {(success || autoReveal) && <div className={`feedback ${success ? 'success' : 'assisted'}`} role="status">{success ? <><Sparkles size={19}/>원리를 발견했어요. 다음 단계로 이어 가요!</> : <><HelpCircle size={19}/>완성 경로: {task.correct.map(answerLabel).join(' → ')}</>}</div>}
        {autoReveal && <div className="assist-panel"><p>{task.explanation}</p><button className="primary-button" onClick={replay}><RotateCcw size={18}/>직접 다시 만들기</button></div>}
        <div className="game-actions">{!success && !autoReveal ? <>
          <div className="utility-actions"><button className="secondary-button" onClick={() => void play(task.kind === 'scale' || task.kind === 'halfsteps' ? 'scale' : 'block')} disabled={playing} aria-label="현재 음 듣기"><Volume2 size={18}/>{playing ? '재생 중' : '듣기'}</button>{task.kind === 'tower' && <button className="secondary-button" onClick={() => void play('arpeggio')} disabled={playing}>분산음</button>}<button className="secondary-button" onClick={hint}><HelpCircle size={18}/>힌트 <small>−15</small></button></div>
          <button className="primary-button" onClick={validate} disabled={task.kind === 'playback' && !listened}><Check size={19}/>완성 확인하기</button>
        </> : success ? <button className="primary-button" onClick={next}>{index === tasks.length - 1 ? '복원 결과 보기' : '다음 발견으로'}<ArrowRight size={19}/></button> : null}</div>
        <p className="score-note">{assisted ? '함께 완성 후 재현 · 기본 20점' : `현재 ${errors === 0 ? '첫 번째' : errors === 1 ? '두 번째' : '세 번째'} 시도`} · 듣기와 탭 조작 감점 없음</p>
      </div>
    </div>
    {leaveConfirm && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">이번 임무를 나갈까요?</h2><p>완료한 스테이지의 별은 유지돼요. 현재 진행 중인 임무는 다시 시작하게 돼요.</p><button className="secondary-button" onClick={() => setLeaveConfirm(false)}>계속 복원하기</button><button className="primary-button" onClick={onExit}>지도로 돌아가기</button></div></div>}
  </section>;
}
