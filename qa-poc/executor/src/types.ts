export type StepType = 'given' | 'when' | 'then';

export interface TestStep {
  type: StepType;
  action: string;
  target_hint: string;
  value?: string;
}

export interface TestCase {
  name: string;
  priority: 'high' | 'medium' | 'low';
  category: 'happy-path' | 'edge-case' | 'negative';
  steps: TestStep[];
}

export type LocatorSpec =
  | { strategy: 'role'; role: string; name: string }
  | { strategy: 'text'; text: string };

export type TranslatedStep =
  | { kind: 'navigate'; url: string }
  | { kind: 'click'; locator: LocatorSpec }
  | { kind: 'fill'; locator: LocatorSpec; value: string }
  | { kind: 'checkVisible'; locator: LocatorSpec }
  | { kind: 'checkText'; locator: LocatorSpec; text: string };

export interface TranslationError {
  index: number;
  step: TestStep;
  message: string;
}

export interface TranslationResult {
  translated: TranslatedStep[];
  errors: TranslationError[];
}
