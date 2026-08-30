import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type {
  IdentifiedTestCase,
  TestCase,
  RunEvent,
  RunReportResponse,
  GenerateStoryResult,
} from '../api/types';

export type Stage = 'input' | 'review' | 'execution' | 'report';

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail';

export interface LiveTestProgress {
  id: string;
  name: string;
  status: TestStatus;
  steps: Array<{ stepIndex: number; action: string; label: string; outcome: 'pass' | 'fail'; selectorUsed?: string; error?: string; screenshot?: string; screenshotPath?: string }>;
  reason?: string;
}

export interface AppState {
  stage: Stage;
  stories: string[];
  testCases: IdentifiedTestCase[];
  generationErrors: Array<{ storyIndex: number; story: string; error: string; errorType: string }>;
  runId: string | null;
  testOrder: string[];
  liveProgress: Record<string, LiveTestProgress>;
  report: RunReportResponse | null;
  runError: string | null;
}

const EMPTY_STEP: TestCase['steps'][number] = { type: 'when', action: '', target_hint: '' };

function blankTestCase(): TestCase {
  return { name: 'New test case', priority: 'medium', category: 'happy-path', steps: [{ ...EMPTY_STEP }] };
}

type Action =
  | { type: 'SET_STORIES'; stories: string[] }
  | { type: 'GENERATION_COMPLETE'; results: GenerateStoryResult[] }
  | { type: 'UPDATE_TEST_CASE'; id: string; testCase: TestCase }
  | { type: 'ADD_TEST_CASE' }
  | { type: 'DELETE_TEST_CASE'; id: string }
  | { type: 'SET_STAGE'; stage: Stage }
  | { type: 'START_RUN'; runId: string; testCases: IdentifiedTestCase[] }
  | { type: 'RESUME_RUN' }
  | { type: 'APPLY_RUN_EVENT'; event: RunEvent }
  | { type: 'SET_REPORT'; report: RunReportResponse }
  | { type: 'HYDRATE'; state: Partial<AppState> }
  | { type: 'RESET' };

const initialState: AppState = {
  stage: 'input',
  stories: [''],
  testCases: [],
  generationErrors: [],
  runId: null,
  testOrder: [],
  liveProgress: {},
  report: null,
  runError: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STORIES':
      return { ...state, stories: action.stories };

    case 'GENERATION_COMPLETE': {
      const testCases: IdentifiedTestCase[] = action.results
        .filter((r): r is Extract<GenerateStoryResult, { status: 'ok' }> => r.status === 'ok')
        .flatMap((r) =>
          r.testCases.map((tc) => ({
            ...tc,
            storyIndex: r.storyIndex,
            storyPreview: r.story.trim().slice(0, 80),
          })),
        );
      const generationErrors = action.results
        .filter((r): r is Extract<GenerateStoryResult, { status: 'error' }> => r.status === 'error')
        .map((r) => ({ storyIndex: r.storyIndex, story: r.story, error: r.error, errorType: r.errorType }));
      return { ...state, testCases, generationErrors, stage: 'review' };
    }

    case 'UPDATE_TEST_CASE':
      return {
        ...state,
        testCases: state.testCases.map((tc) => (tc.id === action.id ? { ...tc, testCase: action.testCase } : tc)),
      };

    case 'ADD_TEST_CASE':
      return {
        ...state,
        testCases: [...state.testCases, { id: crypto.randomUUID(), testCase: blankTestCase() }],
      };

    case 'DELETE_TEST_CASE':
      return { ...state, testCases: state.testCases.filter((tc) => tc.id !== action.id) };

    case 'SET_STAGE':
      return { ...state, stage: action.stage };

    case 'START_RUN': {
      const liveProgress: Record<string, LiveTestProgress> = {};
      const testOrder = action.testCases.map((tc) => tc.id);
      for (const tc of action.testCases) {
        liveProgress[tc.id] = { id: tc.id, name: tc.testCase.name, status: 'pending', steps: [] };
      }
      return { ...state, runId: action.runId, testOrder, liveProgress, stage: 'execution', report: null, runError: null };
    }

    case 'RESUME_RUN': {
      // Rebuilds the liveProgress/testOrder scaffolding after a refresh, since only
      // stage/runId/stories/testCases survive in sessionStorage. Buffered SSE events
      // replay on reconnect and need somewhere to land.
      if (state.testOrder.length > 0) return state;
      const liveProgress: Record<string, LiveTestProgress> = {};
      const testOrder = state.testCases.map((tc) => tc.id);
      for (const tc of state.testCases) {
        liveProgress[tc.id] = { id: tc.id, name: tc.testCase.name, status: 'pending', steps: [] };
      }
      return { ...state, testOrder, liveProgress };
    }

    case 'APPLY_RUN_EVENT': {
      const { event } = action;
      if (event.type === 'test-start') {
        const p = state.liveProgress[event.payload.testId];
        if (!p) return state;
        return {
          ...state,
          liveProgress: { ...state.liveProgress, [event.payload.testId]: { ...p, status: 'running' } },
        };
      }
      if (event.type === 'step-result') {
        const p = state.liveProgress[event.payload.testId];
        if (!p) return state;
        return {
          ...state,
          liveProgress: {
            ...state.liveProgress,
            [event.payload.testId]: { ...p, steps: [...p.steps, event.payload] },
          },
        };
      }
      if (event.type === 'test-end') {
        const p = state.liveProgress[event.payload.testId];
        if (!p) return state;
        return {
          ...state,
          liveProgress: {
            ...state.liveProgress,
            [event.payload.testId]: {
              ...p,
              status: event.payload.outcome === 'PASS' ? 'pass' : 'fail',
              reason: event.payload.reason,
            },
          },
        };
      }
      if (event.type === 'error') {
        return { ...state, runError: event.payload.message };
      }
      return state;
    }

    case 'SET_REPORT':
      return { ...state, report: action.report, stage: 'report' };

    case 'HYDRATE':
      return { ...state, ...action.state };

    case 'RESET':
      return { ...initialState, stories: [''] };

    default:
      return state;
  }
}

const STORAGE_KEY = 'qa-poc-web-state-v1';

interface PersistedState {
  stage: Stage;
  runId: string | null;
  stories: string[];
  testCases: IdentifiedTestCase[];
}

function loadPersisted(): Partial<AppState> | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return undefined;
  }
}

function savePersisted(state: AppState): void {
  try {
    const toSave: PersistedState = {
      stage: state.stage,
      runId: state.runId,
      stories: state.stories,
      testCases: state.testCases,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // sessionStorage unavailable (private browsing etc.) - resilience only, safe to ignore.
  }
}

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const persisted = loadPersisted();
    return persisted ? { ...init, ...persisted } : init;
  });

  useEffect(() => {
    savePersisted(state);
  }, [state.stage, state.runId, state.stories, state.testCases]);

  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function resetSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
